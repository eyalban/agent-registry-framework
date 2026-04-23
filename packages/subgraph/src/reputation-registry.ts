import { BigInt } from '@graphprotocol/graph-ts'

import {
  NewFeedback,
  FeedbackRevoked,
  ResponseAppended,
} from '../generated/ReputationRegistry/ReputationRegistry'
import { Feedback, FeedbackResponse } from '../generated/schema'
import { loadOrCreateProtocolStats, compositeId, addressToId } from './helpers'

/**
 * Handle new feedback event.
 * Creates a Feedback entity keyed by agentId-clientAddress-feedbackIndex.
 */
export function handleNewFeedback(event: NewFeedback): void {
  const agentId = event.params.agentId.toString()
  const clientAddr = addressToId(event.params.clientAddress)
  const feedbackIndex = event.params.feedbackIndex.toString()
  const entityId = compositeId([agentId, clientAddr, feedbackIndex])

  let feedback = new Feedback(entityId)
  feedback.agent = agentId
  feedback.client = null // Will be linked if client is a registered agent
  feedback.clientAddress = event.params.clientAddress
  feedback.feedbackIndex = BigInt.fromI64(event.params.feedbackIndex.toI64())
  feedback.value = BigInt.fromI64(event.params.value.toI64())
  feedback.valueDecimals = event.params.valueDecimals
  feedback.tag1 = event.params.tag1
  feedback.tag2 = event.params.tag2
  feedback.endpoint = event.params.endpoint
  feedback.feedbackURI = event.params.feedbackURI
  feedback.feedbackHash = event.params.feedbackHash
  feedback.revoked = false
  feedback.createdAt = event.block.timestamp
  feedback.createdAtBlock = event.block.number
  feedback.transactionHash = event.transaction.hash
  feedback.save()

  // Update protocol stats
  let stats = loadOrCreateProtocolStats()
  stats.totalFeedback = stats.totalFeedback.plus(BigInt.fromI32(1))
  stats.lastUpdatedBlock = event.block.number
  stats.save()
}

/**
 * Handle feedback revocation.
 * Marks the Feedback entity as revoked.
 */
export function handleFeedbackRevoked(event: FeedbackRevoked): void {
  const agentId = event.params.agentId.toString()
  const clientAddr = addressToId(event.params.clientAddress)
  const feedbackIndex = event.params.feedbackIndex.toString()
  const entityId = compositeId([agentId, clientAddr, feedbackIndex])

  let feedback = Feedback.load(entityId)
  if (feedback != null) {
    feedback.revoked = true
    feedback.save()
  }

  // Update protocol stats
  let stats = loadOrCreateProtocolStats()
  stats.totalRevokedFeedback = stats.totalRevokedFeedback.plus(BigInt.fromI32(1))
  stats.lastUpdatedBlock = event.block.number
  stats.save()
}

/**
 * Handle response appended to feedback.
 * Creates a FeedbackResponse entity.
 */
export function handleResponseAppended(event: ResponseAppended): void {
  const agentId = event.params.agentId.toString()
  const clientAddr = addressToId(event.params.clientAddress)
  const feedbackIndex = event.params.feedbackIndex.toString()
  const responderAddr = addressToId(event.params.responder)

  const feedbackId = compositeId([agentId, clientAddr, feedbackIndex])
  const entityId = compositeId([feedbackId, responderAddr])

  let response = new FeedbackResponse(entityId)
  response.feedback = feedbackId
  response.responder = event.params.responder
  response.responseURI = event.params.responseURI
  response.responseHash = event.params.responseHash
  response.createdAt = event.block.timestamp
  response.transactionHash = event.transaction.hash
  response.save()
}
