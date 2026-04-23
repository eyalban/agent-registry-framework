/**
 * Validation types for the ERC-8004 Validation Registry.
 */

/** Status of a validation request */
export type ValidationStatus = 'pending' | 'in_progress' | 'completed' | 'expired'

/** A validation request */
export interface ValidationRequest {
  readonly id: string
  readonly agentId: bigint
  readonly validatorAddress: string
  readonly requestURI: string
  readonly requestHash: string
  readonly createdAt: bigint
  readonly transactionHash: string
  readonly status: ValidationStatus
  readonly responses: readonly ValidationResponse[]
}

/** A validation response (score 0-100) */
export interface ValidationResponse {
  readonly id: string
  readonly requestHash: string
  readonly score: number
  readonly uri: string | null
  readonly createdAt: bigint
  readonly transactionHash: string
}

/** Input for requesting validation */
export interface RequestValidationInput {
  readonly agentId: bigint
  readonly validatorAddress: string
  readonly requestURI: string
  readonly requestHash: string
}
