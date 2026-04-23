# Financial Infrastructure for Agentic Companies

*Framework white paper · MIT Media Lab AI Studio · Spring 2026*

## Abstract

Autonomous AI agents are transacting — paying for compute, calling each other's APIs, selling services — at rapidly growing scale. Each platform today reinvents identity, payment, and accounting in isolation. This paper describes an open-source framework that provides these as shared on-chain primitives: portable identity via ERC-8004, grouped entities ("agentic companies"), atomic on-chain invoicing, and a provenance-first accounting toolkit that produces audited income statements and balance sheets. Every numeric output in the system is traceable to a named source — an on-chain event, an OECD dataset revision, a Chainlink round, a CoinGecko endpoint. We argue this *provenance-first* stance is structurally impossible for Web2 accounting software and is the core contribution the on-chain approach makes to agent financial infrastructure.

## 1. Motivation

Three trends are converging:

1. **Agent autonomy is increasing.** Multi-step agents (LangChain, AutoGPT, Claude's computer use, OpenAI Assistants) take economic actions — API calls, payments, purchases — with decreasing human oversight per action.
2. **Agent-to-agent payments are arriving.** x402 reuses HTTP 402 to let APIs demand payment inline with requests; Coinbase's Smart Wallet + Paymaster ecosystem lets agents hold and spend funds; stablecoins on L2s bring transaction fees under a cent.
3. **No shared accounting layer exists.** Every agent framework reimplements its own billing, invoicing, tax, and reporting. Users who run multiple agents across multiple platforms cannot get consolidated financials — the data simply doesn't exist in one place.

The combination produces a gap: **agentic companies have no bookkeeping**. A coffee shop has QuickBooks. An agent swarm running on someone's AWS has a pile of cost reports, Stripe invoices, and Solana transfers that don't add up to any standard financial statement.

This framework proposes a thin, open, composable standard for that missing layer.

## 2. Prior art

### 2.1 ERC-8004 "Trustless Agents"

[ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) (draft) defines a canonical Identity Registry (each agent is an NFT) and Reputation Registry (structured peer feedback) on Ethereum. Our framework extends this by adding companies, invoices, and accounting primitives while preserving full ERC-8004 interoperability — any ERC-8004 agent is visible in our system, and any agent we register remains visible to other ERC-8004 tooling.

### 2.2 x402

[x402](https://www.x402.org) proposes using HTTP's `402 Payment Required` status code to let APIs request on-chain payment mid-request. It answers "how does an agent pay per call"; it does not answer "how does the agent report that payment on its financial statements". Our framework is that second layer. Integration with x402 — parsing payment metadata to drive revenue recognition — is straightforward future work.

### 2.3 Ethereum Attestation Service (EAS)

[EAS](https://attest.org) provides a general-purpose on-chain attestation primitive. Financial-statement attestations — a CFO or auditor signing "I attest these financials for Q1 2026" — are a natural use case. Our framework does not yet issue EAS attestations for computed statements; that's a v1.1 item.

### 2.4 OECD Corporate Tax Statistics

[OECD CTS](https://stats.oecd.org/Index.aspx?DataSetCode=CTS_CIT) is a public dataset of statutory corporate tax rates covering ~100 jurisdictions, updated annually. We consume a frozen snapshot of this dataset as the default tax-rate source and allow company-level overrides backed by documentation references.

### 2.5 Gaps in traditional accounting software

Products like QuickBooks, Xero, and Netsuite assume a trusted operator (the software vendor + the accountant + the tax authority) and a centralized record. Their auditability guarantees are operational: logs, role-based access, annual reviews. **They cannot offer an "every number is provenance-tagged" guarantee**, because the data they ingest (bank feeds, manual entries, vendor exports) is already detached from its original source. On-chain accounting can.

## 3. The primitives

The framework exposes five on-chain primitives and one off-chain library.

### 3.1 Identity (inherited from ERC-8004)

Every agent is an ERC-721 NFT on the `IdentityRegistry`. The token URI points to a structured JSON "agent card" describing the agent's name, skills, endpoints, and supported trust models.

### 3.2 Reputation (inherited from ERC-8004)

Clients who interacted with an agent submit structured feedback to the `ReputationRegistry`. Feedback is on-chain, addressed, and portable.

### 3.3 Company (this framework)

The `CompanyRegistry` contract lets an EOA mint a numeric `companyId` bound to:

- A `metadataURI` (IPFS JSON: name, description, jurisdiction code, logo)
- A set of member `agentId`s (enforced: caller must own each agent in the canonical registry)
- A set of treasury addresses

Events emitted on every state change. The contract holds no funds — treasuries are just addresses registered under a `companyId`.

### 3.4 Invoice (this framework)

The `InvoiceRegistry` stores `Invoice` records with `(issuer, payer, issuerCompanyId, payerCompanyId, token, amount, dueBlock, memoURI, memoHash, status)`. Payment functions (`payInvoiceETH`, `payInvoiceERC20`) move state and transfer funds atomically — the contract cannot end up in a state where the invoice is marked paid but funds didn't move.

### 3.5 Discovery wrapper (this framework)

`AgentRegistryWrapper` layers discovery tags, registration fees, featured status, and activity tracking on top of the canonical identity. It exists so the broader ERC-8004 ecosystem can evolve without fragmenting the canonical contracts.

### 3.6 Off-chain accounting library (reference)

Provenance-first computations, packaged for embedding:

- **Classifier v2.** Decodes tx calldata against known-contract ABIs; parses event logs for protocol events. Returns `{ label, confidence, source: 'calldata' | 'event' | 'heuristic', evidence }`.
- **Counterparty reconciliation.** When both sides of a tx are in the registry, cross-compares their labels. Matched if `revenue ↔ expense`; mismatched if both claim revenue; pending otherwise.
- **Price oracle.** Chainlink-first, CoinGecko-historical-fallback, cached per-block with `source` + `source_ref` provenance. Returns `null` if no source — never a hardcoded peg.
- **Tax resolver.** OECD seed + company-scoped overrides. Precedence: company override → company effective (from a filed return) → jurisdiction statutory → refuse-to-compute.
- **Income statement + balance sheet compute.** Period-aware (monthly, quarterly, YTD, total), with per-period tax lookups and sources preserved through to the rendered output.

## 4. Core contribution: provenance-first financials

The central claim of this framework is that **every number rendered in a financial statement must be traceable to a named source**. This is stronger than "accurate" or "correct"; it is an auditability guarantee.

Concretely, every USD figure in the system has three attached fields:

```
{
  value:      <number>,
  source:     'chainlink' | 'coingecko' | 'oecd' | 'company_filing' | ...,
  sourceRef:  '<feed address>@block=<n>' | '<OECD dataset revision>' | '<IPFS hash>' | ...
}
```

When no source can be produced — e.g. neither Chainlink nor CoinGecko returns a price — the system **does not fabricate a value**. It returns `null`, and downstream code is expected to surface this to the user rather than silently imputing a default.

### 4.1 Why Web2 accounting cannot match this

In traditional bookkeeping, by the time a revenue line hits the income statement, it has passed through:

1. A POS system that recorded a sale (original source)
2. A bank's clearing system that confirmed receipt
3. A Plaid feed that exposed the bank record to the accounting app
4. An accounting app that pattern-matched the entry to a revenue category
5. An accountant who may have re-categorized, adjusted, or rolled up

Each layer strips metadata. By step 5, the original provenance of "this $100 was for consulting on 2026-03-12" is gone — you have "Revenue: Services $54,200" on a P&L, and nothing about which specific sales that came from, let alone which source feeds produced the entries.

**The on-chain approach is structurally different.** Every tx is permanently recorded with full calldata, event logs, and block context. The classifier can always go back and re-derive the label from primary sources. The price oracle can always re-fetch the price at the exact block. There is no "stripped metadata" problem.

This structural difference is what makes the provenance-first stance feasible here and infeasible in Web2 accounting.

### 4.2 Release-time enforcement

The framework enforces the provenance invariant at release time via:

- A codebase grep for hardcoded financial numbers (`0\.3\b`, percentage literals, etc.) — any hit must be a test fixture, a schema enum, or a UI preference, never a live financial value.
- API response shape review: every numeric field must have an adjacent `source` or `sourceRef` (or the parent object must).
- Integration tests that assert every `computeCompanyIncomeStatement` row carries a `taxRateResolved` object or explicit null.

This is documented in [LIMITATIONS.md](LIMITATIONS.md) and [CONCEPTS.md#provenance](CONCEPTS.md#provenance).

## 5. Additional contributions

### 5.1 Cross-validated transaction labeling

Traditional bookkeeping classifies transactions unilaterally — the issuer of an invoice assigns revenue, the payer separately assigns expense, and any discrepancy surfaces only at year-end reconciliation (if at all).

When both parties to a transaction are in the same on-chain registry, their labels can be reconciled **at write time**. The framework's `tx-reconciler` writes a `tx_validations` row with status `matched`, `mismatched`, or `pending` for every cross-registry tx. Mismatches surface a visible audit flag in the UI. This is effectively **double-entry bookkeeping with every counterparty in the world** — a property that has been possible in theory but not practice for human accounting.

### 5.2 Atomic invoice settlement

`InvoiceRegistry.payInvoice*` updates invoice state (`Issued → Paid`) and transfers funds in the same EVM transaction. Accounts-receivable and accounts-payable lines on balance sheets can therefore never be stale — they derive from invoice `status`, which is guaranteed consistent with fund movement.

Compared to Stripe (where an invoice can be `paid` in Stripe's UI before the ACH settles, or vice versa), this eliminates an entire class of reconciliation bugs.

### 5.3 Minimal on-chain company primitive

Deliberately, `CompanyRegistry` holds no funds and has no advanced access-control logic (v1 is EOA-owner only). It's a pure membership registry. This keeps the attack surface tiny (25 Foundry tests cover the entire contract) and leaves treasury-custody logic to whatever governance layer (Safe multi-sig, DAO, custom contract) the user wants to put in front.

## 6. Limitations and open problems

The framework today is Base-Sepolia-only and unaudited. A full list is in [LIMITATIONS.md](LIMITATIONS.md); the research-relevant ones:

- **Cross-chain consolidation.** Companies on different chains today have no relationship. A canonical company-id space across chains + invoice bridging are both unsolved.
- **Private financial statements.** All data is public. Agents that want to keep revenue figures confidential have no mechanism yet — ZK proofs of financial health ("revenue > $X without revealing exact amounts") are a natural next step but unimplemented.
- **Tax engine depth.** The current resolver gives one rate per period. Real tax code (progressive brackets, deductions, credits, group consolidation) is a substantial future body of work.
- **Counterparty reconciliation with non-registered counterparties.** When only one side of a tx is registered, reconciliation degrades to pending. Expanding registry coverage is the brute-force solution; a protocol for untrusted-counterparty label attestation would be cleaner.

## 7. Deployment

Testnet reference deployment on Base Sepolia:

- `CompanyRegistry`: [`0xD557AF896A116bdb9A671f2eB45baAa8e521f77f`](https://sepolia.basescan.org/address/0xD557AF896A116bdb9A671f2eB45baAa8e521f77f)
- `InvoiceRegistry`: [`0x645acDD5f85B52AD0CcE55B1c4f4Ac8BA00EC0Ac`](https://sepolia.basescan.org/address/0x645acDD5f85B52AD0CcE55B1c4f4Ac8BA00EC0Ac)
- `AgentRegistryWrapper`: [`0xC02DE01B0ecBcE17c4E71fc7A0Ad86764B3DF64C`](https://sepolia.basescan.org/address/0xC02DE01B0ecBcE17c4E71fc7A0Ad86764B3DF64C)

Mainnet deployment gated on external audit.

## 8. Conclusion

AI agents are starting to behave like small companies and will soon need the accounting infrastructure companies have. This framework provides the shared primitives — identity, membership, invoices, provenance-first accounting — so that infrastructure is open, auditable, and composable rather than locked inside individual agent platforms.

The structural advantage of the on-chain approach is not that it's faster or cheaper — it often isn't — but that it makes provenance feasible in a way Web2 accounting cannot. If agentic finance grows into anything like its projected scale, that auditability will be what makes it trustworthy enough to be real infrastructure rather than a curiosity.

## References

- ERC-8004 "Trustless Agents": <https://eips.ethereum.org/EIPS/eip-8004>
- x402 protocol: <https://www.x402.org>
- Ethereum Attestation Service: <https://attest.org>
- OECD Corporate Tax Statistics: <https://stats.oecd.org/Index.aspx?DataSetCode=CTS_CIT>
- Chainlink Data Feeds on Base: <https://docs.chain.link/data-feeds/price-feeds/addresses?network=base>
- CoinGecko API: <https://www.coingecko.com/api>
- Base L2: <https://base.org>
- Framework source: this repository
- Reference implementation: [agent-registry-seven.vercel.app](https://agent-registry-seven.vercel.app) *(replace with your deployed URL)*

---

*White paper · v0.1 · Framework for agentic financial infrastructure*
