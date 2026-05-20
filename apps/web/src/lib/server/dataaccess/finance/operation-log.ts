import { db } from '@/lib/db'
import { billingPeriodOperationLog } from '@workspace/db/schema'
import { financeLog } from './logger'

export function newId(): string {
  return crypto.randomUUID()
}

export async function appendOperationLog(input: {
  billingPeriodId: string
  operation: string
  purgeScope?: string | null
  actorId?: string | null
  metadata?: Record<string, unknown>
}): Promise<void> {
  await db.insert(billingPeriodOperationLog).values({
    id: newId(),
    billingPeriodId: input.billingPeriodId,
    operation: input.operation,
    purgeScope: input.purgeScope ?? null,
    actorId: input.actorId ?? null,
    metadata: input.metadata ?? null,
  })
  financeLog('audit', `${input.operation} logged`, {
    periodId: input.billingPeriodId,
    scope: input.purgeScope,
  })
}
