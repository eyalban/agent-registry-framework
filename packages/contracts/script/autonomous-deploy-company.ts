/**
 * Autonomous Deployment for CompanyRegistry
 * ==========================================
 * Mirrors autonomous-deploy.ts but targets the CompanyRegistry contract.
 * Generates a deployer wallet, funds it via CDP faucet, and deploys.
 *
 * Usage:
 *   npx tsx script/autonomous-deploy-company.ts
 */

import { execSync } from 'child_process'
import { resolve } from 'path'
import { config as dotenvConfig } from 'dotenv'

const CONTRACT_DIR = resolve(import.meta.dirname ?? __dirname, '..')

dotenvConfig({ path: resolve(CONTRACT_DIR, '.env') })
const RPC_URL = process.env.RPC_URL ?? 'https://sepolia.base.org'
const IDENTITY_REGISTRY = '0x8004A818BFB912233c491871b3d84c89A494BD9e'
const FAUCET_DRIPS = 30 // ~0.003 ETH; CompanyRegistry is cheaper than Wrapper.

function log(msg: string): void {
  console.log(`\x1b[32m[DEPLOY]\x1b[0m ${msg}`)
}
function warn(msg: string): void {
  console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`)
}
function err(msg: string): void {
  console.error(`\x1b[31m[ERROR]\x1b[0m ${msg}`)
}
function run(cmd: string): string {
  return execSync(cmd, { encoding: 'utf-8', cwd: CONTRACT_DIR }).trim()
}
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function getOrCreateWallet(): { address: string; privateKey: string } {
  if (process.env.DEPLOYER_PRIVATE_KEY) {
    const address = run(`cast wallet address "${process.env.DEPLOYER_PRIVATE_KEY}"`)
    log(`Using existing wallet: ${address}`)
    return { address, privateKey: process.env.DEPLOYER_PRIVATE_KEY }
  }
  log('Generating new deployer wallet...')
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
  if (!keyId || !keySecret) {
    throw new Error('CDP_API_KEY_ID + CDP_API_KEY_SECRET required (see contracts/.env).')
  }

  log(`Requesting ${FAUCET_DRIPS} faucet drips (~${FAUCET_DRIPS * 0.0001} ETH)...`)
  const { CdpClient } = await import('@coinbase/cdp-sdk')
  const cdp = new CdpClient({ apiKeyId: keyId, apiKeySecret: keySecret })

  let successCount = 0
  let failCount = 0
  for (let i = 0; i < FAUCET_DRIPS; i++) {
    try {
      await cdp.evm.requestFaucet({ address, network: 'base-sepolia', token: 'eth' })
      successCount++
      if (successCount % 10 === 0) log(`  ${successCount}/${FAUCET_DRIPS} drips`)
    } catch {
      failCount++
      if (failCount > 5) {
        warn(`Too many failures (${failCount}). Proceeding with ${successCount}.`)
        break
      }
      await sleep(2000)
    }
  }

  log(`Faucet complete: ${successCount} drips`)
  await sleep(5000)
  const balance = run(`cast balance "${address}" --rpc-url "${RPC_URL}"`)
  const balanceEth = run(`cast from-wei "${balance}"`)
  log(`Wallet balance: ${balanceEth} ETH`)
  if (balance === '0') throw new Error('Wallet has 0 balance after faucet')
}

function deploy(privateKey: string, rpcUrl: string): string {
  log('Building contracts...')
  run('forge build --silent')

  log('Deploying CompanyRegistry...')
  const output = run(
    `DEPLOYER_PRIVATE_KEY="${privateKey}" forge script script/DeployCompanyRegistry.s.sol ` +
      `--rpc-url "${rpcUrl}" --broadcast 2>&1`,
  )

  const match = output.match(/CompanyRegistry deployed at:\s*(0x[a-fA-F0-9]{40})/)
  if (!match?.[1]) {
    console.log(output)
    throw new Error('Could not extract CompanyRegistry address')
  }
  return match[1]
}

async function main(): Promise<void> {
  console.log('='.repeat(55))
  console.log('  Autonomous CompanyRegistry Deployment — Base Sepolia')
  console.log('='.repeat(55))
  console.log()

  const { address, privateKey } = getOrCreateWallet()
  await fundViaCDP(address)
  const companyRegistry = deploy(privateKey, RPC_URL)

  console.log()
  console.log('='.repeat(55))
  console.log('  Deployment Complete!')
  console.log('='.repeat(55))
  console.log(`  CompanyRegistry: ${companyRegistry}`)
  console.log(`  Identity Reg:    ${IDENTITY_REGISTRY}`)
  console.log(`  Deployer:        ${address}`)
  console.log(`  Explorer:        https://sepolia.basescan.org/address/${companyRegistry}`)
  console.log('='.repeat(55))
  console.log()
  console.log('Next steps:')
  console.log(`  1. Add to apps/web/.env.local:`)
  console.log(`     NEXT_PUBLIC_COMPANY_REGISTRY_ADDRESS=${companyRegistry}`)
}

main().catch((e) => {
  err((e as Error).message)
  process.exit(1)
})
