/**
 * Reputation and feedback types for the ERC-8004 Reputation Registry.
 * Matches the canonical ReputationRegistryUpgradeable contract.
 *
 * Feedback is keyed by (agentId, clientAddress, feedbackIndex).
 * The canonical giveFeedback takes 8 params including endpoint, URI, and hash.
 */

/** A single feedback entry */
export interface Feedback {
  readonly id: string
  readonly agentId: bigint
  readonly clientAddress: string
  readonly feedbackIndex: number
  readonly value: number
  readonly valueDecimals: number
  readonly tag1: string
  readonly tag2: string
  readonly endpoint: string
  readonly feedbackURI: string | null
  readonly feedbackHash: string | null
  readonly createdAt: bigint
  readonly transactionHash: string
  readonly response: FeedbackResponse | null
  readonly revoked: boolean
}

/** A response to feedback from the agent owner or another responder */
export interface FeedbackResponse {
  readonly id: string
  readonly agentId: bigint
  readonly clientAddress: string
  readonly feedbackIndex: number
  readonly responder: string
  readonly responseURI: string
  readonly responseHash: string
  readonly createdAt: bigint
}

/** Aggregated reputation summary for an agent */
export interface ReputationSummary {
  readonly agentId: bigint
  readonly count: number
  readonly summaryValue: number
  readonly summaryValueDecimals: number
  readonly uniqueReviewers: number
}

/** Input for giving feedback (canonical 8-param signature) */
export interface GiveFeedbackInput {
  readonly agentId: bigint
  readonly value: number
  readonly valueDecimals: number
  readonly tag1: string
  readonly tag2: string
  readonly endpoint: string
  readonly feedbackURI?: string
  readonly feedbackHash?: string
}
