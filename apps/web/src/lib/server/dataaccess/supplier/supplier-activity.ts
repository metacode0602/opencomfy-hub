import { db } from '@/lib/db'
import { mapSupplierActivityRow } from '@/lib/server/mappers/supply'
import { supplierLog } from '@/lib/server/dataaccess/supplier/logger'
import type { SupplierActivity } from '@/lib/types/supplier-domain'
import { supplierActivity } from '@workspace/db/schema'
import { desc, eq } from 'drizzle-orm'

export const supplierActivityDataAccess = {
  async listBySupplierId(params: {
    supplierId: string
    limit?: number
  }): Promise<SupplierActivity[]> {
    const limit = params.limit ?? 100
    supplierLog('supplier-activity', 'listBySupplierId start', {
      supplierId: params.supplierId,
      limit,
    })

    const rows = await db
      .select()
      .from(supplierActivity)
      .where(eq(supplierActivity.supplierId, params.supplierId))
      .orderBy(desc(supplierActivity.occurredAt))
      .limit(limit)

    return rows.map(mapSupplierActivityRow)
  },
}
