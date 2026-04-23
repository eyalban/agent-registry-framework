import {
  type PublicClient,
  type WalletClient,
  type Chain,
  createPublicClient,
  http,
} from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import {
  toCoinbaseSmartAccount,
  createBundlerClient,
} from 'viem/account-abstraction'

import {
  CONTRACT_ADDRESSES,
  identityRegistryAbi,
  wrapperAbi,
  type SupportedChainId,
} from '@agent-registry/shared'

import type {
  RegisterAgentParams,
  TxResult,
  GaslessRegistrationResult,
} from './types'
import { TransactionError, ValidationError } from './errors'

/**
 * Identity sub-client for agent registration and management.
 */
export class IdentityClient {
  private readonly publicClient: PublicClient
  private readonly chainId: SupportedChainId
  private readonly chain: Chain
  private readonly paymasterRpcUrl: string | undefined

  constructor(
    publicClient: PublicClient,
    chainId: SupportedChainId,
    chain: Chain,
    paymasterRpcUrl?: string,
  ) {
    this.publicClient = publicClient
    this.chainId = chainId
    this.chain = chain
    this.paymasterRpcUrl = paymasterRpcUrl
  }

  /**
   * Register a new agent via the wrapper contract.
   * Requires a connected wallet with ETH for gas + registration fee.
   */
  async register(
    walletClient: WalletClient,
    params: RegisterAgentParams,
  ): Promise<{ agentId: bigint; tx: TxResult }> {
    const addresses = CONTRACT_ADDRESSES[this.chainId]
    const [account] = await walletClient.getAddresses()

    if (!account) {
      throw new TransactionError('No account connected')
    }

    const fee = await this.publicClient.readContract({
      address: addresses.wrapper,
      abi: wrapperAbi,
      functionName: 'registrationFee',
    })

    const hash = await walletClient.writeContract({
      address: addresses.wrapper,
      abi: wrapperAbi,
      functionName: 'registerAgent',
      args: [params.agentURI, params.metadata ?? [], params.tags ?? []],
      value: fee as bigint,
      account,
      chain: null,
    })

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash })

    return {
      agentId: BigInt(0), // TODO: Parse from event logs
      tx: {
        hash: receipt.transactionHash,
        status: receipt.status,
      },
    }
  }

  /**
   * Register a new agent with ZERO ETH required (gasless).
   *
   * This method:
   * 1. Generates a new private key for the agent
   * 2. Creates a Coinbase Smart Account (ERC-4337)
   * 3. Sends the registration via CDP Paymaster (gas is sponsored)
   * 4. Returns the agent's wallet credentials
   *
   * The agent never needs ETH. The protocol's CDP Paymaster pays gas.
   *
   * Requires `paymasterRpcUrl` in the client config.
   *
   * @example
   * ```ts
   * const client = new AgentRegistryClient({
   *   chain: 'base-sepolia',
   *   paymasterRpcUrl: 'https://api.developer.coinbase.com/rpc/v1/base-sepolia/YOUR_KEY',
   * })
   *
   * const result = await client.identity.registerGasless({
   *   agentURI: 'ipfs://QmMyAgentCard...',
   *   tags: ['defi', 'trading'],
   * })
   *
   * console.log(result.wallet.address)    // Agent's on-chain identity
   * console.log(result.wallet.privateKey) // Agent stores this securely
   * console.log(result.agentId)           // ERC-721 token ID
   * ```
   */
  async registerGasless(
    params: RegisterAgentParams,
  ): Promise<GaslessRegistrationResult> {
    if (!this.paymasterRpcUrl) {
      throw new ValidationError(
        'paymasterRpcUrl is required for gasless registration. ' +
          'Get a free key at https://portal.cdp.coinbase.com and pass it as ' +
          'paymasterRpcUrl in the AgentRegistryConfig.',
      )
    }

    const addresses = CONTRACT_ADDRESSES[this.chainId]

    // Step 1: Generate a new private key for the agent
    const privateKey = generatePrivateKey()
    const owner = privateKeyToAccount(privateKey)

    // Step 2: Create a Coinbase Smart Account
    // The smart account address is deterministic from the owner key
    const paymasterClient = createPublicClient({
      chain: this.chain,
      transport: http(this.paymasterRpcUrl),
    })

    const smartAccount = await toCoinbaseSmartAccount({
      client: paymasterClient,
      owners: [owner],
      version: '1',
    })

    // Step 3: Create bundler client pointing to CDP Paymaster+Bundler RPC
    const bundlerClient = createBundlerClient({
      account: smartAccount,
      client: paymasterClient,
      transport: http(this.paymasterRpcUrl),
      chain: this.chain,
    })

    // Step 4: Send sponsored UserOperation
    // Registration fee is set to 0 for gasless path (only gas is sponsored)
    const userOpHash = await bundlerClient.sendUserOperation({
      account: smartAccount,
      calls: [
        {
          abi: wrapperAbi,
          functionName: 'registerAgent',
          to: addresses.wrapper,
          args: [params.agentURI, params.metadata ?? [], params.tags ?? []],
          value: BigInt(0), // Gasless = no fee (paymaster only covers gas)
        },
      ],
      paymaster: true,
    })

    // Step 5: Wait for confirmation
    const receipt = await bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash,
    })

    return {
      agentId: BigInt(0), // TODO: Parse from receipt logs
      tx: {
        hash: receipt.receipt.transactionHash,
        status: receipt.success ? 'success' : 'reverted',
      },
      wallet: {
        address: smartAccount.address,
        privateKey,
      },
    }
  }

  /**
   * Get the URI for an agent's registration file (ERC-721 tokenURI).
   */
  async getAgentURI(agentId: bigint): Promise<string> {
    const addresses = CONTRACT_ADDRESSES[this.chainId]

    const uri = await this.publicClient.readContract({
      address: addresses.identityRegistry,
      abi: identityRegistryAbi,
      functionName: 'tokenURI',
      args: [agentId],
    })

    return uri as string
  }

  /**
   * Get the owner of an agent.
   */
  async getOwner(agentId: bigint): Promise<string> {
    const addresses = CONTRACT_ADDRESSES[this.chainId]

    const owner = await this.publicClient.readContract({
      address: addresses.identityRegistry,
      abi: identityRegistryAbi,
      functionName: 'ownerOf',
      args: [agentId],
    })

    return owner as string
  }
}
