export function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.startsWith('86') && digits.length > 11) {
    return digits.slice(2)
  }
  return digits
}
