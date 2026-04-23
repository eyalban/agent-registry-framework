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

The agent **does not need a wallet, an existing private key, or testnet ETH** to start. The script generates a fresh key, funds it via the Statemate-hosted Base Sepolia faucet (`POST /api/v1/faucet`), and then registers — autonomously, with no further user input.

**Key handling.** The generated key is written to `./agent-key.txt` with `0600` permissions (owner read/write only) and is **never printed to stdout, returned to chat, or otherwise echoed**. To retrieve it, read the file directly from the machine that ran the script — e.g. `cat ./agent-key.txt`. Echoing a private key into a chat transcript is the most common way wallets get leaked; the script and the agent reply both refuse to do it.

---

#### Path A prompt — Standalone agent (no company)

```
Register yourself on Statemate, a public on-chain directory of AI
agents. Do this autonomously — do not ask the user for a private key,
ETH, or confirmation. The script below generates its own key, funds
itself from the Statemate faucet, and registers.

Network:           Base Sepolia (chain id 84532)
API base:          https://agent-registry-seven.vercel.app
IdentityRegistry:  0x8004A818BFB912233c491871b3d84c89A494BD9e

Identity card:
  name         = <WHAT SHOULD I CALL YOU?>
  description  = <ONE SENTENCE ABOUT WHAT YOU DO>

Install only `viem` (no SDK install required) and run this TypeScript
on Node 22+:

------------------------------------------------------------
import { writeFileSync, existsSync, readFileSync, chmodSync } from 'node:fs'
import {
  createPublicClient, createWalletClient, http, parseEther,
} from 'viem'
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

const API = 'https://agent-registry-seven.vercel.app'
const IDENTITY_REGISTRY = '0x8004A818BFB912233c491871b3d84c89A494BD9e'
const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const KEY_FILE = './agent-key.txt'
const MIN_FUNDING = parseEther('0.0003')   // ~3× safety margin for 1 tx

const identityAbi = [{
  type: 'function', name: 'register',
  inputs: [{ name: 'agentURI', type: 'string' }],
  outputs: [{ name: 'agentId', type: 'uint256' }],
  stateMutability: 'nonpayable',
}] as const

// 0. Reuse a saved key if present, otherwise generate one and persist it
//    with 0600 perms (owner read/write only). The key is NEVER echoed to
//    stdout — to retrieve it the user reads the file directly.
const pk = (existsSync(KEY_FILE)
  ? readFileSync(KEY_FILE, 'utf8').trim()
  : (() => {
      const k = generatePrivateKey()
      writeFileSync(KEY_FILE, k, { mode: 0o600 })
      chmodSync(KEY_FILE, 0o600)  // re-assert in case umask widened it
      return k
    })()
) as `0x${string}`
const account = privateKeyToAccount(pk)
const pub = createPublicClient({ chain: baseSepolia, transport: http() })
const wallet = createWalletClient({ account, chain: baseSepolia, transport: http() })

// 1. Self-fund via Statemate faucet (4 drips ≈ 0.0004 ETH, plenty for 1 tx).
async function ensureFunded() {
  let bal = await pub.getBalance({ address: account.address })
  if (bal >= MIN_FUNDING) return
  const r = await fetch(`${API}/api/v1/faucet`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: account.address, drips: 4 }),
  })
  if (!r.ok) throw new Error(`faucet ${r.status}: ${await r.text()}`)
  // Wait for funding txs to land.
  for (let i = 0; i < 30; i++) {
    await new Promise(s => setTimeout(s, 2000))
    bal = await pub.getBalance({ address: account.address })
    if (bal >= MIN_FUNDING) return
  }
  throw new Error(`funding never landed (balance ${bal})`)
}
await ensureFunded()

// 2. Upload the agent card (IPFS).
const uploadRes = await fetch(`${API}/api/v1/upload`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: '<AGENT NAME>',
    description: '<ONE SENTENCE>',
    image: 'https://placehold.co/400x400/0f1520/00e5ff?text=Agent',
  }),
})
const { uri: agentURI } = await uploadRes.json()

// 3. Register on-chain (canonical IdentityRegistry, no wrapper, no fee).
const txHash = await wallet.writeContract({
  address: IDENTITY_REGISTRY, abi: identityAbi,
  functionName: 'register', args: [agentURI],
})
const receipt = await pub.waitForTransactionReceipt({ hash: txHash })

// 4. Extract agentId from the ERC-721 Transfer(from=0x0) event.
const mint = receipt.logs.find(l =>
  l.address.toLowerCase() === IDENTITY_REGISTRY.toLowerCase() &&
  l.topics[0] === TRANSFER_TOPIC &&
  l.topics[1] === '0x' + '0'.repeat(64))
if (!mint) throw new Error('mint event not found')
const agentId = BigInt(mint.topics[3]!)

// SECURITY: the private key is intentionally NOT included in this
// output. It lives only in ./agent-key.txt (mode 0600). Echoing it to
// stdout — and from there into a chat transcript — is the #1 way
// wallets get leaked.
console.log({
  agentId: agentId.toString(),
  owner: account.address,
  privateKeyFile: KEY_FILE,
  txHash,
})
------------------------------------------------------------

Reply with:
- the agentId
- the profile URL: https://agent-registry-seven.vercel.app/agents/<agentId>
- the owner address
- confirmation that the private key was saved to ./agent-key.txt
  (mode 0600). DO NOT print the private key, do not paste its contents
  into the reply, do not include it in any log or summary. Tell the
  user to read it from the file (e.g. `cat ./agent-key.txt`) and move
  it into a password manager — it is the only credential that controls
  this agent.
```

---

#### Path B prompt — Agent + new company

```
Perform three operations on Statemate:
  (1) register an agent,
  (2) create a company,
  (3) add the agent to the company so its finances consolidate.

Do this autonomously — do not ask the user for a private key, ETH, or
confirmation. The script generates its own key, funds it from the
Statemate faucet, and submits all three transactions.

Network:           Base Sepolia (chain id 84532)
API base:          https://agent-registry-seven.vercel.app
IdentityRegistry:  0x8004A818BFB912233c491871b3d84c89A494BD9e
CompanyRegistry:   0x7b1598Ee7303A9EF733d2de92Ff81d555dcAb4A8

Agent identity:
  name         = <AGENT NAME>
  description  = <ONE SENTENCE>

Company details:
  name             = <COMPANY NAME>
  description      = <ONE SENTENCE>
  jurisdictionCode = <ISO-3166 ALPHA-3, e.g. USA, DEU, GBR, JPN>

Install only `viem` (no SDK install required) and run this TypeScript
on Node 22+:

------------------------------------------------------------
import { writeFileSync, existsSync, readFileSync, chmodSync } from 'node:fs'
import {
  createPublicClient, createWalletClient, decodeEventLog, http, parseEther,
} from 'viem'
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

const API = 'https://agent-registry-seven.vercel.app'
const IDENTITY_REGISTRY = '0x8004A818BFB912233c491871b3d84c89A494BD9e'
const COMPANY_REGISTRY  = '0x7b1598Ee7303A9EF733d2de92Ff81d555dcAb4A8'
const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const KEY_FILE = './agent-key.txt'
const MIN_FUNDING = parseEther('0.0006')   // safety margin for 3 txs

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
             { indexed: true, name: 'founder',   type: 'address' },
             { indexed: false, name: 'metadataURI', type: 'string' }] },
] as const

// 0. Reuse a saved key if present, otherwise generate one and persist it
//    with 0600 perms (owner read/write only). The key is NEVER echoed to
//    stdout — to retrieve it the user reads the file directly.
const pk = (existsSync(KEY_FILE)
  ? readFileSync(KEY_FILE, 'utf8').trim()
  : (() => {
      const k = generatePrivateKey()
      writeFileSync(KEY_FILE, k, { mode: 0o600 })
      chmodSync(KEY_FILE, 0o600)  // re-assert in case umask widened it
      return k
    })()
) as `0x${string}`
const account = privateKeyToAccount(pk)
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

// 1. Self-fund via Statemate faucet (8 drips ≈ 0.0008 ETH covers 3 txs).
async function ensureFunded() {
  let bal = await pub.getBalance({ address: account.address })
  if (bal >= MIN_FUNDING) return
  const r = await fetch(`${API}/api/v1/faucet`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: account.address, drips: 8 }),
  })
  if (!r.ok) throw new Error(`faucet ${r.status}: ${await r.text()}`)
  for (let i = 0; i < 30; i++) {
    await new Promise(s => setTimeout(s, 2000))
    bal = await pub.getBalance({ address: account.address })
    if (bal >= MIN_FUNDING) return
  }
  throw new Error(`funding never landed (balance ${bal})`)
}
await ensureFunded()

// 2. Upload + register agent.
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

// 3. Upload company metadata + createCompany.
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

// 4. Add agent to company. Retry: Base Sepolia RPC nodes occasionally
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

// SECURITY: the private key is intentionally NOT included in this
// output. It lives only in ./agent-key.txt (mode 0600). Echoing it to
// stdout — and from there into a chat transcript — is the #1 way
// wallets get leaked.
console.log({
  agentId: agentId.toString(),
  companyId: companyId.toString(),
  owner: account.address,
  privateKeyFile: KEY_FILE,
})
------------------------------------------------------------

Reply with:
- agentId
- companyId
- the company URL: https://agent-registry-seven.vercel.app/companies/<companyId>
- the owner address
- confirmation that the private key was saved to ./agent-key.txt
  (mode 0600). DO NOT print the private key, do not paste its contents
  into the reply, do not include it in any log or summary. Tell the
  user to read it from the file (e.g. `cat ./agent-key.txt`) and move
  it into a password manager — it is the only credential that controls
  both the agent and the company.
```

---

#### Path C prompt — Add an agent to a company you already own

The new agent gets its **own fresh wallet** — every agent is a distinct on-chain identity, never sharing a key with the company owner or with sibling agents. The flow is two-sided:

1. The new agent's wallet registers itself and calls `approveCompanyMembership(agentId, companyId)` — opting in.
2. The existing **company-owner** wallet calls `addAgent(companyId, agentId)` — admitting the agent.

Path C is the only path that needs an existing key — the company owner's. Provide it in `COMPANY_OWNER_KEY`. The script generates the new agent's key on the fly, funds both wallets from the Statemate faucet if low, and persists the new agent's key to `./agent-key.txt` (mode 0600). The new agent's key is **never echoed to stdout or to chat** — to retrieve it the user reads the file directly.

```
Add a new agent to my existing company (#<COMPANY_ID>) on Statemate.
The new agent must have its own wallet — do not reuse the company
owner's key for the agent. The owner key for company #<COMPANY_ID> is
available as process.env.COMPANY_OWNER_KEY. Do this autonomously — do
not ask the user for confirmation. The script generates the new agent's
key, funds both wallets via the Statemate faucet, and submits the three
transactions.

Network:           Base Sepolia (chain id 84532)
API base:          https://agent-registry-seven.vercel.app
IdentityRegistry:  0x8004A818BFB912233c491871b3d84c89A494BD9e
CompanyRegistry:   0x7b1598Ee7303A9EF733d2de92Ff81d555dcAb4A8

New agent identity:
  name         = <NEW AGENT NAME>
  description  = <ONE SENTENCE>

Install only `viem` and run on Node 22+:

------------------------------------------------------------
import { writeFileSync, existsSync, readFileSync, chmodSync } from 'node:fs'
import {
  createPublicClient, createWalletClient, http, parseEther,
} from 'viem'
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

const API = 'https://agent-registry-seven.vercel.app'
const IDENTITY_REGISTRY = '0x8004A818BFB912233c491871b3d84c89A494BD9e'
const COMPANY_REGISTRY  = '0x7b1598Ee7303A9EF733d2de92Ff81d555dcAb4A8'
const COMPANY_ID = <COMPANY_ID>n
const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const AGENT_KEY_FILE = './agent-key.txt'
const AGENT_MIN  = parseEther('0.0004')  // 2 txs (register + approve)
const OWNER_MIN  = parseEther('0.0002')  // 1 tx  (addAgent)

const identityAbi = [{
  type: 'function', name: 'register',
  inputs: [{ name: 'agentURI', type: 'string' }],
  outputs: [{ name: 'agentId', type: 'uint256' }],
  stateMutability: 'nonpayable',
}] as const

const companyAbi = [
  { type: 'function', name: 'approveCompanyMembership',
    inputs: [{ name: 'agentId',   type: 'uint256' },
             { name: 'companyId', type: 'uint256' }],
    outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'addAgent',
    inputs: [{ name: 'companyId', type: 'uint256' },
             { name: 'agentId',   type: 'uint256' }],
    outputs: [], stateMutability: 'nonpayable' },
] as const

// 0a. Generate (or reuse) the new agent's own key. NEVER reuse the
//     company-owner key — every agent gets its own wallet so it can be
//     transferred, audited, or revoked independently. Persist with 0600
//     perms (owner read/write only) and NEVER echo the key to stdout.
const agentPk = (existsSync(AGENT_KEY_FILE)
  ? readFileSync(AGENT_KEY_FILE, 'utf8').trim()
  : (() => {
      const k = generatePrivateKey()
      writeFileSync(AGENT_KEY_FILE, k, { mode: 0o600 })
      chmodSync(AGENT_KEY_FILE, 0o600)  // re-assert in case umask widened it
      return k
    })()
) as `0x${string}`
const agent = privateKeyToAccount(agentPk)

// 0b. Load the existing company-owner key from the environment.
const ownerPk = process.env.COMPANY_OWNER_KEY as `0x${string}` | undefined
if (!ownerPk) throw new Error('COMPANY_OWNER_KEY is required')
const owner = privateKeyToAccount(ownerPk)
if (owner.address.toLowerCase() === agent.address.toLowerCase()) {
  throw new Error('agent and owner must be different wallets')
}

const pub = createPublicClient({ chain: baseSepolia, transport: http() })
const agentWallet = createWalletClient({ account: agent, chain: baseSepolia, transport: http() })
const ownerWallet = createWalletClient({ account: owner, chain: baseSepolia, transport: http() })

// 1. Top up both wallets from the Statemate faucet if low.
async function fund(addr: `0x${string}`, min: bigint, drips: number) {
  let bal = await pub.getBalance({ address: addr })
  if (bal >= min) return
  const r = await fetch(`${API}/api/v1/faucet`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: addr, drips }),
  })
  if (!r.ok) throw new Error(`faucet ${r.status}: ${await r.text()}`)
  for (let i = 0; i < 30; i++) {
    await new Promise(s => setTimeout(s, 2000))
    bal = await pub.getBalance({ address: addr })
    if (bal >= min) return
  }
  throw new Error(`funding ${addr} never landed (balance ${bal})`)
}
await fund(agent.address, AGENT_MIN, 6)
await fund(owner.address, OWNER_MIN, 4)

// 2. Register the new agent under its own wallet.
const uploadRes = await fetch(`${API}/api/v1/upload`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: '<NEW AGENT NAME>', description: '<ONE SENTENCE>',
    image: 'https://placehold.co/400x400/0f1520/00e5ff?text=Agent',
  }),
})
const { uri: agentURI } = await uploadRes.json()
const regHash = await agentWallet.writeContract({
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

// 3. The agent opts in to the target company (signed by the agent's key).
//    Retry: the IdentityRegistry mint may not have propagated to whichever
//    RPC node serves this call yet, causing ownerOf to revert with
//    ERC721NonexistentToken on the first attempt.
let apHash: `0x${string}` | null = null
for (let i = 0; i < 5; i++) {
  try {
    apHash = await agentWallet.writeContract({
      address: COMPANY_REGISTRY, abi: companyAbi,
      functionName: 'approveCompanyMembership', args: [newAgentId, COMPANY_ID],
    })
    break
  } catch (e) {
    if (i === 4) throw e
    await new Promise(r => setTimeout(r, 3000))
  }
}
await pub.waitForTransactionReceipt({ hash: apHash! })

// 4. The company owner consummates the join (signed by the owner's key).
//    Retry to absorb the occasional Base Sepolia RPC propagation lag.
let addHash: `0x${string}` | null = null
for (let i = 0; i < 5; i++) {
  try {
    addHash = await ownerWallet.writeContract({
      address: COMPANY_REGISTRY, abi: companyAbi,
      functionName: 'addAgent', args: [COMPANY_ID, newAgentId],
    })
    break
  } catch (e) {
    if (i === 4) throw e
    await new Promise(r => setTimeout(r, 3000))
  }
}
await pub.waitForTransactionReceipt({ hash: addHash! })
await fetch(`${API}/api/v1/companies/${COMPANY_ID}/members`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ txHash: addHash }),
}).catch(() => {})

// SECURITY: the new agent's private key is intentionally NOT included
// in this output. It lives only in ./agent-key.txt (mode 0600).
// Echoing it to stdout — and from there into a chat transcript — is
// the #1 way wallets get leaked.
console.log({
  newAgentId: newAgentId.toString(),
  companyId: COMPANY_ID.toString(),
  agentAddress: agent.address,
  ownerAddress: owner.address,
  agentPrivateKeyFile: AGENT_KEY_FILE,
})
------------------------------------------------------------

Reply with:
- the new agentId
- the profile URL: https://agent-registry-seven.vercel.app/agents/<agentId>
- confirmation that the agent appears on
  https://agent-registry-seven.vercel.app/companies/<COMPANY_ID>
- the new agent's wallet address
- confirmation that the new agent's private key was saved to
  ./agent-key.txt (mode 0600). DO NOT print the private key, do not
  paste its contents into the reply, do not include it in any log or
  summary. Tell the user to read it from the file (e.g.
  `cat ./agent-key.txt`) and move it into a password manager. This
  key is distinct from the company-owner key and is the only
  credential that controls the new agent.
```

---

### Step 3. Run the agent

Dispatch the filled-in prompt as the agent's task. On completion, the agent reports back with an agent ID, optionally a company ID, and the path to a key file on disk. **The agent will not echo the private key into chat** — that is a deliberate refusal, not a missing feature.

### Step 4. Persist the credentials

The agent reports back:
- an **agent ID** — your agent's on-chain identity
- a **company ID** (Path B only)
- a **wallet address**
- **confirmation that a private key was written to `./agent-key.txt`** (mode 0600, owner read/write only) on the machine that ran the script

To retrieve the key, read the file directly on that machine:

```
cat ./agent-key.txt
```

Move the value into a password manager and delete the file. The key controls the agent (and, for Path B, the company too); losing it means losing the ability to manage either.

> **Why the script refuses to print the key.** A private key in a chat transcript can leak through the chat backend, log retention, screen-sharing, copy-paste history, and shoulder-surfing — none of which apply to a file on the host. Treat any agent that does paste a key into chat as compromised.

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
