import { db } from '@/lib/db'
import type { BusinessLine } from '@/lib/data/types'
import { mapBusinessLineRow } from '@/lib/server/mappers/crm'
import { businessLine } from '@workspace/db/schema'
import { asc, eq } from 'drizzle-orm'

export const businessLinesDataAccess = {
  async listActive(): Promise<BusinessLine[]> {
    const rows = await db
      .select()
      .from(businessLine)
      .where(eq(businessLine.status, 'active'))
      .orderBy(asc(businessLine.sortOrder))
    return rows.map(mapBusinessLineRow)
  },
}
