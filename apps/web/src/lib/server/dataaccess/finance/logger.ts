const PREFIX = '[finance]'

export function financeLog(
  phase: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  const payload = meta ? ` ${JSON.stringify(meta)}` : ''
  console.log(`${PREFIX} [${phase}] ${message}${payload}`)
}

export function financeWarn(
  phase: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  const payload = meta ? ` ${JSON.stringify(meta)}` : ''
  console.warn(`${PREFIX} [${phase}] ${message}${payload}`)
}

export function financeError(
  phase: string,
  message: string,
  error: unknown,
  meta?: Record<string, unknown>,
): void {
  const payload = { ...meta, err: error instanceof Error ? error.message : String(error) }
  console.error(`${PREFIX} [${phase}] ${message} ${JSON.stringify(payload)}`)
  if (error instanceof Error && error.stack) {
    console.error(error.stack)
  }
}
