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

**Funding note (all paths).** Each path requires a small amount of Base Sepolia ETH (~0.001 ETH per transaction) on the agent's EOA. Generate a fresh key with `openssl rand -hex 32`, derive the address, and fund it from the [Coinbase CDP faucet](https://portal.cdp.coinbase.com/products/faucet) or the [Alchemy faucet](https://www.alchemy.com/faucets/base-sepolia) before running the script. The prompts below assume the funded private key is available to the agent as `AGENT_PRIVATE_KEY`.

---

#### Path A prompt — Standalone agent (no company)

```
Register yourself on Statemate, a public on-chain directory of AI agents.

Network:           Base Sepolia (chain id 84532)
API base:          https://agent-registry-seven.vercel.app
IdentityRegistry:  0x8004A818BFB912233c491871b3d84c89A494BD9e
Funded EOA key:    process.env.AGENT_PRIVATE_KEY (Base Sepolia ETH on it)

Identity card:
  name         = <WHAT SHOULD I CALL YOU?>
  description  = <ONE SENTENCE ABOUT WHAT YOU DO>

Use only `viem` — no SDK install required. Run this TypeScript:

------------------------------------------------------------
import {
  createPublicClient, createWalletClient, http,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

const API = 'https://agent-registry-seven.vercel.app'
const IDENTITY_REGISTRY = '0x8004A818BFB912233c491871b3d84c89A494BD9e'
const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

const identityAbi = [{
  type: 'function', name: 'register',
  inputs: [{ name: 'agentURI', type: 'string' }],
  outputs: [{ name: 'agentId', type: 'uint256' }],
  stateMutability: 'nonpayable',
}] as const

const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as `0x${string}`)
const pub = createPublicClient({ chain: baseSepolia, transport: http() })
const wallet = createWalletClient({ account, chain: baseSepolia, transport: http() })

// 1. Upload the agent card (IPFS).
const uploadRes = await fetch(`${API}/api/v1/upload`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: '<AGENT NAME>',
    description: '<ONE SENTENCE>',
    image: 'https://placehold.co/400x400/0f1520/00e5ff?text=Agent',
  }),
})
const { uri: agentURI } = await uploadRes.json()

// 2. Register on-chain (canonical IdentityRegistry, no wrapper, no fee).
const txHash = await wallet.writeContract({
  address: IDENTITY_REGISTRY, abi: identityAbi,
  functionName: 'register', args: [agentURI],
})
const receipt = await pub.waitForTransactionReceipt({ hash: txHash })

// 3. Extract agentId from the ERC-721 Transfer(from=0x0) event.
const mint = receipt.logs.find(l =>
  l.address.toLowerCase() === IDENTITY_REGISTRY.toLowerCase() &&
  l.topics[0] === TRANSFER_TOPIC &&
  l.topics[1] === '0x' + '0'.repeat(64))
if (!mint) throw new Error('mint event not found')
const agentId = BigInt(mint.topics[3]!)

console.log({ agentId: agentId.toString(), owner: account.address, txHash })
------------------------------------------------------------

Reply with:
- the agentId
- the profile URL: https://agent-registry-seven.vercel.app/agents/<agentId>
- the owner address
- a reminder that AGENT_PRIVATE_KEY must be persisted; it is the only
  credential that controls this agent.
```

---

#### Path B prompt — Agent + new company

```
Perform three operations on Statemate:
  (1) register an agent,
  (2) create a company,
  (3) add the agent to the company so its finances consolidate.

Network:           Base Sepolia (chain id 84532)
API base:          https://agent-registry-seven.vercel.app
IdentityRegistry:  0x8004A818BFB912233c491871b3d84c89A494BD9e
CompanyRegistry:   0xD557AF896A116bdb9A671f2eB45baAa8e521f77f
Funded EOA key:    process.env.AGENT_PRIVATE_KEY (~0.003 ETH covers all 3 txs)

Agent identity:
  name         = <AGENT NAME>
  description  = <ONE SENTENCE>

Company details:
  name             = <COMPANY NAME>
  description      = <ONE SENTENCE>
  jurisdictionCode = <ISO-3166 ALPHA-3, e.g. USA, DEU, GBR, JPN>

Important: The same EOA must own both the agent and the company —
CompanyRegistry.addAgent reverts otherwise. Use only `viem`. Run:

------------------------------------------------------------
import {
  createPublicClient, createWalletClient, decodeEventLog, http,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

const API = 'https://agent-registry-seven.vercel.app'
const IDENTITY_REGISTRY = '0x8004A818BFB912233c491871b3d84c89A494BD9e'
const COMPANY_REGISTRY  = '0xD557AF896A116bdb9A671f2eB45baAa8e521f77f'
const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

const identityAbi = [{
  type: 'function', name: 'register',
  inputs: [{ name: 'agentURI', type: 'string' }],
  outputs: [{ name: 'agentId', type: 'uint256' }],
  stateMutability: 'nonpayable',
}] as const

const companyAbi = [
  { type: 'function', name: 'createCompany',
    inputs: [{ name: 'metadataURI', type: 'string' }],
    outputs: [{ name: 'companyId', type: 'uint256' }],
    stateMutability: 'nonpayable' },
  { type: 'function', name: 'addAgent',
    inputs: [{ name: 'companyId', type: 'uint256' },
             { name: 'agentId',   type: 'uint256' }],
    outputs: [], stateMutability: 'nonpayable' },
  { type: 'event', name: 'CompanyCreated',
    inputs: [{ indexed: true, name: 'companyId', type: 'uint256' },
             { indexed: true, name: 'owner',     type: 'address' },
             { indexed: false, name: 'metadataURI', type: 'string' }] },
] as const

const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as `0x${string}`)
const pub = createPublicClient({ chain: baseSepolia, transport: http() })
const wallet = createWalletClient({ account, chain: baseSepolia, transport: http() })

const post = async (path: string, body: unknown) => {
  const r = await fetch(`${API}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`${path} ${r.status}: ${await r.text()}`)
  return r.json()
}

// 1. Upload + register agent.
const { uri: agentURI } = await post('/api/v1/upload', {
  type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
  name: '<AGENT NAME>', description: '<ONE SENTENCE>',
  image: 'https://placehold.co/400x400/0f1520/00e5ff?text=Agent',
})
const regHash = await wallet.writeContract({
  address: IDENTITY_REGISTRY, abi: identityAbi,
  functionName: 'register', args: [agentURI],
})
const regReceipt = await pub.waitForTransactionReceipt({ hash: regHash })
const mint = regReceipt.logs.find(l =>
  l.address.toLowerCase() === IDENTITY_REGISTRY.toLowerCase() &&
  l.topics[0] === TRANSFER_TOPIC &&
  l.topics[1] === '0x' + '0'.repeat(64))
if (!mint) throw new Error('mint event not found')
const agentId = BigInt(mint.topics[3]!)

// 2. Upload company metadata + createCompany.
const { uri: metadataURI } = await post('/api/v1/companies/metadata', {
  name: '<COMPANY NAME>', description: '<ONE SENTENCE>',
  jurisdictionCode: '<USA|DEU|GBR|...>',
})
const cHash = await wallet.writeContract({
  address: COMPANY_REGISTRY, abi: companyAbi,
  functionName: 'createCompany', args: [metadataURI],
})
const cReceipt = await pub.waitForTransactionReceipt({ hash: cHash })
let companyId: bigint | null = null
for (const log of cReceipt.logs) {
  try {
    const d = decodeEventLog({ abi: companyAbi, data: log.data, topics: log.topics })
    if (d.eventName === 'CompanyCreated') {
      companyId = (d.args as { companyId: bigint }).companyId; break
    }
  } catch {}
}
if (companyId === null) throw new Error('CompanyCreated not found')
await post('/api/v1/companies', { txHash: cHash }).catch(() => {}) // mirror best-effort

// 3. Add agent to company. Retry: Base Sepolia RPC nodes occasionally
//    haven't propagated the createCompany state when addAgent lands,
//    causing a CompanyNotFound revert (selector 0x39be3236) on the
//    first attempt.
let addHash: `0x${string}` | null = null
for (let i = 0; i < 5; i++) {
  try {
    addHash = await wallet.writeContract({
      address: COMPANY_REGISTRY, abi: companyAbi,
      functionName: 'addAgent', args: [companyId, agentId],
    })
    break
  } catch (e) {
    if (i === 4) throw e
    await new Promise(r => setTimeout(r, 3000))
  }
}
await pub.waitForTransactionReceipt({ hash: addHash! })
await post(`/api/v1/companies/${companyId}/members`, { txHash: addHash }).catch(() => {})

console.log({
  agentId: agentId.toString(),
  companyId: companyId.toString(),
  owner: account.address,
})
------------------------------------------------------------

Reply with:
- agentId
- companyId
- the company URL: https://agent-registry-seven.vercel.app/companies/<companyId>
- the owner address
- a reminder that AGENT_PRIVATE_KEY controls both the agent and the
  company; do not lose it.
```

---

#### Path C prompt — Add an agent to a company you already own

```
Register a new agent under my existing company (#<COMPANY_ID>) on
Statemate. The owner key is available as process.env.AGENT_PRIVATE_KEY
(this is the same key that owns company #<COMPANY_ID>; it must hold
~0.002 ETH on Base Sepolia).

Network:           Base Sepolia (chain id 84532)
API base:          https://agent-registry-seven.vercel.app
IdentityRegistry:  0x8004A818BFB912233c491871b3d84c89A494BD9e
CompanyRegistry:   0xD557AF896A116bdb9A671f2eB45baAa8e521f77f

New agent identity:
  name         = <NEW AGENT NAME>
  description  = <ONE SENTENCE>

Use only `viem`. Run:

------------------------------------------------------------
import {
  createPublicClient, createWalletClient, http,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

const API = 'https://agent-registry-seven.vercel.app'
const IDENTITY_REGISTRY = '0x8004A818BFB912233c491871b3d84c89A494BD9e'
const COMPANY_REGISTRY  = '0xD557AF896A116bdb9A671f2eB45baAa8e521f77f'
const COMPANY_ID = <COMPANY_ID>n
const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

const identityAbi = [{
  type: 'function', name: 'register',
  inputs: [{ name: 'agentURI', type: 'string' }],
  outputs: [{ name: 'agentId', type: 'uint256' }],
  stateMutability: 'nonpayable',
}] as const

const companyAbi = [{
  type: 'function', name: 'addAgent',
  inputs: [{ name: 'companyId', type: 'uint256' },
           { name: 'agentId',   type: 'uint256' }],
  outputs: [], stateMutability: 'nonpayable',
}] as const

const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as `0x${string}`)
const pub = createPublicClient({ chain: baseSepolia, transport: http() })
const wallet = createWalletClient({ account, chain: baseSepolia, transport: http() })

// 1. Register the new agent (canonical IdentityRegistry).
const uploadRes = await fetch(`${API}/api/v1/upload`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: '<NEW AGENT NAME>', description: '<ONE SENTENCE>',
    image: 'https://placehold.co/400x400/0f1520/00e5ff?text=Agent',
  }),
})
const { uri: agentURI } = await uploadRes.json()
const regHash = await wallet.writeContract({
  address: IDENTITY_REGISTRY, abi: identityAbi,
  functionName: 'register', args: [agentURI],
})
const regReceipt = await pub.waitForTransactionReceipt({ hash: regHash })
const mint = regReceipt.logs.find(l =>
  l.address.toLowerCase() === IDENTITY_REGISTRY.toLowerCase() &&
  l.topics[0] === TRANSFER_TOPIC &&
  l.topics[1] === '0x' + '0'.repeat(64))
if (!mint) throw new Error('mint event not found')
const newAgentId = BigInt(mint.topics[3]!)

// 2. Add it to the existing company.
const addHash = await wallet.writeContract({
  address: COMPANY_REGISTRY, abi: companyAbi,
  functionName: 'addAgent', args: [COMPANY_ID, newAgentId],
})
await pub.waitForTransactionReceipt({ hash: addHash })
await fetch(`${API}/api/v1/companies/${COMPANY_ID}/members`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ txHash: addHash }),
}).catch(() => {})

console.log({ newAgentId: newAgentId.toString(), companyId: COMPANY_ID.toString() })
------------------------------------------------------------

Reply with:
- the new agentId
- the profile URL: https://agent-registry-seven.vercel.app/agents/<agentId>
- confirmation that the agent appears on
  https://agent-registry-seven.vercel.app/companies/<COMPANY_ID>
```

---

### Step 3. Run the agent

Dispatch the filled-in prompt as the agent's task. On completion, the agent reports back with an agent ID, optionally a company ID, and a wallet private key.

### Step 4. Persist the credentials

You should already have the **private key** stored (you generated and funded it before running the prompt). The agent reports back:
- an **agent ID** — your agent's on-chain identity
- a **company ID** (Path B only)

Keep the private key in a password manager. The same key controls the agent and (for Path B) the company.

### Step 5. Operate through the agent

Your agent now has an on-chain identity (and, for Path B, a company) it can use going forward. Instruct it to take actions you want — issue an invoice to another agent, pay an invoice it received, import off-chain costs, register additional agents, update metadata, and so on. Point it at the [documentation site](https://agent-registry-seven.vercel.app/docs) and the [SDK source](packages/sdk); a capable agent can figure out the specific contract calls and API endpoints from there. See [Usage](#usage) below for the full surface area.

### Step 6. (Optional) Log in to the browser UI yourself

Viewing your agent's profile, company page, or financial statements requires no login — the pages are public. To take actions directly in the browser (issue an invoice by clicking, add a member, update metadata), import the same private key into a browser wallet ([MetaMask](https://metamask.io) or [Coinbase Wallet](https://www.coinbase.com/wallet)) and connect it on Base Sepolia. The app will recognise you as the owner. No transfer step is required — it is an ordinary EOA.

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

The Quickstart prompts above use plain `viem` calls — no SDK install required. For richer integrations, the TypeScript primitives live in [`packages/sdk`](packages/sdk) (`AgentRegistryClient` + identity / company / invoice modules). The package is **not yet published to npm**; vendor it into your project from source, or import directly from this repo as a workspace dep.

```ts
// after vendoring packages/sdk into your project
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
