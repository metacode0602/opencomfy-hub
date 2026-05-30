import { db } from '@/lib/db'
import { billingPeriodImportBatch } from '@workspace/db/schema'
import { eq } from 'drizzle-orm'
import type { ImportFileType } from './constants'
import { listTenantBillWindows } from './tenant-bill-windows'

export async function getImportSlotStatuses(periodId: string) {
  const batches = await db.query.billingPeriodImportBatch.findMany({
    where: eq(billingPeriodImportBatch.billingPeriodId, periodId),
  })
  const mapSlot = (fileType: ImportFileType) => {
    const b = batches.find((x) => x.fileType === fileType)
    if (!b) return null
    return {
      batchId: b.id,
      fileName: b.fileName,
      parseStatus: b.parseStatus as 'ok' | 'error',
      parseErrorCount: b.parseErrorCount,
      rowCount: b.rowCount,
      hasErrorReport: Boolean(b.errorReportPath),
    }
  }

  const windows = await listTenantBillWindows(periodId)
  const tenantBillWindows = windows.map((w) => {
    const b = batches.find(
      (x) => x.fileType === 'tenant_bill' && x.windowId === w.id,
    )
    return {
      windowId: w.id,
      windowStart: w.windowStart,
      windowEnd: w.windowEnd,
      sortOrder: w.sortOrder,
      batchId: b?.id ?? null,
      fileName: b?.fileName ?? null,
      parseStatus: (b?.parseStatus ?? 'empty') as 'ok' | 'error' | 'empty',
      parseErrorCount: b?.parseErrorCount ?? 0,
      rowCount: b?.rowCount ?? 0,
      hasErrorReport: Boolean(b?.errorReportPath),
    }
  })

  return {
    customer: mapSlot('customer_consumption'),
    baremetal: mapSlot('baremetal_order'),
    tenantBillWindows,
  }
}
