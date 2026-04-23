import { BigInt } from '@graphprotocol/graph-ts'

import {
  AgentAdded,
  AgentRemoved,
  CompanyCreated,
  CompanyMetadataUpdated,
  CompanyOwnershipTransferred,
  TreasuryAdded,
  TreasuryRemoved,
} from '../generated/CompanyRegistry/CompanyRegistry'
import {
  Agent,
  Company,
  CompanyMember,
  CompanyTreasury,
} from '../generated/schema'
import { loadOrCreateProtocolStats } from './helpers'

export function handleCompanyCreated(event: CompanyCreated): void {
  const id = event.params.companyId.toString()
  let company = Company.load(id)
  if (company == null) {
    company = new Company(id)
  }
  company.companyId = event.params.companyId
  company.founder = event.params.founder
  company.owner = event.params.founder
  company.metadataURI = event.params.metadataURI
  company.createdAtBlock = event.block.number
  company.createdAt = event.block.timestamp
  company.createdTx = event.transaction.hash
  company.save()

  const stats = loadOrCreateProtocolStats()
  stats.totalCompanies = stats.totalCompanies.plus(BigInt.fromI32(1))
  stats.lastUpdatedBlock = event.block.number
  stats.save()
}

export function handleCompanyMetadataUpdated(event: CompanyMetadataUpdated): void {
  const id = event.params.companyId.toString()
  const company = Company.load(id)
  if (company != null) {
    company.metadataURI = event.params.metadataURI
    company.save()
  }
}

export function handleCompanyOwnershipTransferred(
  event: CompanyOwnershipTransferred,
): void {
  const id = event.params.companyId.toString()
  const company = Company.load(id)
  if (company != null) {
    company.owner = event.params.newOwner
    company.save()
  }
}

export function handleAgentAdded(event: AgentAdded): void {
  const companyId = event.params.companyId.toString()
  const agentId = event.params.agentId.toString()
  const memberId = companyId + '-' + agentId

  // Ensure agent entity exists (it should; canonical Registered creates it)
  const agent = Agent.load(agentId)
  if (agent == null) return

  let member = CompanyMember.load(memberId)
  if (member == null) {
    member = new CompanyMember(memberId)
    member.company = companyId
    member.agent = agentId
    member.addedAtBlock = event.block.number
    member.addedAt = event.block.timestamp
    member.addedTx = event.transaction.hash
  } else {
    // Re-adding an agent — clear the removal timestamps.
    member.addedAtBlock = event.block.number
    member.addedAt = event.block.timestamp
    member.addedTx = event.transaction.hash
    member.removedAt = null
    member.removedTx = null
  }
  member.save()
}

export function handleAgentRemoved(event: AgentRemoved): void {
  const memberId =
    event.params.companyId.toString() + '-' + event.params.agentId.toString()
  const member = CompanyMember.load(memberId)
  if (member != null) {
    member.removedAt = event.block.timestamp
    member.removedTx = event.transaction.hash
    member.save()
  }
}

export function handleTreasuryAdded(event: TreasuryAdded): void {
  const companyId = event.params.companyId.toString()
  const treasuryId = companyId + '-' + event.params.treasury.toHexString()
  let treasury = CompanyTreasury.load(treasuryId)
  if (treasury == null) {
    treasury = new CompanyTreasury(treasuryId)
    treasury.company = companyId
    treasury.address = event.params.treasury
    treasury.addedAtBlock = event.block.number
    treasury.addedAt = event.block.timestamp
    treasury.addedTx = event.transaction.hash
  } else {
    treasury.addedAtBlock = event.block.number
    treasury.addedAt = event.block.timestamp
    treasury.addedTx = event.transaction.hash
    treasury.removedAt = null
    treasury.removedTx = null
  }
  treasury.save()
}

export function handleTreasuryRemoved(event: TreasuryRemoved): void {
  const treasuryId =
    event.params.companyId.toString() + '-' + event.params.treasury.toHexString()
  const treasury = CompanyTreasury.load(treasuryId)
  if (treasury != null) {
    treasury.removedAt = event.block.timestamp
    treasury.removedTx = event.transaction.hash
    treasury.save()
  }
}
