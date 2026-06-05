import { db } from '@/lib/db'
import { businessLine } from '@workspace/db/schema'
import { eq } from 'drizzle-orm'

let cachedIds: Set<string> | null = null

export async function loadElasticBusinessLineIds(): Promise<Set<string> | null> {
  const fromEnv = process.env.DERIVE_ELASTIC_BUSINESS_LINE_IDS?.split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (fromEnv?.length) return new Set(fromEnv)

  if (cachedIds) return cachedIds.size > 0 ? cachedIds : null

  const lines = await db
    .select({ id: businessLine.id, code: businessLine.code, name: businessLine.name })
    .from(businessLine)
    .where(eq(businessLine.status, 'active'))

  const matched = lines.filter(
    (l) => /弹性/.test(l.name) || /elastic/i.test(l.code),
  )
  cachedIds = new Set(matched.map((l) => l.id))
  return cachedIds.size > 0 ? cachedIds : null
}
