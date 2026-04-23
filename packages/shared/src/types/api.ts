/**
 * API request and response types for the REST API.
 */

/** Standard API error response */
export interface ApiError {
  readonly error: string
  readonly code: string
  readonly details?: unknown
}

/** Paginated list response */
export interface PaginatedResponse<T> {
  readonly data: readonly T[]
  readonly total: number
  readonly page: number
  readonly pageSize: number
  readonly hasMore: boolean
}

/** Agent list query parameters */
export interface AgentListQuery {
  readonly page?: number
  readonly pageSize?: number
  readonly tags?: readonly string[]
  readonly search?: string
  readonly featured?: boolean
  readonly active?: boolean
  readonly sortBy?: 'registered' | 'activity' | 'reputation' | 'name'
  readonly sortOrder?: 'asc' | 'desc'
}

/** Protocol-wide statistics */
export interface ProtocolStats {
  readonly totalAgents: number
  readonly totalFeedback: number
  readonly totalValidations: number
  readonly activeAgents: number
  readonly uniqueOwners: number
}

/** API key information (returned to user, never includes raw key) */
export interface ApiKeyInfo {
  readonly id: string
  readonly keyPrefix: string
  readonly name: string
  readonly createdAt: string
  readonly lastUsedAt: string | null
  readonly revokedAt: string | null
}
