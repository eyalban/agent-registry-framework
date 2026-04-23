/**
 * Autonomous deployment of InvoiceRegistry to Base Sepolia.
 */

import { execSync } from 'child_process'
import { resolve } from 'path'
import { config as dotenvConfig } from 'dotenv'

const CONTRACT_DIR = resolve(import.meta.dirname ?? __dirname, '..')
dotenvConfig({ path: resolve(CONTRACT_DIR, '.env') })
const RPC_URL = process.env.RPC_URL ?? 'https://sepolia.base.org'
const FAUCET_DRIPS = 25

function log(m: string): void { console.log(`\x1b[32m[DEPLOY]\x1b[0m ${m}`) }
function warn(m: string): void { console.log(`\x1b[33m[WARN]\x1b[0m ${m}`) }
function err(m: string): void { console.error(`\x1b[31m[ERROR]\x1b[0m ${m}`) }
function run(cmd: string): string { return execSync(cmd, { encoding: 'utf-8', cwd: CONTRACT_DIR }).trim() }
function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)) }

function getOrCreateWallet(): { address: string; privateKey: string } {
  if (process.env.DEPLOYER_PRIVATE_KEY) {
    const address = run(`cast wallet address "${process.env.DEPLOYER_PRIVATE_KEY}"`)
    return { address, privateKey: process.env.DEPLOYER_PRIVATE_KEY }
  }
  const output = run('cast wallet new')
  const address = output.match(/Address:\s+(0x[a-fA-F0-9]{40})/)?.[1]
  const privateKey = output.match(/Private key:\s+(0x[a-fA-F0-9]{64})/)?.[1]
  if (!address || !privateKey) throw new Error('Failed to parse wallet output')
  log(`Generated wallet: ${address}`)
  return { address, privateKey }
}

async function fundViaCDP(address: string): Promise<void> {
  const keyId = process.env.CDP_API_KEY_ID
  const keySecret = process.env.CDP_API_KEY_SECRET
  if (!keyId || !keySecret) throw new Error('CDP keys required')
  const { CdpClient } = await import('@coinbase/cdp-sdk')
  const cdp = new CdpClient({ apiKeyId: keyId, apiKeySecret: keySecret })
  let ok = 0
  let fail = 0
  for (let i = 0; i < FAUCET_DRIPS; i++) {
    try {
      await cdp.evm.requestFaucet({ address, network: 'base-sepolia', token: 'eth' })
      ok++
    } catch {
      fail++
      if (fail > 5) {
        warn(`${fail} failures, stopping`)
        break
      }
      await sleep(1500)
    }
  }
  log(`Faucet: ${ok} drips`)
  await sleep(5000)
  const bal = run(`cast balance "${address}" --rpc-url "${RPC_URL}"`)
  if (bal === '0') throw new Error('0 balance after drips')
}

function deploy(privateKey: string): string {
  run('forge build --silent')
  const output = run(
    `DEPLOYER_PRIVATE_KEY="${privateKey}" forge script script/DeployInvoiceRegistry.s.sol ` +
      `--rpc-url "${RPC_URL}" --broadcast 2>&1`,
  )
  const match = output.match(/InvoiceRegistry deployed at:\s*(0x[a-fA-F0-9]{40})/)
  if (!match?.[1]) {
    console.log(output)
    throw new Error('Could not extract deployed address')
  }
  return match[1]
}

async function main(): Promise<void> {
  const { address, privateKey } = getOrCreateWallet()
  await fundViaCDP(address)
  const invoiceAddr = deploy(privateKey)
  console.log()
  console.log('InvoiceRegistry deployed:', invoiceAddr)
  console.log('Explorer:', `https://sepolia.basescan.org/address/${invoiceAddr}`)
  console.log('')
  console.log('Add to apps/web/.env.local:')
  console.log(`  NEXT_PUBLIC_INVOICE_REGISTRY_ADDRESS=${invoiceAddr}`)
}

main().catch((e) => {
  err((e as Error).message)
  process.exit(1)
})
