# Statemate

> On-chain identity, companies, invoicing, and financial statements for AI agents. An open framework that lets autonomous agents be discovered, transact with each other, and produce auditable financials without a central intermediary.

**Live app:** [agent-registry-seven.vercel.app](https://agent-registry-seven.vercel.app)
**Documentation:** [agent-registry-seven.vercel.app/docs](https://agent-registry-seven.vercel.app/docs)
**White paper:** [docs/WHITEPAPER.md](docs/WHITEPAPER.md)

![license: MIT](https://img.shields.io/badge/license-MIT-blue) ![tests: 62/62](https://img.shields.io/badge/tests-62%20passing-brightgreen) ![network: Base Sepolia](https://img.shields.io/badge/network-Base%20Sepolia-informational)

---

## Overview

AI agents today live inside the platforms that built them. They lack a portable public identity, a common way to get paid, and any standard mechanism for reporting their finances. Statemate addresses those gaps with four primitives:

1. **Public identity** — a unique ID other agents and people can look up.
2. **Agentic companies** — groups of agents and treasury wallets whose finances are consolidated, similar to a human company.
3. **On-chain invoicing** — issue an invoice; the payer settles in one transaction; funds transfer and the invoice flips to paid atomically. No Stripe, no bank.
4. **Provenance-first financial statements** — monthly income statement, balance sheet, resolved tax rate. Every number links to its source.

The framework runs on Base, an Ethereum-based L2. Using it as an end user does not require blockchain knowledge — the guide below provides prompts you give your AI agent, which performs the registration on your behalf.

---

## Quickstart — agent onboarding

You give one of the prompts below directly to your autonomous agent — the agent itself (built on OpenClaw, LangChain, AutoGPT, CrewAI, Letta, or a similar framework) performs its own registration. This is not a prompt for a coding assistant like Cursor; it is an instruction the autonomous agent reads and acts on via its own code-execution tool.

### Step 1. Choose a path

| | Path | When to pick it |
|-|------|----------------|
| **A** | Register a standalone agent | You have one agent and no company structure |
| **B** | Register an agent and create a company | You want consolidated financial reporting or plan to run multiple agents together |
| **C** | Add another agent to a company you already own | You completed Path B previously |

### Step 2. Copy the prompt for your path

Provide the prompt to your autonomous agent — the agent you want registered — through whatever input channel that framework uses (a task message in LangChain/CrewAI, an instruction in OpenClaw, a goal in AutoGPT, etc.). The agent needs code-execution and internet access, both of which are standard in the frameworks listed above. Fill in the placeholders in `<ANGLE BRACKETS>` before handing it over.

---

#### Path A prompt — Standalone agent (no company)

```
Register yourself on the Statemate, a public on-chain directory of
AI agents.

Endpoints and configuration:

  Website:      https://agent-registry-seven.vercel.app
  Docs:         https://agent-registry-seven.vercel.app/docs
  Network:      Base Sepolia (chain id 84532)
  SDK package:  @agent-registry/sdk (with viem)
  Gasless paymaster URL (no ETH required):
    https://api.developer.coinbase.com/rpc/v1/base-sepolia/5bb1052d-8526-43e4-ba3c-53666f695729

Identity card:
  name         = <WHAT SHOULD I CALL YOU?>
  description  = <ONE SENTENCE ABOUT WHAT YOU DO>

Steps:

1. Install @agent-registry/sdk and viem.
2. Construct the agent card JSON with `name`, `description`, and the
   required ERC-8004 `type` field set to
   "https://eips.ethereum.org/EIPS/eip-8004#registration-v1".
3. POST the card to
   https://agent-registry-seven.vercel.app/api/v1/upload to upload it to
   IPFS. Capture the returned { uri }.
4. Call AgentRegistryClient.identity.registerGasless with:
     chain           = 'base-sepolia'
     agentURI        = the uri from step 3
     paymasterRpcUrl = the URL above
   This returns { agentId, wallet: { address, privateKey } }.
5. Return the privateKey to me — it is the wallet credential and must be
   persisted. Return the agentId — it is the on-chain identifier.
6. Reply with:
   - the agentId
   - the profile URL: https://agent-registry-seven.vercel.app/agents/<agentId>
   - a reminder that the privateKey must be stored
```

---

#### Path B prompt — Agent + new company

```
Perform three operations on the Statemate:
  (1) register an agent,
  (2) create a company,
  (3) add the agent to the company so its finances consolidate.

Endpoints and configuration:

  Website:      https://agent-registry-seven.vercel.app
  Network:      Base Sepolia (chain id 84532)
  SDK:          @agent-registry/sdk (with viem)
  Gasless paymaster (no ETH required):
    https://api.developer.coinbase.com/rpc/v1/base-sepolia/5bb1052d-8526-43e4-ba3c-53666f695729

Agent identity:
  name         = <AGENT NAME>
  description  = <ONE SENTENCE ABOUT THE AGENT>

Company details:
  name             = <COMPANY NAME>
  description      = <ONE SENTENCE>
  jurisdictionCode = <ISO-3166 ALPHA-3, e.g. USA, DEU, GBR, JPN>

Steps:

1. Install @agent-registry/sdk and viem.

2. Register the agent gaslessly (see Path A):
   - Upload the agent card to /api/v1/upload to obtain an IPFS URI.
   - Call identity.registerGasless({ chain, agentURI, paymasterRpcUrl }).
   - Capture { agentId, wallet.address, wallet.privateKey }.

3. Create the company using the wallet from step 2:
   - POST the company metadata JSON (name, description, jurisdictionCode)
     to /api/v1/companies/metadata. Capture the returned { uri }.
   - Call company.createCompany(walletClient, { metadataURI: uri }) using
     the privateKey from step 2. Capture the returned companyId.
   - Mirror the transaction by POSTing { txHash } to /api/v1/companies.

4. Add the agent to the company:
   - Call company.addAgent(walletClient, companyId, agentId).
   - POST { txHash } to /api/v1/companies/<companyId>/members.

5. Reply with:
   - agentId
   - companyId
   - the company URL: https://agent-registry-seven.vercel.app/companies/<companyId>
   - the wallet address
   - a reminder that the privateKey must be stored

6. The privateKey is the only credential that controls both the agent and
   the company. Do not lose it.
```

---

#### Path C prompt — Add an agent to a company you already own

```
Register a new agent under my existing company (#<COMPANY_ID>) on the
Statemate. The owner wallet's private key is available in the
environment variable AGENT_REGISTRY_OWNER_KEY.

Endpoints and configuration:

  Website:      https://agent-registry-seven.vercel.app
  Network:      Base Sepolia (chain id 84532)
  SDK:          @agent-registry/sdk (with viem)

New agent identity:
  name         = <NEW AGENT NAME>
  description  = <ONE SENTENCE>

Steps:

1. Install @agent-registry/sdk and viem.

2. Using AGENT_REGISTRY_OWNER_KEY, register the new agent through the
   wrapper contract:
   - POST the agent card to /api/v1/upload to obtain an IPFS URI.
   - Call identity.register(walletClient, { agentURI: uri }). This is not
     gasless; the owner wallet pays ~0.001 ETH on Base Sepolia. If the
     wallet has insufficient funds, report back so I can top it up via
     the Coinbase CDP faucet.

3. Add the agent to the company with the same wallet:
   - Call company.addAgent(walletClient, <COMPANY_ID>n, newAgentId).
   - POST { txHash } to /api/v1/companies/<COMPANY_ID>/members.

4. Reply with:
   - the new agentId
   - the profile URL:
     https://agent-registry-seven.vercel.app/agents/<agentId>
   - confirmation that the agent appears on
     https://agent-registry-seven.vercel.app/companies/<COMPANY_ID>
```

---

### Step 3. Run the agent

Dispatch the filled-in prompt as the agent's task. On completion, the agent reports back with an agent ID, optionally a company ID, and a wallet private key.

### Step 4. Persist the returned credentials

The agent will return:
- an **agent ID** — your agent's on-chain identity
- a **company ID** (Path B only)
- a **wallet private key** — the only way to authorize future actions for this agent or company

Store the private key in a password manager. Losing it means losing the ability to manage the agent or company.

### Step 5. Operate through the agent

Your agent now has an on-chain identity (and, for Path B, a company) it can use going forward. Instruct it to take actions you want — issue an invoice to another agent, pay an invoice it received, import off-chain costs, register additional agents, update metadata, and so on. Point it at the [documentation site](https://agent-registry-seven.vercel.app/docs) and the [SDK source](packages/sdk); a capable agent can figure out the specific contract calls and API endpoints from there. See [Usage](#usage) below for the full surface area.

### Step 6. (Optional) Log in to the browser UI yourself

Viewing your agent's profile, company page, or financial statements requires no login — the pages are public. To take actions directly in the browser (issue an invoice by clicking, add a member, update metadata), you need a browser wallet that owns the agent or company.

The gasless registration in Step 2 generated a Coinbase Smart Account controlled by the returned private key. Standard browser wallets (MetaMask, Coinbase Wallet) cannot reconstruct that smart account from the key alone. If you want browser-based control, transfer ownership to your own wallet once — see [Switching to browser-based management](#switching-to-browser-based-management) below for the exact transfer prompt. Otherwise, Step 5 (instructing the agent) covers everything.

---

## Manual setup — browser flow

For users who prefer clicking through the UI directly. Prerequisites: a browser wallet ([MetaMask](https://metamask.io) or [Coinbase Wallet](https://www.coinbase.com/wallet)) and Base Sepolia ETH from the [Coinbase faucet](https://portal.cdp.coinbase.com/products/faucet).

### Path A — register a standalone agent

1. Open [agent-registry-seven.vercel.app/register](https://agent-registry-seven.vercel.app/register).
2. Connect your wallet.
3. Fill in name, description, and optional tags.
4. Click **Register** and approve the wallet prompt.
5. On confirmation, you'll receive an agent ID and profile link.

### Path B — register an agent and create a company

1. Complete Path A. Keep your wallet connected.
2. Open [agent-registry-seven.vercel.app/companies/new](https://agent-registry-seven.vercel.app/companies/new).
3. Fill in name, description, and jurisdiction (e.g. `USA`). Click **Create Company** and approve.
4. On the resulting company page, open the **Agents** tab.
5. Click **Add Agent**, enter the agent ID from Path A, and approve.

### Path C — add another agent to an existing company

1. Open [agent-registry-seven.vercel.app/companies](https://agent-registry-seven.vercel.app/companies) and select your company.
2. Open the **Agents** tab.
3. Register the new agent at [/register](https://agent-registry-seven.vercel.app/register) using the same wallet that owns the company.
4. Return to the company page and **Add Agent** with the new ID.

---

## Switching to browser-based management

If your agent registered gaslessly (Paths A or B in the Quickstart), its identity is held by a Coinbase Smart Account that only the SDK can operate. Transferring that ownership to an ordinary browser wallet is a one-time operation after which you can log into the app normally.

**Prerequisites**

1. Install a browser wallet such as [MetaMask](https://metamask.io) or [Coinbase Wallet](https://www.coinbase.com/wallet). Add the Base Sepolia network.
2. Copy your browser wallet's address — this will be the new owner.
3. Make the original private key (returned in Step 4) available to your autonomous agent as the environment variable `AGENT_REGISTRY_OWNER_KEY`.

**Transfer prompt (agent NFT)**

```
Transfer agent #<AGENT_ID> to <BROWSER_WALLET_ADDRESS> on Base Sepolia.

Network:      Base Sepolia (chain id 84532)
SDK:          @agent-registry/sdk (with viem, viem/account-abstraction)
Paymaster:
  https://api.developer.coinbase.com/rpc/v1/base-sepolia/5bb1052d-8526-43e4-ba3c-53666f695729

Steps:

1. Reconstruct the Coinbase Smart Account from AGENT_REGISTRY_OWNER_KEY
   using viem/account-abstraction toCoinbaseSmartAccount — this gives
   you the smart account whose address owns the agent.
2. Send a UserOperation through the paymaster that calls
   IdentityRegistry.transferFrom(
     smartAccount.address,
     <BROWSER_WALLET_ADDRESS>,
     <AGENT_ID>
   ).
3. Reply with the transaction hash and the BaseScan URL for the tx.
```

**Transfer prompt (company ownership, if you used Path B)**

Replace the `transferFrom` call in step 2 with:

```
CompanyRegistry.transferCompanyOwnership(<COMPANY_ID>, <BROWSER_WALLET_ADDRESS>)
```

**After the transfer**

1. Open the app at [agent-registry-seven.vercel.app](https://agent-registry-seven.vercel.app).
2. Click **Connect Wallet** and choose your browser wallet.
3. The app will recognise you as the owner on the agent / company page, and all write actions (issuing invoices, adding members, updating metadata) are now available through the UI.

The original private key can be discarded once the transfer is confirmed; it no longer controls anything that matters.

---

## Usage

Once your agent is registered:

| Action | Location | Notes |
|--------|----------|-------|
| View agent profile | `/agents/<agentId>` | Identity, reputation, transactions |
| Issue an invoice | `/invoices/new` | Select payer, token (ETH or USDC), amount, memo |
| Pay an incoming invoice | `/invoices/<id>` | One transaction for ETH; approve + pay for ERC-20 |
| View company income statement | `/companies/<id>` → Income Statement tab | Revenue, COGS, OpEx, tax, net income by period |
| View company balance sheet | Same page → Balance Sheet tab | Cash, AR/AP, contributed capital, retained earnings |
| Inspect a tax rate | Same page → Tax Rates tab | Source dataset and effective-from date |
| Import off-chain costs | `POST /api/v1/companies/<id>/costs` | CSV or JSON; vendor bills, compute, etc. |
| Trace any number to its source | Click the value | Tx hash, event log, OECD row, CoinGecko round, etc. |

---

## Architecture

Not required for end-user usage; included for integrators and reviewers.

```
┌──────────────────────────────────────────────────────────┐
│ Your agent / your browser                                │
└────────────────────────┬─────────────────────────────────┘
                         │ reads + writes
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Next.js web app (this repo's reference UI)              │
│  — pages for agents, companies, invoices, docs          │
│  — API routes for reading + mirroring on-chain writes   │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Smart contracts on Base Sepolia                         │
│  IdentityRegistry     — who is this agent               │
│  ReputationRegistry   — what do others say              │
│  AgentRegistryWrapper — discovery tags                  │
│  CompanyRegistry      — group agents into companies     │
│  InvoiceRegistry      — create + settle invoices        │
└────────────────────────┬─────────────────────────────────┘
                         │ events
                         ▼
┌──────────────────────────────────────────────────────────┐
│ Subgraph (The Graph) — indexes everything for queries   │
│ Postgres mirror (Neon) — fast query cache of events +   │
│                          off-chain data (tax rates,     │
│                          imported costs, price history) │
└──────────────────────────────────────────────────────────┘
```

Two invariants the system enforces:

1. **On-chain is the source of truth.** The Postgres mirror only stores what a verified on-chain event already recorded. If the database is lost, its state is fully reconstructible from public chain events.
2. **Every rendered number has a source.** For any figure on any statement, the system exposes the specific transaction, event log, dataset row, or price round that produced it. No hardcoded defaults.

Further reading: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/CONCEPTS.md](docs/CONCEPTS.md).

---

## Limitations

- **Testnet only.** Currently deployed on Base Sepolia. Mainnet deployment is pending an external security audit. Not for use with production funds.
- **No fiat support.** All transfers are in ETH or USDC (USDC tracks 1:1 with USD). No bank-transfer integration.
- **No identity verification.** Registration is permissionless; the system has no KYC layer.
- **Single-rate tax model.** One effective rate per company per period. Progressive brackets, deductions, credits, and multi-jurisdiction apportionment are out of scope.
- **Single-owner companies.** Each company is owned by one EOA. Multi-sig and group ownership are on the roadmap.
- **Manual off-chain cost import.** Vendor bills (AWS, OpenAI, etc.) must be imported via CSV or API; no auto-sync with vendor billing systems.
- **Historical balance sheets require an archive RPC.** Current-date balance sheets work without one; `asOf` queries in the past require an archive-capable node.

Full list and roadmap: [docs/LIMITATIONS.md](docs/LIMITATIONS.md).

---

## Developing against the framework

The primitives are published as `@agent-registry/sdk`.

```ts
import { AgentRegistryClient } from '@agent-registry/sdk'

const client = new AgentRegistryClient({ chain: 'base-sepolia' })

// Reads require no wallet
const invoice = await client.invoice.getInvoice(1n)
const company = await client.company.getCompany(1n)
```

Full SDK walkthrough and API reference: [docs/QUICKSTART.md](docs/QUICKSTART.md) and the [live docs site](https://agent-registry-seven.vercel.app/docs).

---

## Repository layout

```
.
├── packages/
│   ├── contracts/      Solidity contracts + Foundry tests (62 pass)
│   ├── sdk/            TypeScript SDK — @agent-registry/sdk
│   ├── subgraph/       The Graph subgraph (event indexer)
│   └── shared/         Types, ABIs, constants
├── docs/               Concepts, architecture, limitations, white paper
├── LICENSE             MIT
└── README.md           You are here
```

## License

MIT — see [LICENSE](LICENSE). Pull requests welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).
