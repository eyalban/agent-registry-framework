/**
 * Base error class for all SDK errors.
 */
export class RegistryError extends Error {
  override name = 'RegistryError'
  readonly code: string
  override readonly cause?: unknown

  constructor(message: string, code: string, cause?: unknown) {
    super(message)
    this.code = code
    this.cause = cause
  }
}

export class NotFoundError extends RegistryError {
  override name = 'NotFoundError'

  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND')
  }
}

export class TransactionError extends RegistryError {
  override name = 'TransactionError'

  constructor(message: string, cause?: unknown) {
    super(message, 'TRANSACTION_FAILED', cause)
  }
}

export class ValidationError extends RegistryError {
  override name = 'ValidationError'

  constructor(message: string) {
    super(message, 'VALIDATION_ERROR')
  }
}

export class ApiError extends RegistryError {
  override name = 'ApiError'
  readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message, 'API_ERROR')
    this.statusCode = statusCode
  }
}
