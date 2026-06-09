import { db } from '@/lib/db'
import { supplierLog } from '@/lib/server/dataaccess/supplier/logger'
import { suppliersDataAccess } from '@/lib/server/dataaccess/supplier/suppliers'
import type { SupplierOpsEngineer } from '@/lib/types/supplier-ops-engineer'
import { dataCenter, entityStateTransitionLog, supplierOpsEngineer } from '@workspace/db/schema'
import { and, asc, desc, eq } from 'drizzle-orm'

const logTag = 'supplier-ops-engineers'

function newId() {
  return crypto.randomUUID()
}

function mapRow(
  row: typeof supplierOpsEngineer.$inferSelect,
  dataCenterName: string,
): SupplierOpsEngineer {
  return {
    id: row.id,
    supplierId: row.supplierId,
    dataCenterId: row.dataCenterId,
    dataCenterName,
    name: row.name,
    phone: row.phone ?? '',
    email: row.email ?? '',
    wechatId: row.wechatId ?? '',
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function snapshotEngineer(engineer: SupplierOpsEngineer) {
  return {
    id: engineer.id,
    supplierId: engineer.supplierId,
    dataCenterId: engineer.dataCenterId,
    dataCenterName: engineer.dataCenterName,
    name: engineer.name,
    phone: engineer.phone,
    email: engineer.email,
    wechatId: engineer.wechatId,
  }
}

async function appendAuditLog(input: {
  entityId: string
  fromState: string
  toState: string
  reasonCode: 'CREATE' | 'UPDATE' | 'DELETE'
  operatorStaffId?: string | null
  payload: Record<string, unknown>
}) {
  await db.insert(entityStateTransitionLog).values({
    id: newId(),
    entityType: 'supplier_ops_engineer',
    entityId: input.entityId,
    fromState: input.fromState,
    toState: input.toState,
    operatorStaffId: input.operatorStaffId ?? null,
    reasonCode: input.reasonCode,
    occurredAt: new Date(),
    payload: input.payload,
  })
}

async function assertDataCenterExists(dataCenterId: string) {
  const [row] = await db
    .select({
      id: dataCenter.id,
      supplierId: dataCenter.supplierId,
      name: dataCenter.name,
    })
    .from(dataCenter)
    .where(eq(dataCenter.id, dataCenterId))
    .limit(1)

  if (!row) {
    throw new Error('机房不存在')
  }

  return row
}

async function listRows(filter: { supplierId?: string; dataCenterId?: string }) {
  const conditions = []
  if (filter.supplierId) {
    conditions.push(eq(supplierOpsEngineer.supplierId, filter.supplierId))
  }
  if (filter.dataCenterId) {
    conditions.push(eq(supplierOpsEngineer.dataCenterId, filter.dataCenterId))
  }

  return db
    .select({
      engineer: supplierOpsEngineer,
      dataCenterName: dataCenter.name,
    })
    .from(supplierOpsEngineer)
    .innerJoin(dataCenter, eq(supplierOpsEngineer.dataCenterId, dataCenter.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(dataCenter.name), asc(supplierOpsEngineer.sortOrder), asc(supplierOpsEngineer.createdAt))
}

export const supplierOpsEngineersDataAccess = {
  async list(input: { supplierId?: string; dataCenterId?: string }): Promise<SupplierOpsEngineer[]> {
    if (input.supplierId) {
      await suppliersDataAccess.assertSupplierExists(input.supplierId)
    }
    if (input.dataCenterId) {
      await assertDataCenterExists(input.dataCenterId)
    }
    if (!input.supplierId && !input.dataCenterId) {
      throw new Error('请指定供应商或机房')
    }

    const rows = await listRows(input)
    supplierLog(logTag, 'list', { ...input, count: rows.length })
    return rows.map((row) => mapRow(row.engineer, row.dataCenterName))
  },

  async create(input: {
    dataCenterId: string
    name: string
    phone?: string
    email?: string
    wechatId?: string
    operatorStaffId?: string | null
  }): Promise<SupplierOpsEngineer> {
    const dataCenterRow = await assertDataCenterExists(input.dataCenterId)

    const phone = input.phone?.trim() || null
    const email = input.email?.trim() || null
    const wechatId = input.wechatId?.trim() || null
    if (!phone && !email && !wechatId) {
      throw new Error('请至少填写手机号、邮箱或微信号中的一项')
    }

    const [maxSort] = await db
      .select({ sortOrder: supplierOpsEngineer.sortOrder })
      .from(supplierOpsEngineer)
      .where(eq(supplierOpsEngineer.dataCenterId, input.dataCenterId))
      .orderBy(desc(supplierOpsEngineer.sortOrder))
      .limit(1)

    const nextSort = (maxSort?.sortOrder ?? -1) + 1
    const id = newId()
    const now = new Date()

    const [row] = await db
      .insert(supplierOpsEngineer)
      .values({
        id,
        supplierId: dataCenterRow.supplierId,
        dataCenterId: input.dataCenterId,
        name: input.name.trim(),
        phone,
        email,
        wechatId,
        sortOrder: nextSort,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    if (!row) {
      throw new Error('创建运维工程师失败')
    }

    const mapped = mapRow(row, dataCenterRow.name)
    await appendAuditLog({
      entityId: id,
      fromState: '',
      toState: 'active',
      reasonCode: 'CREATE',
      operatorStaffId: input.operatorStaffId,
      payload: {
        supplierId: dataCenterRow.supplierId,
        dataCenterId: input.dataCenterId,
        after: snapshotEngineer(mapped),
      },
    })

    supplierLog(logTag, 'create', { id, dataCenterId: input.dataCenterId })
    return mapped
  },

  async update(input: {
    id: string
    name: string
    phone?: string
    email?: string
    wechatId?: string
    operatorStaffId?: string | null
  }): Promise<SupplierOpsEngineer> {
    const [existing] = await db
      .select({
        engineer: supplierOpsEngineer,
        dataCenterName: dataCenter.name,
      })
      .from(supplierOpsEngineer)
      .innerJoin(dataCenter, eq(supplierOpsEngineer.dataCenterId, dataCenter.id))
      .where(eq(supplierOpsEngineer.id, input.id))
      .limit(1)

    if (!existing) {
      throw new Error('运维工程师不存在')
    }

    const phone = input.phone?.trim() || null
    const email = input.email?.trim() || null
    const wechatId = input.wechatId?.trim() || null
    if (!phone && !email && !wechatId) {
      throw new Error('请至少填写手机号、邮箱或微信号中的一项')
    }

    const before = mapRow(existing.engineer, existing.dataCenterName)
    const [row] = await db
      .update(supplierOpsEngineer)
      .set({
        name: input.name.trim(),
        phone,
        email,
        wechatId,
        updatedAt: new Date(),
      })
      .where(eq(supplierOpsEngineer.id, input.id))
      .returning()

    if (!row) {
      throw new Error('更新运维工程师失败')
    }

    const after = mapRow(row, existing.dataCenterName)
    await appendAuditLog({
      entityId: input.id,
      fromState: 'active',
      toState: 'active',
      reasonCode: 'UPDATE',
      operatorStaffId: input.operatorStaffId,
      payload: {
        supplierId: existing.engineer.supplierId,
        dataCenterId: existing.engineer.dataCenterId,
        before: snapshotEngineer(before),
        after: snapshotEngineer(after),
      },
    })

    supplierLog(logTag, 'update', { id: input.id })
    return after
  },

  async delete(input: {
    id: string
    operatorStaffId?: string | null
  }): Promise<{ id: string }> {
    const [existing] = await db
      .select({
        engineer: supplierOpsEngineer,
        dataCenterName: dataCenter.name,
      })
      .from(supplierOpsEngineer)
      .innerJoin(dataCenter, eq(supplierOpsEngineer.dataCenterId, dataCenter.id))
      .where(eq(supplierOpsEngineer.id, input.id))
      .limit(1)

    if (!existing) {
      throw new Error('运维工程师不存在')
    }

    const before = mapRow(existing.engineer, existing.dataCenterName)
    await db.delete(supplierOpsEngineer).where(eq(supplierOpsEngineer.id, input.id))

    await appendAuditLog({
      entityId: input.id,
      fromState: 'active',
      toState: 'deleted',
      reasonCode: 'DELETE',
      operatorStaffId: input.operatorStaffId,
      payload: {
        supplierId: existing.engineer.supplierId,
        dataCenterId: existing.engineer.dataCenterId,
        before: snapshotEngineer(before),
      },
    })

    supplierLog(logTag, 'delete', { id: input.id })
    return { id: input.id }
  },
}
