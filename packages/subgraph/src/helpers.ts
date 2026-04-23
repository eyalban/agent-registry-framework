import { BigInt, Bytes } from '@graphprotocol/graph-ts'

import { ProtocolStats } from '../generated/schema'

/**
 * Load or create the singleton ProtocolStats entity.
 */
export function loadOrCreateProtocolStats(): ProtocolStats {
  let stats = ProtocolStats.load('protocol')
  if (stats == null) {
    stats = new ProtocolStats('protocol')
    stats.totalAgents = BigInt.zero()
    stats.totalFeedback = BigInt.zero()
    stats.totalRevokedFeedback = BigInt.zero()
    stats.totalValidations = BigInt.zero()
    stats.uniqueOwners = BigInt.zero()
    stats.totalWrapperRegistrations = BigInt.zero()
    stats.totalCompanies = BigInt.zero()
    stats.lastUpdatedBlock = BigInt.zero()
  }
  return stats
}

/**
 * Convert an address to a lowercase hex string ID.
 */
export function addressToId(address: Bytes): string {
  return address.toHexString()
}

/**
 * Create a composite ID from multiple parts.
 */
export function compositeId(parts: string[]): string {
  return parts.join('-')
}

/**
 * The zero address constant.
 */
export const ZERO_ADDRESS = Bytes.fromHexString(
  '0x0000000000000000000000000000000000000000',
) as Bytes
