import type { PublicClient, WalletClient } from 'viem'

import {
  CONTRACT_ADDRESSES,
  reputationRegistryAbi,
  type SupportedChainId,
} from '@agent-registry/shared'

import type { GiveFeedbackParams, TxResult } from './types'
import { TransactionError } from './errors'

const ZERO_HASH =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const

/**
 * Reputation sub-client for feedback management.
 */
export class ReputationClient {
  private readonly publicClient: PublicClient
  private readonly chainId: SupportedChainId

  constructor(publicClient: PublicClient, chainId: SupportedChainId) {
    this.publicClient = publicClient
    this.chainId = chainId
  }

  /**
   * Give feedback to an agent (canonical 8-param signature).
   */
  async giveFeedback(
    walletClient: WalletClient,
    params: GiveFeedbackParams,
  ): Promise<TxResult> {
    const addresses = CONTRACT_ADDRESSES[this.chainId]
    const [account] = await walletClient.getAddresses()

    if (!account) {
      throw new TransactionError('No account connected')
    }

    const hash = await walletClient.writeContract({
      address: addresses.reputationRegistry,
      abi: reputationRegistryAbi,
      functionName: 'giveFeedback',
      args: [
        params.agentId,
        BigInt(params.value),
        params.valueDecimals ?? 0,
        params.tag1 ?? '',
        params.tag2 ?? '',
        params.endpoint ?? '',
        params.feedbackURI ?? '',
        params.feedbackHash ?? ZERO_HASH,
      ],
      account,
      chain: null,
    })

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash })

    return {
      hash: receipt.transactionHash,
      status: receipt.status,
    }
  }

  /**
   * Get reputation summary for an agent.
   */
  async getSummary(
    agentId: bigint,
    options?: { clientAddresses?: readonly string[]; tag1?: string; tag2?: string },
  ): Promise<{
    count: bigint
    summaryValue: bigint
    summaryValueDecimals: number
  }> {
    const addresses = CONTRACT_ADDRESSES[this.chainId]

    const result = await this.publicClient.readContract({
      address: addresses.reputationRegistry,
      abi: reputationRegistryAbi,
      functionName: 'getSummary',
      args: [
        agentId,
        (options?.clientAddresses ?? []) as `0x${string}`[],
        options?.tag1 ?? '',
        options?.tag2 ?? '',
      ],
    })

    const [count, summaryValue, summaryValueDecimals] =
      result as [bigint, bigint, number]

    return { count, summaryValue, summaryValueDecimals }
  }

  /**
   * Get all client addresses that have given feedback to an agent.
   */
  async getClients(agentId: bigint): Promise<readonly string[]> {
    const addresses = CONTRACT_ADDRESSES[this.chainId]

    const result = await this.publicClient.readContract({
      address: addresses.reputationRegistry,
      abi: reputationRegistryAbi,
      functionName: 'getClients',
      args: [agentId],
    })

    return result as string[]
  }
}
