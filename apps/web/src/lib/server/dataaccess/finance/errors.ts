export type FinanceErrorCode =
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'BAD_REQUEST'
  | 'PRECONDITION_FAILED'
  | 'UNPROCESSABLE'

export class FinanceError extends Error {
  readonly code: FinanceErrorCode

  constructor(code: FinanceErrorCode, message: string) {
    super(message)
    this.name = 'FinanceError'
    this.code = code
  }
}
