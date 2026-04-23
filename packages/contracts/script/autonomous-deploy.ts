/**
 * Fully Autonomous Deployment Script
 * ===================================
 * This script deploys the AgentRegistryWrapper to Base Sepolia without
 * any human involvement. It:
 *
 * 1. Generates a new deployer wallet (or uses DEPLOYER_PRIVATE_KEY)
 * 2. Requests testnet ETH from Coinbase CDP faucet (multiple drips)
 * 3. Waits for the wallet to be funded
 * 4. Deploys the wrapper contract via forge
 * 5. Outputs the deployed address and updates .env
 *
 * Prerequisites:
 *   - CDP_API_KEY_ID and CDP_API_KEY_SECRET env vars (free from portal.cdp.coinbase.com)
 *   - forge installed
 *
 * Usage:
 *   npx tsx script/autonomous-deploy.ts
 *   npx tsx script/autonomous-deploy.ts --local  (Anvil fork, no CDP needed)
 */

import { execSync } from 'child_process'
import { writeFileSync, existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { config as dotenvConfig } from 'dotenv'

const CONTRACT_DIR = resolve(import.meta.dirname ?? __dirname, '..')

// Load .env from the contracts package directory
dotenvConfig({ path: resolve(CONTRACT_DIR, '.env') })
const RPC_URL = process.env.RPC_URL ?? 'https://sepolia.base.org'
const IDENTITY_REGISTRY = '0x8004A818BFB912233c491871b3d84c89A494BD9e'
const FAUCET_DRIPS = 50 // 50 x 0.0001 = 0.005 ETH (enough for deployment)

interface DeployResult {
  wrapperAddress: string
  deployerAddress: string
  deployerPrivateKey: string
  network: string
  txHash: string
}

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

// =============================================================================
// Step 1: Wallet
// =============================================================================
function getOrCreateWallet(): { address: string; privateKey: string } {
  if (process.env.DEPLOYER_PRIVATE_KEY) {
    const address = run(
      `cast wallet address "${process.env.DEPLOYER_PRIVATE_KEY}"`,
    )
    log(`Using existing wallet: ${address}`)
    return { address, privateKey: process.env.DEPLOYER_PRIVATE_KEY }
  }

  log('Generating new deployer wallet...')
  const output = run('cast wallet new')
  const address = output.match(/Address:\s+(0x[a-fA-F0-9]{40})/)?.[1]
  const privateKey = output.match(/Private key:\s+(0x[a-fA-F0-9]{64})/)?.[1]

  if (!address || !privateKey) {
    throw new Error('Failed to parse wallet output')
  }

  log(`Generated wallet: ${address}`)
  return { address, privateKey }
}

// =============================================================================
// Step 2: Fund via CDP Faucet
// =============================================================================
async function fundViaCDP(address: string): Promise<void> {
  const keyId = process.env.CDP_API_KEY_ID
  const keySecret = process.env.CDP_API_KEY_SECRET

  if (!keyId || !keySecret) {
    throw new Error(
      'CDP_API_KEY_ID and CDP_API_KEY_SECRET required.\n' +
        'Get free keys at: https://portal.cdp.coinbase.com/',
    )
  }

  log(`Requesting ${FAUCET_DRIPS} faucet drips (${FAUCET_DRIPS * 0.0001} ETH)...`)

  // Dynamic import to avoid issues if not installed
  const { CdpClient } = await import('@coinbase/cdp-sdk')

  const cdp = new CdpClient({
    apiKeyId: keyId,
    apiKeySecret: keySecret,
  })

  let successCount = 0
  let failCount = 0

  for (let i = 0; i < FAUCET_DRIPS; i++) {
    try {
      const result = await cdp.evm.requestFaucet({
        address,
        network: 'base-sepolia',
        token: 'eth',
      })
      successCount++
      if (successCount % 10 === 0) {
        log(`  ${successCount}/${FAUCET_DRIPS} drips received`)
      }
    } catch (e: unknown) {
      failCount++
      if (failCount > 5) {
        warn(`Too many failures (${failCount}). Proceeding with ${successCount} drips.`)
        break
      }
      // Rate limit — wait and retry
      await sleep(2000)
    }
  }

  log(`Faucet complete: ${successCount} drips (~${(successCount * 0.0001).toFixed(4)} ETH)`)

  // Wait for transactions to confirm
  log('Waiting for funds to arrive...')
  await sleep(5000)

  const balance = run(`cast balance "${address}" --rpc-url "${RPC_URL}"`)
  const balanceEth = run(`cast from-wei "${balance}"`)
  log(`Wallet balance: ${balanceEth} ETH`)

  if (balance === '0') {
    throw new Error('Wallet still has 0 balance after faucet drips')
  }
}

// =============================================================================
// Step 3: Deploy
// =============================================================================
function deploy(privateKey: string, rpcUrl: string): string {
  log('Building contracts...')
  run('forge build --silent')

  log('Deploying AgentRegistryWrapper...')

  const output = run(
    `DEPLOYER_PRIVATE_KEY="${privateKey}" forge script script/Deploy.s.sol ` +
      `--rpc-url "${rpcUrl}" --broadcast 2>&1`,
  )

  // Extract deployed address
  const match = output.match(/deployed at:\s*(0x[a-fA-F0-9]{40})/)
  if (!match?.[1]) {
    console.log(output)
    throw new Error('Could not extract wrapper address from deployment output')
  }

  return match[1]
}

// =============================================================================
// Step 4: Update config files
// =============================================================================
function updateConfigs(wrapperAddress: string): void {
  // Update .env.example at project root
  const rootDir = resolve(CONTRACT_DIR, '../..')
  const envExamplePath = resolve(rootDir, '.env.example')
  if (existsSync(envExamplePath)) {
    let content = readFileSync(envExamplePath, 'utf-8')
    content = content.replace(
      /NEXT_PUBLIC_WRAPPER_ADDRESS=.*/,
      `NEXT_PUBLIC_WRAPPER_ADDRESS=${wrapperAddress}`,
    )
    writeFileSync(envExamplePath, content)
    log(`Updated .env.example with wrapper address`)
  }

  // Update subgraph.yaml — replace the wrapper address (third address: line)
  const subgraphPath = resolve(rootDir, 'packages/subgraph/subgraph.yaml')
  if (existsSync(subgraphPath)) {
    let content = readFileSync(subgraphPath, 'utf-8')
    // Match the address line under the AgentRegistryWrapper data source
    content = content.replace(
      /(name: AgentRegistryWrapper[\s\S]*?address: )"0x[a-fA-F0-9]{40}"/,
      `$1"${wrapperAddress}"`,
    )
    writeFileSync(subgraphPath, content)
    log(`Updated subgraph.yaml with wrapper address`)
  }
}

// =============================================================================
// Main
// =============================================================================
async function main(): Promise<DeployResult> {
  const isLocal = process.argv.includes('--local')
  const network = isLocal ? 'local (Anvil fork)' : 'Base Sepolia'

  console.log('='.repeat(55))
  console.log('  Autonomous AgentRegistryWrapper Deployment')
  console.log(`  Network: ${network}`)
  console.log('='.repeat(55))
  console.log()

  // Step 1: Wallet
  const { address, privateKey } = getOrCreateWallet()

  let rpcUrl = RPC_URL
  let anvilPid: number | undefined

  if (isLocal) {
    // Start Anvil fork
    log('Starting local Anvil fork...')
    const anvil = require('child_process').spawn(
      'anvil',
      ['--fork-url', 'https://sepolia.base.org', '--port', '8545', '--silent'],
      { detached: true, stdio: 'ignore' },
    )
    anvilPid = anvil.pid
    await sleep(3000)
    rpcUrl = 'http://127.0.0.1:8545'

    // Fund on local fork
    run(
      `cast send "${address}" --value 1ether ` +
        `--private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 ` +
        `--rpc-url "${rpcUrl}"`,
    )
    log('Funded with 1 ETH on local fork')
  } else {
    // Step 2: Fund via CDP
    await fundViaCDP(address)
  }

  // Step 3: Deploy
  const wrapperAddress = deploy(privateKey, rpcUrl)

  // Step 4: Update configs
  updateConfigs(wrapperAddress)

  // Cleanup
  if (anvilPid) {
    try {
      process.kill(anvilPid)
    } catch {}
    log('Anvil stopped')
  }

  // Summary
  const result: DeployResult = {
    wrapperAddress,
    deployerAddress: address,
    deployerPrivateKey: privateKey,
    network,
    txHash: '', // Would need to parse from output
  }

  console.log()
  console.log('='.repeat(55))
  console.log('  Deployment Complete!')
  console.log('='.repeat(55))
  console.log(`  Network:        ${network}`)
  console.log(`  Wrapper:        ${wrapperAddress}`)
  console.log(`  Identity Reg:   ${IDENTITY_REGISTRY}`)
  console.log(`  Deployer:       ${address}`)
  console.log(`  Explorer:       https://sepolia.basescan.org/address/${wrapperAddress}`)
  console.log('='.repeat(55))
  console.log()

  return result
}

main().catch((e) => {
  err(e.message)
  process.exit(1)
})
