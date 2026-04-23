import {
  CONTRACT_ADDRESSES,
  invoiceRegistryAbi,
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

export interface CreateInvoiceParams {
  payer: `0x${string}`
  issuerCompanyId: bigint
  payerCompanyId: bigint
  /** `address(0)` for ETH. */
  token: `0x${string}`
  amount: bigint
  dueBlock: bigint
  memoURI: string
  memoHash: `0x${string}`
}

export interface InvoiceInfo {
  id: bigint
  issuer: `0x${string}`
  payer: `0x${string}`
  issuerCompanyId: bigint
  payerCompanyId: bigint
  token: `0x${string}`
  amount: bigint
  dueBlock: bigint
  memoURI: string
  memoHash: `0x${string}`
  status: 'Issued' | 'Paid' | 'Cancelled'
  issuedAt: bigint
  paidAt: bigint
}

const STATUS_NAMES = ['Issued', 'Paid', 'Cancelled'] as const

/**
 * On-chain InvoiceRegistry sub-client. All write methods require a signer
 * (`WalletClient`); reads go through the public client.
 */
export class InvoiceClient {
  private readonly publicClient: PublicClient
  private readonly chainId: SupportedChainId
  private readonly chain: Chain

  constructor(publicClient: PublicClient, chainId: SupportedChainId, chain: Chain) {
    this.publicClient = publicClient
    this.chainId = chainId
    this.chain = chain
  }

  private address(): `0x${string}` {
    return CONTRACT_ADDRESSES[this.chainId].invoiceRegistry
  }

  async createInvoice(
    walletClient: WalletClient,
    params: CreateInvoiceParams,
  ): Promise<{ invoiceId: bigint; tx: TxResult }> {
    const [account] = await walletClient.getAddresses()
    if (!account) throw new TransactionError('No account connected')

    const hash = await walletClient.writeContract({
      address: this.address(),
      abi: invoiceRegistryAbi,
      functionName: 'createInvoice',
      args: [
        params.payer,
        params.issuerCompanyId,
        params.payerCompanyId,
        params.token,
        params.amount,
        params.dueBlock,
        params.memoURI,
        params.memoHash,
      ],
      account,
      chain: this.chain,
    })
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash })

    const invoiceId = this.#parseCreatedEvent(receipt.logs)
    if (invoiceId === null) {
      throw new TransactionError('InvoiceCreated event not found in receipt')
    }

    return {
      invoiceId,
      tx: { hash: receipt.transactionHash, status: receipt.status },
    }
  }

  async payETH(
    walletClient: WalletClient,
    invoiceId: bigint,
    amount: bigint,
  ): Promise<TxResult> {
    const [account] = await walletClient.getAddresses()
    if (!account) throw new TransactionError('No account connected')

    const hash = await walletClient.writeContract({
      address: this.address(),
      abi: invoiceRegistryAbi,
      functionName: 'payInvoiceETH',
      args: [invoiceId],
      value: amount,
      account,
      chain: this.chain,
    })
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash })
    return { hash: receipt.transactionHash, status: receipt.status }
  }

  async payERC20(walletClient: WalletClient, invoiceId: bigint): Promise<TxResult> {
    const [account] = await walletClient.getAddresses()
    if (!account) throw new TransactionError('No account connected')

    const hash = await walletClient.writeContract({
      address: this.address(),
      abi: invoiceRegistryAbi,
      functionName: 'payInvoiceERC20',
      args: [invoiceId],
      account,
      chain: this.chain,
    })
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash })
    return { hash: receipt.transactionHash, status: receipt.status }
  }

  async cancel(walletClient: WalletClient, invoiceId: bigint): Promise<TxResult> {
    const [account] = await walletClient.getAddresses()
    if (!account) throw new TransactionError('No account connected')

    const hash = await walletClient.writeContract({
      address: this.address(),
      abi: invoiceRegistryAbi,
      functionName: 'cancelInvoice',
      args: [invoiceId],
      account,
      chain: this.chain,
    })
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash })
    return { hash: receipt.transactionHash, status: receipt.status }
  }

  async requestInvoice(
    walletClient: WalletClient,
    params: {
      issuerSuggested: `0x${string}`
      token: `0x${string}`
      amount: bigint
      memoURI: string
    },
  ): Promise<TxResult> {
    const [account] = await walletClient.getAddresses()
    if (!account) throw new TransactionError('No account connected')

    const hash = await walletClient.writeContract({
      address: this.address(),
      abi: invoiceRegistryAbi,
      functionName: 'requestInvoice',
      args: [params.issuerSuggested, params.token, params.amount, params.memoURI],
      account,
      chain: this.chain,
    })
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash })
    return { hash: receipt.transactionHash, status: receipt.status }
  }

  async getInvoice(invoiceId: bigint): Promise<InvoiceInfo> {
    const raw = (await this.publicClient.readContract({
      address: this.address(),
      abi: invoiceRegistryAbi,
      functionName: 'getInvoice',
      args: [invoiceId],
    })) as {
      issuer: `0x${string}`
      payer: `0x${string}`
      issuerCompanyId: bigint
      payerCompanyId: bigint
      token: `0x${string}`
      amount: bigint
      dueBlock: bigint
      memoHash: `0x${string}`
      memoURI: string
      status: number
      issuedAt: bigint
      paidAt: bigint
      paidTxHash: `0x${string}`
    }
    return {
      id: invoiceId,
      issuer: raw.issuer,
      payer: raw.payer,
      issuerCompanyId: raw.issuerCompanyId,
      payerCompanyId: raw.payerCompanyId,
      token: raw.token,
      amount: raw.amount,
      dueBlock: raw.dueBlock,
      memoURI: raw.memoURI,
      memoHash: raw.memoHash,
      status: STATUS_NAMES[raw.status] ?? 'Issued',
      issuedAt: raw.issuedAt,
      paidAt: raw.paidAt,
    }
  }

  #parseCreatedEvent(
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
          abi: invoiceRegistryAbi,
          data: log.data,
          topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
        })
        if (decoded.eventName === 'InvoiceCreated') {
          return (decoded.args as unknown as { id: bigint }).id
        }
      } catch {
        /* skip */
      }
    }
    return null
  }
}
