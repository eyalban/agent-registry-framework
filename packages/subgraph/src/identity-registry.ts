import { BigInt, Bytes } from '@graphprotocol/graph-ts'

import {
  Registered,
  MetadataSet,
  URIUpdated,
  Transfer,
} from '../generated/IdentityRegistry/IdentityRegistry'
import { Agent, AgentMetadata } from '../generated/schema'
import { loadOrCreateProtocolStats, compositeId, ZERO_ADDRESS } from './helpers'

/**
 * Handle agent registration.
 * Creates a new Agent entity with initial values.
 */
export function handleRegistered(event: Registered): void {
  const agentId = event.params.agentId.toString()

  let agent = new Agent(agentId)
  agent.agentId = event.params.agentId
  agent.owner = event.params.owner
  agent.agentURI = event.params.agentURI
  agent.wallet = null
  agent.tags = []
  agent.featured = false
  agent.lastActivityBlock = event.block.number
  agent.registeredAtBlock = event.block.number
  agent.registeredAt = event.block.timestamp
  agent.registeredTx = event.transaction.hash
  agent.registeredViaWrapper = false
  agent.save()

  // Update protocol stats
  let stats = loadOrCreateProtocolStats()
  stats.totalAgents = stats.totalAgents.plus(BigInt.fromI32(1))
  stats.lastUpdatedBlock = event.block.number
  stats.save()
}

/**
 * Handle metadata set/update.
 * Creates or updates an AgentMetadata entity.
 */
export function handleMetadataSet(event: MetadataSet): void {
  const agentId = event.params.agentId.toString()
  const key = event.params.metadataKey
  const entityId = compositeId([agentId, key])

  let metadata = AgentMetadata.load(entityId)
  if (metadata == null) {
    metadata = new AgentMetadata(entityId)
    metadata.agent = agentId
    metadata.key = key
  }
  metadata.value = event.params.metadataValue
  metadata.updatedAtBlock = event.block.number
  metadata.save()
}

/**
 * Handle URI updates.
 * Updates the agentURI field on the Agent entity.
 */
export function handleURIUpdated(event: URIUpdated): void {
  const agentId = event.params.agentId.toString()

  let agent = Agent.load(agentId)
  if (agent != null) {
    agent.agentURI = event.params.newURI
    agent.lastActivityBlock = event.block.number
    agent.save()
  }
}

/**
 * Handle ERC-721 Transfer events.
 * Updates the owner field on the Agent entity.
 * Ignores mint transfers (from == zero address) since handleRegistered covers those.
 */
export function handleTransfer(event: Transfer): void {
  // Skip mint events — handled by handleRegistered
  if (event.params.from == ZERO_ADDRESS) {
    return
  }

  const agentId = event.params.tokenId.toString()

  let agent = Agent.load(agentId)
  if (agent != null) {
    agent.owner = event.params.to
    agent.save()
  }
}
