import { db } from '@/lib/db'
import { onboardingBatch } from '@workspace/db/schema'
import type { RetireActionType, RetirePlanMode } from '@/lib/types/datacenter-device-retire'
import { and, eq, inArray, or } from 'drizzle-orm'

export type ResolvedBusinessBatch = {
  id: string
  batchCode: string
  workOrderNo: string | null
  dataCenterId: string
  plannedDeviceCount: number
  batchKind: 'online' | 'order_access' | 'device_retire' | 'internal_occupancy'
  retireActionType: RetireActionType | null
  retirePlanMode: RetirePlanMode | null
}

export function ticketRefsForBatch(batch: {
  batchCode: string
  workOrderNo: string | null
}): Set<string> {
  const refs = new Set<string>()
  const code = batch.batchCode.trim()
  if (code) refs.add(code)
  const wo = batch.workOrderNo?.trim()
  if (wo) refs.add(wo)
  return refs
}

export function rowTicketMatchesBatch(
  ticketNo: string | undefined | null,
  refs: Set<string>,
): boolean {
  const t = ticketNo?.trim()
  return Boolean(t && refs.has(t))
}

export async function resolveBusinessBatchByTicketNo(
  supplierId: string,
  ticketNo: string,
): Promise<ResolvedBusinessBatch | null> {
  const normalized = ticketNo.trim()
  if (!normalized) return null

  const [row] = await db
    .select({
      id: onboardingBatch.id,
      batchCode: onboardingBatch.batchCode,
      workOrderNo: onboardingBatch.workOrderNo,
      dataCenterId: onboardingBatch.dataCenterId,
      plannedDeviceCount: onboardingBatch.plannedDeviceCount,
      batchKind: onboardingBatch.batchKind,
      retireActionType: onboardingBatch.retireActionType,
      retirePlanMode: onboardingBatch.retirePlanMode,
    })
    .from(onboardingBatch)
    .where(
      and(
        eq(onboardingBatch.supplierId, supplierId),
        inArray(onboardingBatch.batchKind, [
          'online',
          'order_access',
          'device_retire',
          'internal_occupancy',
        ]),
        or(
          eq(onboardingBatch.workOrderNo, normalized),
          eq(onboardingBatch.batchCode, normalized),
        ),
      ),
    )
    .limit(1)

  if (!row) return null

  return {
    id: row.id,
    batchCode: row.batchCode,
    workOrderNo: row.workOrderNo,
    dataCenterId: row.dataCenterId,
    plannedDeviceCount: row.plannedDeviceCount,
    batchKind: row.batchKind as ResolvedBusinessBatch['batchKind'],
    retireActionType: (row.retireActionType as RetireActionType | null) ?? null,
    retirePlanMode: (row.retirePlanMode as RetirePlanMode | null) ?? null,
  }
}

/** 按工单号解析业务批次（同一导入可含多个不同批次） */
export async function resolveBusinessBatchesByTicketNos(
  supplierId: string,
  ticketNos: Iterable<string>,
): Promise<Map<string, ResolvedBusinessBatch>> {
  const unique = [...new Set([...ticketNos].map((t) => t.trim()).filter(Boolean))]
  const resolved = new Map<string, ResolvedBusinessBatch>()

  for (const ticket of unique) {
    const batch = await resolveBusinessBatchByTicketNo(supplierId, ticket)
    if (batch) resolved.set(ticket, batch)
  }

  return resolved
}
