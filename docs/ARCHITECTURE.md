# Architecture

Deep technical reference for the framework. For a plain-English primer, see [CONCEPTS.md](CONCEPTS.md); for setup, [QUICKSTART.md](QUICKSTART.md).

## Contents

1. [Scope](#scope)
2. [Layered model](#layered-model)
3. [Contracts](#contracts)
4. [SDK (`@agent-registry/sdk`)](#sdk)
5. [Subgraph](#subgraph)
6. [Shared constants + ABIs](#shared-constants--abis)
7. [Data-flow invariants](#data-flow-invariants)
8. [Off-chain accounting library (for consumers)](#off-chain-accounting-library-for-consumers)
9. [Security model](#security-model)

## Scope

The framework is what lives in `packages/`:

- `packages/contracts/` — Solidity sources + Foundry tests + deploy scripts
- `packages/sdk/` — TypeScript client (`@agent-registry/sdk`)
- `packages/subgraph/` — The Graph subgraph
- `packages/shared/` — ABIs, constants, Zod schemas (framework-internal)

The reference web product in `apps/web/` is **not in scope** — it's a consumer that demonstrates the framework but is versioned separately.

## Layered model

```
┌────────────────────────────────────────────────────────────────────┐
│ L4  Your application                                               │
│     • UI, REST, CLI, background workers, whatever                  │
│     • Free to choose any stack; no framework opinion               │
└─────────────────┬──────────────────────────────────────────────────┘
                  │ imports
                  ▼
┌────────────────────────────────────────────────────────────────────┐
│ L3  @agent-registry/sdk                                            │
│     • AgentRegistryClient.{identity,reputation,company,invoice}    │
│     • Reads via `viem` PublicClient                                │
│     • Writes via `viem`/`wagmi` WalletClient (bring your own)      │
│     • No Node-only deps — works in browser / Worker / Edge         │
└─────────────────┬──────────────────────────────────────────────────┘
                  │ calls / reads on-chain
                  ▼
┌────────────────────────────────────────────────────────────────────┐
│ L2  Smart contracts on an EVM chain                                │
│     • IdentityRegistry    (canonical, external)                    │
│     • ReputationRegistry  (canonical, external)                    │
│     • AgentRegistryWrapper, CompanyRegistry, InvoiceRegistry       │
│       (this repo)                                                  │
└─────────────────┬──────────────────────────────────────────────────┘
                  │ events
                  ▼
┌────────────────────────────────────────────────────────────────────┐
│ L1  The Graph subgraph (optional)                                  │
│     • Indexes all framework events                                 │
│     • GraphQL API for pagination + historical queries              │
│     • Skip it if direct contract reads are enough                  │
└────────────────────────────────────────────────────────────────────┘
```

## Contracts

Source: [`packages/contracts/src/`](../packages/contracts/src). Solidity `^0.8.24`, optimizer runs=200, EVM=cancun, `via_ir=true`. No external dependencies beyond the canonical ERC-8004 interface.

### `AgentRegistryWrapper.sol`

Adds app-specific features on top of the canonical ERC-8004 Identity Registry: discovery tags (max 10, max 32 bytes each), a registration fee, featured-agent flag, activity tracking. Implements `IERC721Receiver` because the canonical registry uses `_safeMint` — the wrapper receives the minted NFT and transfers it to the end user in the same tx.

Key function:

```solidity
function registerAgent(
  string calldata agentURI,
  IIdentityRegistry.MetadataEntry[] calldata metadata,
  string[] calldata tags
) external payable returns (uint256 agentId);
```

16 Foundry tests.

### `CompanyRegistry.sol`

Minimal on-chain primitive for agentic companies. No ERC-721, no OpenZeppelin dependency — kept small to minimize audit surface. `companyId` increments from 1. Ownership is a single EOA that can transfer freely. Membership cross-checks the canonical registry's `ownerOf` so nobody can claim an agent they don't own.

Storage:

```solidity
mapping(uint256 => address) public companyOwner;
mapping(uint256 => string)  public companyMetadataURI;
mapping(uint256 => mapping(uint256 => bool)) public hasMember;
mapping(uint256 => mapping(address => bool)) public hasTreasury;
uint256[] private _members[companyId];
address[] private _treasuries[companyId];
```

Events: `CompanyCreated`, `CompanyMetadataUpdated`, `CompanyOwnershipTransferred`, `AgentAdded`, `AgentRemoved`, `TreasuryAdded`, `TreasuryRemoved`.

25 Foundry tests. No fund custody; member/treasury removal is O(n) swap-and-pop (acceptable because lists stay small).

### `InvoiceRegistry.sol`

Atomic invoice issuance and settlement. `createInvoice` stores an `Invoice` struct with issuer/payer/token/amount/memoURI/memoHash/status/timestamps. Payment functions update status *before* external calls (checks-effects-interactions) and use `.call{value:}` with a success check for ETH; `IERC20.transferFrom` with success check for ERC-20.

Two payment paths:

- `payInvoiceETH(id) payable` — requires `msg.value == amount`, token field must be `address(0)`.
- `payInvoiceERC20(id)` — requires prior `approve` from `msg.sender`, token field must be non-zero.

Side-channel:

- `requestInvoice(issuer, token, amount, memoURI)` — emits a "please invoice me" event. No stored state; issuer fulfills via `createInvoice`.

21 Foundry tests, including a mock ERC-20 to exercise the full approve → pay flow.

### Contract tests

```bash
cd packages/contracts
forge test                                    # 62/62
forge test --match-contract InvoiceRegistry   # 21 tests
forge coverage                                # line + branch coverage
```

### Deployment scripts

All in `packages/contracts/script/`:

- `Deploy.s.sol` — deploys `AgentRegistryWrapper` (with canonical registry address + initial fee hardcoded)
- `DeployCompanyRegistry.s.sol` — deploys `CompanyRegistry`
- `DeployInvoiceRegistry.s.sol` — deploys `InvoiceRegistry`
- `autonomous-deploy-*.ts` — wraps each `forge script` in a CDP-faucet-funded workflow: generate wallet → request drips → deploy → print address

## SDK

Source: [`packages/sdk/src/`](../packages/sdk/src). Entrypoint is `AgentRegistryClient`:

```ts
class AgentRegistryClient {
  readonly identity:   IdentityClient     // registerGasless, getAgentURI, getOwner
  readonly reputation: ReputationClient   // feedback lifecycle
  readonly company:    CompanyClient      // createCompany, addAgent, addTreasury, …
  readonly invoice:    InvoiceClient      // createInvoice, payETH, payERC20, cancel, requestInvoice, getInvoice
}
```

Design principles:

- **`viem`-native.** All reads go through a `PublicClient`; writes through a `WalletClient` the caller supplies. No custom transport logic. Works in browser / Node.js / Workers / Edge.
- **No API dependency.** The SDK does not rely on any centralized server. Reading an invoice = reading the contract directly.
- **Typed.** Full TypeScript types for every function, including event args. Runtime validation is not needed because `viem` handles ABI encoding/decoding.
- **Errors are structured.** `TransactionError`, `ValidationError`, `NotFoundError`, `ApiError`, all extending `RegistryError`.

**Write method idiom.** Every write returns `{ txHash, status }` (the `TxResult` type) and waits for the receipt. When a write also returns data (e.g. `createCompany` → `companyId`), the SDK parses the event log inline:

```ts
async createCompany(walletClient: WalletClient, params: CreateCompanyParams): Promise<{ companyId: bigint; tx: TxResult }> {
  const hash = await walletClient.writeContract({ address: this.address(), abi: companyRegistryAbi, functionName: 'createCompany', args: [params.metadataURI], ... })
  const receipt = await this.publicClient.waitForTransactionReceipt({ hash })
  const companyId = this.#parseCompanyCreated(receipt.logs)
  if (companyId === null) throw new TransactionError('CompanyCreated event not found in receipt')
  return { companyId, tx: { hash: receipt.transactionHash, status: receipt.status } }
}
```

Tests: Vitest unit tests colocated with each sub-client file. Runs against a mock viem client; no live network.

## Subgraph

Source: [`packages/subgraph/`](../packages/subgraph). AssemblyScript. Schema in `schema.graphql`, event handlers in `src/`.

Indexed entities:

| Entity | Created by |
|--------|-----------|
| `Agent` | `IdentityRegistry.Registered` |
| `AgentMetadata` | `IdentityRegistry.MetadataSet` |
| `Feedback` | `ReputationRegistry.NewFeedback` |
| `FeedbackResponse` | `ReputationRegistry.ResponseAppended` |
| `Company` | `CompanyRegistry.CompanyCreated` |
| `CompanyMember` | `CompanyRegistry.AgentAdded` / `AgentRemoved` |
| `CompanyTreasury` | `CompanyRegistry.TreasuryAdded` / `TreasuryRemoved` |
| `ProtocolStats` | all handlers (singleton aggregate) |

The subgraph is **optional** — the SDK doesn't depend on it. It exists for apps that want:

- GraphQL queries across all companies / all invoices
- Historical event pagination (contracts have no built-in enumeration beyond per-company arrays)
- A backup source of truth if your app's own database drifts

Deploy with `graph deploy --studio`. Event signatures in `subgraph.yaml` must match the ABI exactly.

## Shared constants + ABIs

Source: [`packages/shared/src/`](../packages/shared/src).

- `constants/addresses.ts` — per-chain contract addresses, read from env vars with fallback defaults
- `constants/chains.ts` — supported chain IDs (84532, 8453), block explorer URLs
- `constants/tokens.ts` — whitelisted tokens per chain (ETH, USDC) with decimals + CoinGecko ids
- `constants/chainlink-feeds.ts` — Chainlink `AggregatorV3` feed addresses for `ETH/USD` and `USDC/USD`, plus the aggregator ABI
- `abis/*.ts` — minimal ABIs for each contract (hand-written for readability; kept in sync with Foundry output)
- `schemas/` — Zod schemas for agent card, feedback input, etc.
- `types/` — cross-package types

The SDK imports from here; so does the reference web product. Anyone wanting to roll their own integration can import these constants directly.

## Data-flow invariants

The framework enforces four invariants:

1. **On-chain is the source of truth.** Any off-chain mirror (Postgres, subgraph, anything) is a cache of on-chain events. Writes to a mirror only happen after the corresponding event is verified in a receipt. No "optimistic" mirror entries.

2. **Every USD value has a source.** Price oracles (see below) always return a `{ usdPrice, source, sourceRef }` triple. When no source is available, the function returns `null` and the caller must surface "Price source missing" in the UI. No peg assumptions, ever.

3. **Tax rates come from named data providers.** The OECD seed is a frozen snapshot with explicit dataset revision; company-level overrides require a `sourceRef` URL / IPFS hash / attestation UID. Never a hardcoded number.

4. **Cross-validated labels make both sides visible.** When a tx has both sides in a registry, their labels are reconciled. Matched, mismatched, or pending — an audit trail, not a trust statement.

These invariants live in the [*off-chain accounting library*](#off-chain-accounting-library-for-consumers) described next. They are not enforced by the contracts (contracts don't know about USD or tax rates) — they are the convention that consumers of the framework follow to get the claimed guarantees.

## Off-chain accounting library (for consumers)

The framework ships reference implementations of the off-chain accounting pieces inside the monorepo under `apps/web/src/lib/`. These are **not published as a package** yet — they're an integration-ready reference you can copy into your own stack. The reusable pieces:

| File | What it does | Status |
|------|--------------|--------|
| `price-oracle.ts` | Chainlink-first, CoinGecko-fallback USD pricing with DB cache | Reference implementation |
| `tax-rates.ts` + `tax-rate-seed.ts` | OECD-seeded tax-rate resolver with override precedence | Reference implementation |
| `tx-classifier-v2.ts` | Calldata + event decoding for high-confidence labels | Reference implementation |
| `tx-reconciler.ts` | Counterparty label reconciliation (matched/mismatched/pending) | Reference implementation |
| `company-financials.ts` | `computeCompanyIncomeStatement` for periods + breakdowns | Reference implementation |
| `balance-sheet.ts` | `computeCompanyBalanceSheet` with cash/AR/AP/equity | Reference implementation |
| `balance-reader.ts` | ETH / ERC-20 balance reads at `latest` or `atBlock` | Reference implementation |

Extracting these into a published `@agent-registry/accounting` npm package is a v1.1 roadmap item. For now, copy the files + the SQL migrations under `apps/web/migrations/` into your project.

## Security model

**What the framework guarantees:**

- You cannot add an agent to a company you don't own in the canonical registry.
- You cannot mark an invoice paid without funds actually moving (ETH/ERC-20 transfer happens in the same tx).
- You cannot cancel an already-paid invoice.
- Company ownership transfer is atomic — there's no in-between state.

**What the framework does not guarantee:**

- That an agent is "real" or "safe" — that's the reputation registry's job.
- That an invoice's `memoURI` is honest or that its `memoHash` wasn't picked after-the-fact. The hash only protects against *later* tampering; a malicious issuer can still write a misleading memo at creation time.
- That a company's metadata (name, jurisdiction) is accurate. Companies are self-asserted; downstream applications can layer verification.
- That price oracles are live. If Chainlink is down and CoinGecko rate-limits you, consumers will see `null` prices — correctly — rather than a fabricated value.

**Audit status.** Zero external audits. Do not deploy to mainnet or handle real funds until these contracts have been audited. This is the single largest limitation of the framework today — see [LIMITATIONS.md](LIMITATIONS.md).
