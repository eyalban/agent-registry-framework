/**
 * ERC-8004 Agent types.
 * These mirror the on-chain and off-chain structures defined by the standard.
 */

/** Service endpoint types supported by ERC-8004 */
export type ServiceType = 'a2a' | 'mcp' | 'oasf' | 'ens' | 'did' | 'email' | 'custom'

/** A service endpoint in the agent registration file */
export interface AgentService {
  readonly type: ServiceType
  readonly url: string
  readonly description?: string
}

/** Trust model supported by an agent */
export interface TrustModel {
  readonly type: string
  readonly details?: string
}

/** On-chain registration reference */
export interface OnChainRegistration {
  readonly chainId: number
  readonly registryAddress: string
  readonly agentId: string
}

/**
 * ERC-8004 Agent Registration File (the "Agent Card").
 * This is the JSON document stored at the agentURI.
 */
export interface AgentCard {
  readonly type: typeof import('../constants').ERC8004_REGISTRATION_TYPE
  readonly name: string
  readonly description: string
  readonly image: string
  readonly services?: readonly AgentService[]
  readonly x402Support?: boolean
  readonly active?: boolean
  readonly registrations?: readonly OnChainRegistration[]
  readonly supportedTrust?: readonly TrustModel[]
}

/** Metadata entry stored on-chain (key-value pair) */
export interface MetadataEntry {
  readonly key: string
  readonly value: string
}

/** An agent as indexed by the subgraph (on-chain + resolved card data) */
export interface Agent {
  readonly id: string
  readonly agentId: bigint
  readonly owner: string
  readonly agentURI: string
  readonly wallet: string | null
  readonly tags: readonly string[]
  readonly featured: boolean
  readonly lastActivityBlock: bigint
  readonly registeredAt: bigint
  readonly registeredTx: string
  readonly card: AgentCard | null
  readonly metadata: readonly MetadataEntry[]
}

/** Lightweight agent for list views */
export interface AgentSummary {
  readonly id: string
  readonly agentId: bigint
  readonly owner: string
  readonly name: string
  readonly description: string
  readonly image: string
  readonly tags: readonly string[]
  readonly featured: boolean
  readonly active: boolean
}

/** Agent registration input (for wrapper contract) */
export interface RegisterAgentInput {
  readonly agentURI: string
  readonly metadata: readonly MetadataEntry[]
  readonly tags: readonly string[]
}
