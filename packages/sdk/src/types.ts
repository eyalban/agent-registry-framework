import type { Address, Hash, PublicClient, WalletClient } from 'viem'

import type {
  Agent,
  AgentCard,
  AgentSummary,
  Feedback,
  ReputationSummary,
  ValidationRequest,
  PaginatedResponse,
  ProtocolStats,
} from '@agent-registry/shared'

/** SDK client configuration */
export interface AgentRegistryConfig {
  /** Chain identifier: 'base-sepolia' or 'base' */
  readonly chain: 'base-sepolia' | 'base'
  /** Optional custom RPC URL */
  readonly rpcUrl?: string
  /**
   * CDP Paymaster+Bundler RPC URL for gasless transactions.
   * Format: https://api.developer.coinbase.com/rpc/v1/{network}/{API_KEY}
   * Required for registerGasless().
   */
  readonly paymasterRpcUrl?: string
  /** Base URL for the REST API */
  readonly apiUrl?: string
  /** Optional API key for higher rate limits */
  readonly apiKey?: string
  /** Optional custom public client */
  readonly publicClient?: PublicClient
}

/** Agent registration parameters */
export interface RegisterAgentParams {
  readonly agentURI: string
  readonly metadata?: ReadonlyArray<{ key: string; value: `0x${string}` }>
  readonly tags?: readonly string[]
}

/** Feedback parameters (matches canonical 8-param giveFeedback) */
export interface GiveFeedbackParams {
  readonly agentId: bigint
  readonly value: number
  readonly valueDecimals?: number
  readonly tag1?: string
  readonly tag2?: string
  readonly endpoint?: string
  readonly feedbackURI?: string
  readonly feedbackHash?: `0x${string}`
}

/** Search result */
export interface SearchResult {
  readonly agents: readonly AgentSummary[]
  readonly total: number
  readonly query: string
}

/** Transaction receipt from a write operation */
export interface TxResult {
  readonly hash: Hash
  readonly status: 'success' | 'reverted'
}

/** Result of gasless agent registration */
export interface GaslessRegistrationResult {
  /** The assigned agent ID (ERC-721 token ID) */
  readonly agentId: bigint
  /** Transaction result */
  readonly tx: TxResult
  /** The agent's new smart wallet */
  readonly wallet: {
    /** Smart account address (the agent's on-chain identity) */
    readonly address: Address
    /** Private key controlling the smart account (agent must store securely) */
    readonly privateKey: `0x${string}`
  }
}

/** Event subscription callback */
export type EventCallback<T> = (event: T) => void

/** Event types */
export type RegistryEventType =
  | 'AgentRegistered'
  | 'FeedbackGiven'
  | 'FeedbackRevoked'
  | 'ValidationRequested'
  | 'ValidationResponded'

/** Re-export types consumers will need */
export type {
  Agent,
  AgentCard,
  AgentSummary,
  Feedback,
  ReputationSummary,
  ValidationRequest,
  PaginatedResponse,
  ProtocolStats,
  Address,
  Hash,
  PublicClient,
  WalletClient,
}
