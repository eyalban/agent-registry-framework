import { type Chain, type PublicClient, createPublicClient, http } from 'viem'
import { baseSepolia, base } from 'viem/chains'

import { type SupportedChainId } from '@agent-registry/shared'

import { CompanyClient } from './company'
import { IdentityClient } from './identity'
import { InvoiceClient } from './invoice'
import { ReputationClient } from './reputation'
import type { AgentRegistryConfig } from './types'

const CHAIN_MAP: Record<string, { chain: Chain; chainId: SupportedChainId }> = {
  'base-sepolia': { chain: baseSepolia, chainId: 84532 },
  base: { chain: base, chainId: 8453 },
}

/**
 * Main SDK client for interacting with the Agent Registry.
 *
 * @example
 * ```ts
 * import { AgentRegistryClient } from '@agent-registry/sdk'
 *
 * const client = new AgentRegistryClient({
 *   chain: 'base-sepolia',
 *   apiUrl: 'https://agent-registry-seven.vercel.app/api/v1',
 * })
 *
 * // Gasless registration (agent gets a wallet, protocol pays gas):
 * const result = await client.identity.registerGasless({
 *   agentURI: 'ipfs://QmAgentCard...',
 *   tags: ['defi'],
 * })
 * console.log(result.wallet.address) // Agent's on-chain identity
 * ```
 */
export class AgentRegistryClient {
  readonly identity: IdentityClient
  readonly reputation: ReputationClient
  readonly company: CompanyClient
  readonly invoice: InvoiceClient

  constructor(config: AgentRegistryConfig) {
    const chainConfig = CHAIN_MAP[config.chain]
    if (!chainConfig) {
      throw new Error(`Unsupported chain: ${config.chain}`)
    }

    const { chain: viemChain, chainId } = chainConfig

    const publicClient: PublicClient =
      (config.publicClient as PublicClient) ??
      createPublicClient({
        chain: viemChain,
        transport: http(config.rpcUrl),
      })

    this.identity = new IdentityClient(
      publicClient,
      chainId,
      viemChain,
      config.paymasterRpcUrl,
    )
    this.reputation = new ReputationClient(publicClient, chainId)
    this.company = new CompanyClient(publicClient, chainId, viemChain)
    this.invoice = new InvoiceClient(publicClient, chainId, viemChain)
  }
}
