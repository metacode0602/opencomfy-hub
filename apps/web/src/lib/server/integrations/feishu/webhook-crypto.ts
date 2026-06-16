import 'server-only'

import { createDecipheriv, createHash } from 'node:crypto'

export function decryptFeishuPayload(encryptKey: string, encryptedBase64: string): string {
  const key = createHash('sha256').update(encryptKey).digest()
  const encrypted = Buffer.from(encryptedBase64, 'base64')
  const iv = encrypted.subarray(0, 16)
  const data = encrypted.subarray(16)
  const decipher = createDecipheriv('aes-256-cbc', key, iv)
  decipher.setAutoPadding(true)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

export function verifyFeishuVerificationToken(
  expected: string | null,
  received: string | undefined,
): boolean {
  if (!expected) return true
  return expected === received
}
