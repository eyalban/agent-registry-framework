# Quickstart

Five-minute setup for developers integrating the framework. Longer than the README snippet; shorter than a full tutorial.

## Prerequisites

- [Node.js](https://nodejs.org) 20 or newer
- [pnpm](https://pnpm.io) 10 or newer
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (only if you want to build / test / deploy contracts)
- A Base Sepolia RPC URL — the public `https://sepolia.base.org` works for light use; Alchemy or QuickNode for anything serious
- (Optional) [Coinbase CDP](https://portal.cdp.coinbase.com/) free API keys — used by the autonomous deploy scripts to fund a fresh deployer wallet from the testnet faucet

## 1. Use the SDK against the already-deployed contracts

If you just want to read or write against the existing Base Sepolia deployment, skip cloning this repo entirely:

```bash
mkdir my-agent-app && cd my-agent-app
npm init -y
npm install @agent-registry/sdk viem
```

Minimal read example (`get-invoice.ts`):

```ts
import { AgentRegistryClient } from '@agent-registry/sdk'

const client = new AgentRegistryClient({ chain: 'base-sepolia' })

const invoice = await client.invoice.getInvoice(1n)
console.log(invoice)
```

```bash
npx tsx get-invoice.ts
```

For writes, supply a `WalletClient` from `viem` or `wagmi`. See the README for a worked example.

## 2. Clone the framework repo

Only needed if you want to run contract tests, deploy your own, or hack on the framework itself.

```bash
git clone https://github.com/eyalban/agent-registry-framework.git
cd agent-registry
pnpm install
```

All packages build automatically via Turborepo.

## 3. Run the contract test suite

```bash
cd packages/contracts
forge test
```

You should see `62 tests passed`. Breakdown: 16 wrapper tests, 25 `CompanyRegistry` tests, 21 `InvoiceRegistry` tests. If a test fails, please open an issue.

## 4. (Optional) Deploy the contracts yourself

If you want your own deployment (different chain, fresh state, etc.), pick one of the two paths below.

### Option A — Autonomous deploy with CDP faucet (testnet only)

```bash
cd packages/contracts
cp .env.example .env                      # if present; otherwise create
# Put CDP_API_KEY_ID and CDP_API_KEY_SECRET in .env (free: portal.cdp.coinbase.com)

npx tsx script/autonomous-deploy-company.ts
# → generates a fresh wallet, drips testnet ETH, deploys CompanyRegistry,
#   prints the address and the deployer private key (persist it!)

npx tsx script/autonomous-deploy-invoice.ts
# → same flow, deploys InvoiceRegistry
```

Copy the printed addresses; you'll reference them in whatever app consumes the framework.

### Option B — Deploy with your own private key

```bash
cd packages/contracts
DEPLOYER_PRIVATE_KEY=0x… forge script script/DeployCompanyRegistry.s.sol \
    --rpc-url base_sepolia --broadcast

DEPLOYER_PRIVATE_KEY=0x… forge script script/DeployInvoiceRegistry.s.sol \
    --rpc-url base_sepolia --broadcast
```

The deployer needs enough Base Sepolia ETH to cover gas (~0.002 ETH). Get it from the [CDP faucet](https://portal.cdp.coinbase.com/products/faucet) or [Base faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet).

### Telling the SDK about your deployment

The SDK reads addresses from `packages/shared/src/constants/addresses.ts`. The new contract addresses are taken from `NEXT_PUBLIC_COMPANY_REGISTRY_ADDRESS` and `NEXT_PUBLIC_INVOICE_REGISTRY_ADDRESS` environment variables at runtime. If you're building a separate app, set those env vars in your deployment:

```bash
export NEXT_PUBLIC_COMPANY_REGISTRY_ADDRESS=0xYour…
export NEXT_PUBLIC_INVOICE_REGISTRY_ADDRESS=0xYour…
```

(The naming is `NEXT_PUBLIC_*` because this framework's reference UI is Next.js — the SDK just picks up the env var; the prefix doesn't mean you have to use Next.js.)

## 5. (Optional) Deploy the subgraph

```bash
cd packages/subgraph

# One-time: create a subgraph slug on The Graph Studio (free for testnets)
graph auth --studio <DEPLOY_KEY>

# Edit subgraph.yaml — set the `address:` and `startBlock:` for
# CompanyRegistry / InvoiceRegistry to match your deployment.

graph codegen
graph build
graph deploy --studio <YOUR-SUBGRAPH-NAME>
```

The subgraph gives you GraphQL queries across all events. The SDK does not require it — direct contract reads work without it.

## 6. Troubleshooting

- **`Transaction reverted: NotAgentOwner`** when calling `addAgent` — you must own the agent in the canonical ERC-8004 Identity Registry. Register the agent first (via `registerAgent` on the wrapper).
- **`Transaction reverted: WrongAmount`** when paying an invoice — `msg.value` for ETH invoices or `approve`-d amount for ERC-20 invoices must equal `amount` exactly.
- **ERC-20 payment fails with "allowance too low"** — you must call `token.approve(invoiceRegistryAddress, amount)` from the payer wallet before `payInvoiceERC20`.
- **CDP faucet rate-limited** — retry after 60 seconds. The autonomous deploy scripts back off automatically.
- **Subgraph "address not found"** — you likely pointed it at a contract that wasn't deployed on the network your subgraph manifest declares. Verify with `cast code $ADDRESS --rpc-url base_sepolia`.

## Where to go next

- [CONCEPTS.md](CONCEPTS.md) — plain-English primitives reference
- [ARCHITECTURE.md](ARCHITECTURE.md) — deep technical reference
- [LIMITATIONS.md](LIMITATIONS.md) — what's not supported yet + roadmap
- [`packages/sdk/src/`](../packages/sdk/src) — the typed SDK surface is the best API reference
