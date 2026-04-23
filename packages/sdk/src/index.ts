export { AgentRegistryClient } from './client'
export { IdentityClient } from './identity'
export { ReputationClient } from './reputation'
export {
  CompanyClient,
  type CreateCompanyParams,
  type CompanyInfo,
} from './company'
export {
  InvoiceClient,
  type CreateInvoiceParams,
  type InvoiceInfo,
} from './invoice'
export {
  RegistryError,
  NotFoundError,
  TransactionError,
  ValidationError,
  ApiError,
} from './errors'

// Re-export types
export type {
  AgentRegistryConfig,
  RegisterAgentParams,
  GiveFeedbackParams,
  SearchResult,
  TxResult,
  GaslessRegistrationResult,
  EventCallback,
  RegistryEventType,
} from './types'

// Re-export shared types consumers will need
export type {
  Agent,
  AgentCard,
  AgentSummary,
  Feedback,
  ReputationSummary,
  ValidationRequest,
  PaginatedResponse,
  ProtocolStats,
} from './types'
