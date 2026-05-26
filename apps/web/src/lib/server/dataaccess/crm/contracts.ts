import { db } from '@/lib/db'
import type { Contract } from '@/lib/data/types'
import { mapContractRow } from '@/lib/server/mappers/crm'
import { contract, crmProject, customer } from '@workspace/db/schema'
import { desc, eq } from 'drizzle-orm'

export const contractsDataAccess = {
  async list(): Promise<Contract[]> {
    const rows = await db.select().from(contract).orderBy(desc(contract.createdAt))

    const allProjects = await db.select().from(crmProject)
    const allCustomers = await db.select().from(customer)

    const projectMap = new Map(allProjects.map((p) => [p.id, p.name]))
    const customerMap = new Map(allCustomers.map((c) => [c.id, c.name]))

    return rows.map((row) =>
      mapContractRow({
        ...row,
        startDate: String(row.startDate),
        endDate: String(row.endDate),
        projectName: row.projectId ? projectMap.get(row.projectId) ?? '' : '',
        customerName: row.customerId ? customerMap.get(row.customerId) ?? '' : '',
      }),
    )
  },

  async listByCustomerId(customerId: string): Promise<Contract[]> {
    const rows = await db.select().from(contract).where(eq(contract.customerId, customerId))
    const allProjects = await db.select().from(crmProject)
    const cust = await db.query.customer.findFirst({ where: eq(customer.id, customerId) })
    const projectMap = new Map(allProjects.map((p) => [p.id, p.name]))

    return rows.map((row) =>
      mapContractRow({
        ...row,
        startDate: String(row.startDate),
        endDate: String(row.endDate),
        projectName: row.projectId ? projectMap.get(row.projectId) ?? '' : '',
        customerName: cust?.name ?? '',
      }),
    )
  },
}
