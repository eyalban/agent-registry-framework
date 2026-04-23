# Limitations

Honest, organized list of what the framework does **not** do, along with why and (where applicable) the planned fix.

## Security

### No external audit

The contracts in this repo have **not** been audited. Test coverage is 62/62 in Foundry with a mix of unit and fuzz tests, but that is not a substitute for an external review.

`InvoiceRegistry.payInvoiceETH` and `payInvoiceERC20` handle real user funds — any bug there is a direct loss. **Do not deploy to a mainnet or handle production funds before an audit.**

**Status.** Pre-audit. Budget for an audit is a prerequisite for mainnet deployment. Internal security review + Slither/Mythril static analysis are on the roadmap as interim checks.

### Single-EOA company ownership

`CompanyRegistry` uses a single EOA as the company owner. Whoever holds that private key can add/remove members, change the metadata URI, and transfer ownership. There is no multi-sig, no time-lock, no role-based access control.

**Status.** v1.1 roadmap: make the `companyOwner` slot generic (any contract or EOA), which would let users point it at a Gnosis Safe or their own access-control contract.

### Company metadata is self-asserted

The `metadataURI` (containing name, description, jurisdiction, logo) is whatever the caller supplies. Nobody verifies a company's claimed jurisdiction corresponds to real-world legal status.

**Status.** Intentional — the framework makes no claim about legal validity of a company. Downstream consumers (e.g. marketplaces) can add their own verification (KYB, domain proof, etc.).

### Invoice memo tampering at creation time

`memoHash` is stored on-chain, guaranteeing the memo cannot be edited *after* issuance. But a malicious issuer can put anything they want into the memo at creation. If the payer pays and later disputes the memo's accuracy, the on-chain record shows what was there — it doesn't prove the memo was truthful.

**Status.** By design. Trust is external to the framework; reputation on the agent's ERC-8004 identity is how this is mitigated in practice.

## Tax + accounting

### Single effective rate per period

The tax resolver produces one rate per company per period and multiplies it by operating profit. No progressive brackets, deductions, credits, NOL carryforwards, or jurisdictional apportionment.

**Status.** Intentional for v1. A real tax engine (bracket modeling, credit modeling) is a substantial project and out of scope.

### OECD seed covers ~38 jurisdictions

The bundled `tax_rates` seed covers major OECD members. Companies in jurisdictions not covered (many African, Middle-Eastern, Central Asian, and small-island nations) must provide an effective-rate override or the app refuses to compute tax.

**Status.** Add more jurisdictions in the reference-implementation seed by hand; PRs welcome in the reference repo. A live OECD fetcher (rather than a committed snapshot) is a nice-to-have.

### No off-chain vendor integrations

Off-chain costs (AWS, OpenAI, Anthropic, Vercel, etc.) must be imported manually — either a single record via the API or a bulk CSV upload. We don't auto-pull from vendor billing APIs.

**Status.** Roadmap. Priority integrations: OpenAI, Anthropic, Vercel, AWS Cost Explorer. Each is a small adapter that calls the existing `POST /api/v1/companies/:id/costs` endpoint.

### Retained earnings depend on every closed period

The balance sheet's retained earnings line is `sum of net_income across all closed periods`. If any single period can't compute tax (no resolvable rate), that period's net income is `null` and retained earnings become `null` too — the whole balance sheet then shows "Reconciliation skipped".

**Status.** Intentional: rather than silently omitting a period's tax, we refuse to produce an equity number we can't back. If this bites you, add a tax override.

## Token support

### ETH + USDC only

The whitelisted tokens per chain live in `packages/shared/src/constants/tokens.ts`. For Base and Base Sepolia that's currently `ETH` and `USDC`. ERC-20 transfers of any other token are ignored during sync and don't appear on statements.

**Status.** Adding a token requires (1) an entry in `tokens.ts`, (2) ideally a Chainlink `X/USD` feed, (3) a CoinGecko id for historical fallback. PRs accepted for any commonly-used stablecoin or major L2-native token.

### No cross-chain accounting

Each chain has its own `CompanyRegistry` and `InvoiceRegistry` deployment. Companies on Base and companies on Optimism are separate entities with no relationship, even if the same person owns both. Financials don't consolidate across chains.

**Status.** Cross-chain company consolidation is a research problem — at minimum needs a canonical "company id space" that spans chains, plus bridging logic for invoices. Not planned for v1.

## Indexing + data freshness

### Historical balance sheet requires archive RPC

`computeCompanyBalanceSheet(asOf)` with a past date calls `getBalance` / `balanceOf` at that block. Non-archive RPCs (including the default public Base Sepolia endpoint) may reject those calls. Without archive access, balance sheet falls back to latest balances — and the `asOf` parameter is effectively ignored for the cash line.

**Status.** Configure `ARCHIVE_RPC_URL` (Alchemy / QuickNode / Infura) for historical queries. Documented but not hard-wired.

### Subgraph is optional but recommended for high-volume reads

The SDK reads directly from the contracts. For applications doing many historical reads (e.g. "show me every invoice paid in Q1"), the direct-contract approach gets expensive — fetching every `Transfer` event requires scanning logs range by range.

**Status.** Deploy the included subgraph. It indexes all events and gives you GraphQL pagination. Required for the reference web app's company list view at scale.

### Postgres mirror is a reference pattern, not a package

The reference web app uses a Neon Postgres database as a queryable mirror of the subgraph + direct reads. The mirror code lives in the reference-implementation repository, not this framework repo, and is not published as an npm package. Consumers who want the same "write after event verification" guarantee must adopt the pattern in their own server code.

**Status.** Extracting `@agent-registry/accounting` as a standalone server-side package is a v1.1 item.

## UX / protocol

### ERC-20 invoice payment needs two transactions

`payInvoiceERC20` uses `transferFrom`, so the payer must first call `token.approve(invoiceRegistry, amount)`. That's two txs, two gas costs, two signing popups.

**Status.** USDC on Base mainnet supports EIP-2612 `permit` (gasless signed approvals). Adding a `payInvoiceERC20WithPermit` variant that takes an off-chain signature is a small, well-scoped v1.1 task.

### No invoice versioning / amendments

Once an invoice is `Issued`, you can only `Pay` or `Cancel` it. You can't edit the amount, memo, or payer. If you need to change something, cancel and re-issue.

**Status.** By design. An "amend" operation would undermine the integrity guarantee the `memoHash` provides.

### No recurring / subscription invoices

Each invoice is a single payment. Subscription billing (monthly auto-renewing invoices) would need a higher-level protocol — a `SubscriptionRegistry` contract that periodically emits new `Invoice`s.

**Status.** Not in scope. Could be built as a separate contract consuming this framework; happy to review a design if anyone's interested.

### No invoice streaming

Large invoices aren't streamable. You can't pay a $10k invoice $100/day over 100 days.

**Status.** Out of scope. If needed, look at [Sablier](https://sablier.com) and integrate externally.

## Observability

### No in-framework metrics

The framework doesn't ship with a Prometheus exporter, OpenTelemetry hooks, or anything similar. Consumers instrument at their own layer.

**Status.** Intentional — tracing decisions belong in the application, not the library.

### Subgraph lag

Subgraph indexing typically trails head by ~10 seconds on Base Sepolia (can be longer under load). Apps should always offer a "read directly from contract" fallback for critical read-after-write UX paths.

**Status.** A property of The Graph, not something we can fix. The reference web app mirrors state to Postgres *synchronously* (via `POST /api/v1/companies` which takes a `txHash` and decodes the receipt) so UI updates don't wait on the subgraph.

## Roadmap summary

Items we would pick up next, in rough priority order:

1. External audit of `CompanyRegistry` + `InvoiceRegistry` → mainnet deployment
2. Extract `@agent-registry/accounting` as a published server-side package
3. Multi-sig / contract-ownable companies (replace EOA-only owner)
4. EIP-2612 `permit` support for one-tx USDC invoice payment
5. Vendor cost adapters (OpenAI, Anthropic, AWS, Vercel) that POST to the costs API
6. Live OECD fetcher to replace the committed seed
7. EAS-attested financial statements (period close → attestation → queryable via EAS)
8. ZK proofs of financial health ("revenue > $X" without revealing the number)
9. Cross-chain company consolidation

Contributions welcome on any of these.
