import { BigInt } from '@graphprotocol/graph-ts'

import {
  AgentRegisteredViaWrapper,
  AgentTagsUpdated,
  AgentFeatured,
  AgentActivityRecorded,
} from '../generated/AgentRegistryWrapper/AgentRegistryWrapper'
import { Agent } from '../generated/schema'
import { loadOrCreateProtocolStats } from './helpers'

/**
 * Handle agent registration via the wrapper.
 * Updates the existing Agent entity (created by IdentityRegistry.Registered)
 * with wrapper-specific fields: tags and registeredViaWrapper flag.
 *
 * NOTE: The canonical Registered event fires first (same tx), creating the Agent.
 * This handler augments that entity with wrapper data.
 */
export function handleAgentRegisteredViaWrapper(event: AgentRegisteredViaWrapper): void {
  const agentId = event.params.agentId.toString()

  let agent = Agent.load(agentId)
  if (agent != null) {
    agent.tags = event.params.tags
    agent.registeredViaWrapper = true
    agent.lastActivityBlock = event.block.number
    agent.save()
  }

  // Update protocol stats
  let stats = loadOrCreateProtocolStats()
  stats.totalWrapperRegistrations = stats.totalWrapperRegistrations.plus(BigInt.fromI32(1))
  stats.lastUpdatedBlock = event.block.number
  stats.save()
}

/**
 * Handle tag updates on an agent.
 */
export function handleAgentTagsUpdated(event: AgentTagsUpdated): void {
  const agentId = event.params.agentId.toString()

  let agent = Agent.load(agentId)
  if (agent != null) {
    agent.tags = event.params.tags
    agent.lastActivityBlock = event.block.number
    agent.save()
  }
}

/**
 * Handle featured status change.
 */
export function handleAgentFeatured(event: AgentFeatured): void {
  const agentId = event.params.agentId.toString()

  let agent = Agent.load(agentId)
  if (agent != null) {
    agent.featured = event.params.featured
    agent.save()
  }
}

/**
 * Handle activity recording.
 */
export function handleAgentActivityRecorded(event: AgentActivityRecorded): void {
  const agentId = event.params.agentId.toString()

  let agent = Agent.load(agentId)
  if (agent != null) {
    agent.lastActivityBlock = event.params.blockNumber
    agent.save()
  }
}
