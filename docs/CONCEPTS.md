# Concepts — The Plain-English Explainer

You don't need to know what a blockchain is, or what an income statement is, to use or evaluate this project. This document assumes neither. If you know both, you can skip to [Architecture](ARCHITECTURE.md).

## Table of contents

1. [What is an "agent"?](#what-is-an-agent)
2. [What is an "agentic company"?](#what-is-an-agentic-company)
3. [Why put any of this on a blockchain?](#why-put-any-of-this-on-a-blockchain)
4. [How does an on-chain invoice work?](#how-does-an-on-chain-invoice-work)
5. [What's on the income statement and where do the numbers come from?](#income-statement)
6. [What's on the balance sheet?](#balance-sheet)
7. [Where do tax rates come from?](#tax-rates)
8. [What does "provenance-first" mean?](#provenance)
9. [What does this replace?](#what-does-this-replace)
10. [What doesn't it do?](#what-doesnt-it-do)

---

## What is an "agent"?

An **AI agent** is a software program that acts on behalf of a user or company — answering emails, writing code, trading assets, running a customer-service line. Modern agents (Claude, ChatGPT with function-calling, autonomous bots) increasingly do things that cost money: call APIs, rent compute, pay each other for services.

An **ERC-8004 agent** is that same program, plus a public, on-chain identity. Think of it like a business card that anyone can look up without asking the agent's creator for permission. The identity is an [NFT](https://ethereum.org/en/nft/) — a unique token on the Ethereum blockchain — minted by the agent's owner. It points to a JSON file (the "agent card") with the agent's name, description, skills, endpoints, and so on.

Why this matters: once an agent has a portable, public identity, other agents can find it, decide whether to trust it, and pay it — without going through a central platform.

**This project's contribution:** we let that agent do real accounting. Track revenue, pay invoices, settle taxes, produce audited financial statements.

## What is an "agentic company"?

A human company (Apple, a coffee shop) is a legal entity with employees, bank accounts, and financial reports. Its numbers are tracked together — the coffee shop doesn't report the barista's and the cashier's P&L separately.

An **agentic company** is the same idea for agents: a group of AI agents that belong to a single business, share treasury wallets, and have their financials consolidated.

Concretely, in this project:

- You create a company by signing one blockchain transaction. You become the **owner** — the only one who can add members or change metadata (for now; multi-sig is on the roadmap).
- You add **member agents** — ERC-8004 agents you also own. Their wallet activity rolls up into the company's financials.
- You add **treasury wallets** — any address whose balances count toward this company. Could be a shared ops wallet, a payroll wallet, a cold-storage vault.
- You set the company's **jurisdiction** — which country (and optionally which state/province) it's legally based in. This drives which tax rate applies.

The company itself is an on-chain record. Anyone can read it; no centralized registry can make a company "disappear".

## Why put any of this on a blockchain?

Three reasons, in order of importance:

1. **Portability.** An agent's identity and reputation aren't locked inside one platform. If we (or any other operator) shut down, the on-chain records stay — other tools can read them, other UIs can display them. No platform risk.

2. **Auditability.** Every financial event (invoice issued, invoice paid, company created, agent added) emits an on-chain event. A record that can't be retroactively edited. If someone claims "I paid you $100 for this service", there's a transaction to point at.

3. **Atomic settlement.** When agent A pays agent B, a single transaction both transfers funds *and* marks the invoice paid. There's no "I sent the money, it's in the mail" gap — either it happened or it didn't. In traditional banking, reconciling "did this invoice get paid" is a massive source of errors; on-chain, it's structurally impossible to have an invoice marked "paid" without the money having moved.

What the blockchain **doesn't** give us: names, descriptions, tax rates, prices in dollars. Those live off-chain (in our Postgres database and in public data sources like OECD). The blockchain is the backbone; the off-chain data is the context.

## How does an on-chain invoice work?

A regular invoice is a document that says "I (the issuer) am owed X by you (the payer) for this reason". Someone eventually pays it via bank transfer, the issuer marks it paid, done.

An **on-chain invoice** is a record inside our `InvoiceRegistry` smart contract. It looks like:

```
Invoice #42
  issuer:       0xAlice…
  payer:        0xBob…
  amount:       100 USDC
  memo:         "ipfs://…" (points to a human-readable description)
  status:       Issued
```

Here's the full lifecycle:

1. **Issue** — Alice calls `createInvoice(...)` with Bob's address, the amount, and a memo URI. One blockchain tx. The memo is stored off-chain (IPFS) but its SHA-256 hash is stored on-chain, so nobody can edit it after the fact.
2. **(Optional) Request** — Bob can call `requestInvoice(Alice, 100 USDC, "…")` first, which emits a "please invoice me for this" event. Alice sees the request and fulfills it.
3. **Pay** — Bob calls `payInvoiceERC20(42)` (or `payInvoiceETH` if it were an ETH invoice). In the same transaction, the contract:
   - verifies Bob approved the funds,
   - pulls `amount` from Bob,
   - sends it to Alice,
   - flips the invoice to `Paid`,
   - records the payment timestamp.
4. **Cancel** — Alice can cancel any invoice still in `Issued` state (but not a paid one). One tx.

While an invoice is `Issued`, it shows up as an **account receivable (AR)** on Alice's company balance sheet and an **account payable (AP)** on Bob's. When it flips to `Paid`, both lines clear and cash moves. When cancelled, the AR/AP simply disappears.

All of this is visible to anyone. You can go look up invoice #42 on [BaseScan](https://sepolia.basescan.org/) and see exactly when it was created, who signed, when it was paid, by whom, for how much.

## Income statement

An **income statement** (a.k.a. profit and loss, P&L) is the answer to: "How much money did you make this quarter, and where did it go?" Five lines:

- **Revenue** — what you took in.
- **Cost of Sales (COGS)** — direct cost of what you sold (protocol fees you paid, compute time consumed to run the service, LLM API costs).
- **Gross Profit** — Revenue − COGS.
- **Operating Expenses (OpEx / SG&A)** — everything else it costs to run the business (infrastructure, tooling, subscriptions).
- **Operating Profit** — Gross Profit − OpEx. The money you actually made before tax.
- **Income Tax** — what you owe the government.
- **Net Income** — Operating Profit − Tax. What you keep.

**Where the numbers come from in this product:**

| Line | Source |
|------|--------|
| Revenue | Transactions where your agent received ETH or USDC, classified as income by the classifier (see below) |
| Protocol fees (part of COGS) | Transactions where you paid the Identity / Reputation / Wrapper contract — decoded from the calldata, so we know you called `registerAgent` (a fee), `giveFeedback` (a fee), etc. |
| Compute / LLM costs (part of COGS or OpEx) | Uploaded by you as a CSV or through the API — we never estimate vendor costs |
| Tax | Looked up in the `tax_rates` table for your jurisdiction and the period in question. Statutory rates come from OECD public data. You can override with an effective rate backed by a tax filing URL or IPFS hash. No hardcoded "30%" anywhere. |

**How transactions get classified.** For every transaction, we first try to decode the calldata (the blob telling the contract what to do). If it matches a function we know (`registerAgent`, `giveFeedback`, `payInvoiceERC20`, etc.), we know exactly what happened — high confidence. If decoding fails, we look at the event logs the tx emitted — still high confidence. Only if both fail do we fall back to a simple heuristic ("incoming ETH = revenue, outgoing to a known registry = fee") — low confidence, marked as such in the UI.

**Cross-validation.** When both sides of a transaction are agents in our registry, we compare their labels. If Alice says "revenue" and Bob says "sga_expense", those are compatible (one side's income is the other's expense). If they contradict (both say "revenue"), we flag it as `mismatched` and surface it in the UI. Think double-entry bookkeeping, but with every counterparty in the world.

## Balance sheet

An **income statement** covers a period ("January 2026"). A **balance sheet** is a snapshot at a moment in time ("as of 2026-04-21 23:59"). It answers: "What do you own, what do you owe, and what's left over?"

Structure:

```
ASSETS                       LIABILITIES
  Cash (ETH)       $12,000     Accounts payable      $2,000
  Cash (USDC)      $ 8,000
  Accounts receivable $5,000  EQUITY
                               Contributed capital  $15,000
                               Retained earnings    $ 8,000
─────────────────────────    ─────────────────────────────
Total            $25,000    Total                 $25,000
```

The rule (sometimes called "the accounting equation") is `Assets = Liabilities + Equity`. Every balance sheet must balance.

**How this product computes each line:**

- **Cash (ETH / USDC)** — We read the on-chain balance of every treasury wallet and every member-agent wallet, at the requested date (or `latest` if today). Sum per token. Convert to USD using the price our oracle recorded at that block (Chainlink or CoinGecko). No peg assumed.
- **Accounts receivable** — Sum of `amount_usd_at_issue` for every invoice your company **issued** and that is still `Issued` (not paid, not cancelled).
- **Accounts payable** — Same, for invoices **received**.
- **Contributed capital** — Transfers from the company founder into a treasury or member-agent wallet, recorded in the `capital_contributions` table.
- **Retained earnings** — Cumulative net income from every closed period in the income statement, from the company's creation through the `asOf` date.

The UI shows a **reconciliation banner** telling you whether assets equal liabilities + equity within 0.1% tolerance (FX rounding). If not, it tells you why — usually a missing capital contribution record, an unimported off-chain cost, or a token without a price source.

## Tax rates

Every tax rate in this product is a real number from a real source. Never `0.3` hardcoded.

**Statutory rates** come from the [OECD Corporate Tax Statistics](https://stats.oecd.org/Index.aspx?DataSetCode=CTS_CIT) dataset — 38 jurisdictions at launch, annually refreshable. When you see "21% · oecd · effective from 2024-01-01" next to a US company's tax line, the source is literally the OECD CSV row.

**Effective-rate overrides.** Your actual tax rate is usually lower than the statutory rate, because of deductions and credits. Companies can record their true effective rate, but only with a **`sourceRef`** — a URL or IPFS hash pointing to the underlying tax filing or a CFO-signed attestation. The UI shows that source inline.

**Lookup precedence** at report time:

1. Company override (rate_type=`override`, company-scoped)
2. Company effective rate (rate_type=`effective`, from a filed return)
3. Jurisdiction statutory (rate_type=`statutory`, from OECD)
4. If none is resolvable: **tax is not computed**. The UI shows "Tax rate source required" and omits net income rather than inventing a number.

That last bullet is load-bearing. The system will refuse to fabricate a tax line rather than make one up.

## Provenance

Throughout the docs and the code, you'll see the word **provenance** — it means "every number has a named source, and you can click through to see it".

Concrete implications:

- Every transaction row carries `value_usd` (the USD equivalent) **and** `usd_price_at_block` (the price that was used) **and** `price_source` (`chainlink` or `coingecko`).
- Every `price_snapshots` row carries a `source_ref` pointing to the exact Chainlink feed address + round, or the exact CoinGecko endpoint URL.
- Every `tax_rates` row carries `source` + `source_ref` — OECD dataset revision, tax filing URL, attestation UID.
- Every `off_chain_costs` row carries `source` + `source_ref` — CSV file name, vendor invoice id, etc.
- Every company/invoice/member mirror row carries the `tx_hash` that created it — so you can verify the DB against the chain.

We enforce this with a **release checklist**: grep the codebase for hardcoded financial numbers, and make sure every numeric field in every API response has a source field. See [docs/LIMITATIONS.md](LIMITATIONS.md) for what we explicitly allow to be "configuration" rather than data.

## What does this replace?

For a human-run company, the stack usually looks like: **QuickBooks** (bookkeeping), **Stripe** / **Mercury** (payment rails), **TaxJar** (tax compliance), plus manual reconciliation glue.

For agentic companies today, there is no stack. Our project aims to be:

| Traditional tool | What we replace / enable |
|------------------|--------------------------|
| QuickBooks / Xero | On-chain-first income statement + balance sheet, with provenance |
| Stripe / bank ACH | `InvoiceRegistry` — atomic ETH/USDC invoice settlement |
| TaxJar / tax advisor | OECD-sourced statutory rates + auditable override mechanism |
| Delaware / state incorporation | `CompanyRegistry` — a minimal, portable, on-chain "LLC" primitive |
| Auditor tick-marks | Cross-validated transaction labels (counterparty reconciliation) + on-chain event provenance |

We are **not** replacing: legal incorporation (your real LLC still needs to exist in a real jurisdiction), bank accounts for fiat in/out, or human judgment about what's a reasonable expense. We're replacing the *bookkeeping and settlement plumbing*.

## What doesn't it do?

Short list — full list in [docs/LIMITATIONS.md](LIMITATIONS.md):

- **Fiat.** No USD bank integration. Everything's in ETH + USDC.
- **KYC/AML.** We don't verify identities. Anyone can create a company.
- **Progressive tax.** One effective rate per period; no brackets, credits, or deductions modeled.
- **Multi-sig.** Company owner is a single EOA today.
- **Vendor integrations.** Off-chain costs (AWS bills, OpenAI bills) are CSV-imported, not auto-pulled.
- **Runway, forecasting, unit economics.** Rear-view only; forward-looking analytics are a next step.
- **Mainnet.** Testnet only pending audit.

If any of those are showstoppers for your use case, we're probably not the right answer — yet.
