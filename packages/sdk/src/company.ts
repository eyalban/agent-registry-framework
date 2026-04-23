import {
  CONTRACT_ADDRESSES,
  companyRegistryAbi,
  type SupportedChainId,
} from '@agent-registry/shared'
import {
  type Chain,
  type PublicClient,
  type WalletClient,
  decodeEventLog,
} from 'viem'

import { TransactionError } from './errors'
import type { TxResult } from './types'

export interface CreateCompanyParams {
  /** IPFS/https URI pointing to JSON with { name, description, logoURL, jurisdictionCode }. */
  metadataURI: string
}

export interface CompanyInfo {
  companyId: bigint
  owner: `0x${string}`
  metadataURI: string
  members: readonly bigint[]
  treasuries: readonly `0x${string}`[]
}

/**
 * Company sub-client for the on-chain CompanyRegistry. All read methods are
 * synchronous against the contract; write methods require a connected
 * `WalletClient` (the caller's signer).
 */
export class CompanyClient {
  private readonly publicClient: PublicClient
  private readonly chainId: SupportedChainId
  private readonly chain: Chain

  constructor(publicClient: PublicClient, chainId: SupportedChainId, chain: Chain) {
    this.publicClient = publicClient
    this.chainId = chainId
    this.chain = chain
  }

  private address(): `0x${string}` {
    return CONTRACT_ADDRESSES[this.chainId].companyRegistry
  }

  /**
   * Create a new company. Returns the parsed companyId from the
   * CompanyCreated event in the resulting receipt.
   */
  async createCompany(
    walletClient: WalletClient,
    params: CreateCompanyParams,
  ): Promise<{ companyId: bigint; tx: TxResult }> {
    const [account] = await walletClient.getAddresses()
    if (!account) throw new TransactionError('No account connected')

    const hash = await walletClient.writeContract({
      address: this.address(),
      abi: companyRegistryAbi,
      functionName: 'createCompany',
      args: [params.metadataURI],
      account,
      chain: this.chain,
    })

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash })

    const companyId = this.#parseCompanyCreated(receipt.logs)
    if (companyId === null) {
      throw new TransactionError('CompanyCreated event not found in receipt')
    }

    return {
      companyId,
      tx: { hash: receipt.transactionHash, status: receipt.status },
    }
  }

  async addAgent(
    walletClient: WalletClient,
    companyId: bigint,
    agentId: bigint,
  ): Promise<TxResult> {
    return this.#write(walletClient, 'addAgent', [companyId, agentId])
  }

  async removeAgent(
    walletClient: WalletClient,
    companyId: bigint,
    agentId: bigint,
  ): Promise<TxResult> {
    return this.#write(walletClient, 'removeAgent', [companyId, agentId])
  }

  async addTreasury(
    walletClient: WalletClient,
    companyId: bigint,
    treasury: `0x${string}`,
  ): Promise<TxResult> {
    return this.#write(walletClient, 'addTreasury', [companyId, treasury])
  }

  async removeTreasury(
    walletClient: WalletClient,
    companyId: bigint,
    treasury: `0x${string}`,
  ): Promise<TxResult> {
    return this.#write(walletClient, 'removeTreasury', [companyId, treasury])
  }

  async transferOwnership(
    walletClient: WalletClient,
    companyId: bigint,
    newOwner: `0x${string}`,
  ): Promise<TxResult> {
    return this.#write(walletClient, 'transferCompanyOwnership', [companyId, newOwner])
  }

  async updateMetadata(
    walletClient: WalletClient,
    companyId: bigint,
    metadataURI: string,
  ): Promise<TxResult> {
    return this.#write(walletClient, 'updateCompanyMetadata', [companyId, metadataURI])
  }

  async getCompany(companyId: bigint): Promise<CompanyInfo> {
    const [owner, metadataURI, members, treasuries] = await Promise.all([
      this.publicClient.readContract({
        address: this.address(),
        abi: companyRegistryAbi,
        functionName: 'companyOwner',
        args: [companyId],
      }) as Promise<`0x${string}`>,
      this.publicClient.readContract({
        address: this.address(),
        abi: companyRegistryAbi,
        functionName: 'companyMetadataURI',
        args: [companyId],
      }) as Promise<string>,
      this.publicClient.readContract({
        address: this.address(),
        abi: companyRegistryAbi,
        functionName: 'members',
        args: [companyId],
      }) as Promise<readonly bigint[]>,
      this.publicClient.readContract({
        address: this.address(),
        abi: companyRegistryAbi,
        functionName: 'treasuries',
        args: [companyId],
      }) as Promise<readonly `0x${string}`[]>,
    ])

    return { companyId, owner, metadataURI, members, treasuries }
  }

  async hasMember(companyId: bigint, agentId: bigint): Promise<boolean> {
    return (await this.publicClient.readContract({
      address: this.address(),
      abi: companyRegistryAbi,
      functionName: 'hasMember',
      args: [companyId, agentId],
    })) as boolean
  }

  async hasTreasury(companyId: bigint, treasury: `0x${string}`): Promise<boolean> {
    return (await this.publicClient.readContract({
      address: this.address(),
      abi: companyRegistryAbi,
      functionName: 'hasTreasury',
      args: [companyId, treasury],
    })) as boolean
  }

  // ----- internals

  async #write(
    walletClient: WalletClient,
    functionName:
      | 'addAgent'
      | 'removeAgent'
      | 'addTreasury'
      | 'removeTreasury'
      | 'transferCompanyOwnership'
      | 'updateCompanyMetadata',
    args: readonly unknown[],
  ): Promise<TxResult> {
    const [account] = await walletClient.getAddresses()
    if (!account) throw new TransactionError('No account connected')
    const hash = await walletClient.writeContract({
      address: this.address(),
      abi: companyRegistryAbi,
      functionName,
      args: args as never,
      account,
      chain: this.chain,
    })
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash })
    return { hash: receipt.transactionHash, status: receipt.status }
  }

  #parseCompanyCreated(
    logs: ReadonlyArray<{
      address: `0x${string}`
      data: `0x${string}`
      topics: readonly `0x${string}`[]
    }>,
  ): bigint | null {
    const target = this.address().toLowerCase()
    for (const log of logs) {
      if (log.address.toLowerCase() !== target) continue
      try {
        const decoded = decodeEventLog({
          abi: companyRegistryAbi,
          data: log.data,
          topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
        })
        if (decoded.eventName === 'CompanyCreated') {
          const args = decoded.args as unknown as { companyId: bigint }
          return args.companyId
        }
      } catch {
        /* skip */
      }
    }
    return null
  }
}
