const PREFIX = '[platform-pricing]'

export function platformPricingLog(
  phase: string,
  message: string,
  meta?: Record<string, unknown>,
): void {
  const payload = meta ? ` ${JSON.stringify(meta)}` : ''
  console.log(`${PREFIX} [${phase}] ${message}${payload}`)
}

export function platformPricingError(
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
