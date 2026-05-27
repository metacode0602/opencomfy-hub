import { db } from '@/lib/db'
import { resolveGpuCardTypeRole } from '@/lib/supplier/gpu-card-type-metrics'
import type { GPUCardType } from '@/lib/data/types'
import { mapGpuCardTypeRow } from '@/lib/server/mappers/supply'
import { supplierLog } from '@/lib/server/dataaccess/supplier/logger'
import type {
  GpuCardTypeUpdateInput,
  GpuCardTypeUpsertInput,
} from '@/lib/server/dataaccess/supplier/gpu-card-types-types'
import {
  gpuCardType,
  platformCardListPrice,
  platformCardPriceRecord,
  supplierPricingRecord,
} from '@workspace/db/schema'
import { and, count, eq, ilike, ne, or, sql } from 'drizzle-orm'
function newId() {
  return crypto.randomUUID()
}

export type GpuCardTypeListFilters = {
  search?: string
  status?: 'all' | 'active' | 'disabled'
}

async function countPricingUsage(gpuCardTypeId: string): Promise<number> {
  const [pricingRow] = await db
    .select({ total: count() })
    .from(supplierPricingRecord)
    .where(eq(supplierPricingRecord.gpuCardTypeId, gpuCardTypeId))

  const [platformRow] = await db
    .select({ total: count() })
    .from(platformCardPriceRecord)
    .where(eq(platformCardPriceRecord.gpuCardTypeId, gpuCardTypeId))

  const [listPriceRow] = await db
    .select({ total: count() })
    .from(platformCardListPrice)
    .where(eq(platformCardListPrice.gpuCardTypeId, gpuCardTypeId))

  return Number(pricingRow?.total ?? 0) + Number(platformRow?.total ?? 0) + Number(listPriceRow?.total ?? 0)
}

export const gpuCardTypesDataAccess = {
  async list(filters: GpuCardTypeListFilters = {}): Promise<(GPUCardType & { usageCount: number })[]> {
    const conditions = []

    if (filters.status && filters.status !== 'all') {
      conditions.push(eq(gpuCardType.status, filters.status))
    }

    const search = filters.search?.trim()
    if (search) {
      const pattern = `%${search}%`
      conditions.push(
        or(
          ilike(gpuCardType.name, pattern),
          ilike(gpuCardType.code, pattern),
          ilike(gpuCardType.manufacturer, pattern),
        )!,
      )
    }

    const rows = await db
      .select()
      .from(gpuCardType)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(gpuCardType.name)

    const usageCounts = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        usageCount: await countPricingUsage(row.id),
      })),
    )
    const usageMap = new Map(usageCounts.map((item) => [item.id, item.usageCount]))

    supplierLog('gpu-card-types', 'list', { count: rows.length, filters })
    return rows.map((row) => ({
      ...mapGpuCardTypeRow(row),
      usageCount: usageMap.get(row.id) ?? 0,
    }))
  },

  async listActive(): Promise<GPUCardType[]> {
    const rows = await db
      .select()
      .from(gpuCardType)
      .where(eq(gpuCardType.status, 'active'))
      .orderBy(gpuCardType.name)

    return rows.map(mapGpuCardTypeRow)
  },

  async getById(id: string): Promise<(GPUCardType & { usageCount: number }) | null> {
    const row = await db.query.gpuCardType.findFirst({
      where: eq(gpuCardType.id, id),
    })
    if (!row) return null

    const usageCount = await countPricingUsage(row.id)
    return { ...mapGpuCardTypeRow(row), usageCount }
  },

  async create(input: GpuCardTypeUpsertInput): Promise<GPUCardType> {
    const code = input.code.trim()
    const name = input.name.trim()

    const existingCode = await db.query.gpuCardType.findFirst({
      where: eq(gpuCardType.code, code),
      columns: { id: true },
    })
    if (existingCode) {
      throw new Error('卡型编码已存在')
    }

    const existingName = await db.query.gpuCardType.findFirst({
      where: eq(gpuCardType.name, name),
      columns: { id: true },
    })
    if (existingName) {
      throw new Error('卡型名称已存在')
    }

    const id = newId()
    const deviceRole =
      input.deviceRole ??
      resolveGpuCardTypeRole({ name, code })
    const [row] = await db
      .insert(gpuCardType)
      .values({
        id,
        code,
        name,
        manufacturer: input.manufacturer,
        memoryGb: input.memoryGB,
        tdpWatts: input.tdpWatts ?? null,
        computeCapability: input.computeCapability?.trim() || null,
        deviceRole,
        status: 'active',
      })
      .returning()

    if (!row) {
      throw new Error('创建卡型失败')
    }

    supplierLog('gpu-card-types', 'create', { id: row.id, code: row.code })
    return mapGpuCardTypeRow(row)
  },

  async update(id: string, input: GpuCardTypeUpdateInput): Promise<GPUCardType> {
    const existing = await db.query.gpuCardType.findFirst({
      where: eq(gpuCardType.id, id),
    })
    if (!existing) {
      throw new Error('卡型不存在')
    }

    const name = input.name.trim()
    const existingName = await db.query.gpuCardType.findFirst({
      where: and(eq(gpuCardType.name, name), ne(gpuCardType.id, id)),
      columns: { id: true },
    })
    if (existingName) {
      throw new Error('卡型名称已存在')
    }

    const deviceRole =
      input.deviceRole ??
      resolveGpuCardTypeRole({ name, code: existing.code, deviceRole: existing.deviceRole })
    const [row] = await db
      .update(gpuCardType)
      .set({
        name,
        manufacturer: input.manufacturer,
        memoryGb: input.memoryGB,
        tdpWatts: input.tdpWatts ?? null,
        computeCapability: input.computeCapability?.trim() || null,
        deviceRole,
      })
      .where(eq(gpuCardType.id, id))
      .returning()

    if (!row) {
      throw new Error('更新卡型失败')
    }

    supplierLog('gpu-card-types', 'update', { id: row.id })
    return mapGpuCardTypeRow(row)
  },

  async setStatus(id: string, status: 'active' | 'disabled'): Promise<GPUCardType> {
    const existing = await db.query.gpuCardType.findFirst({
      where: eq(gpuCardType.id, id),
    })
    if (!existing) {
      throw new Error('卡型不存在')
    }

    if (status === 'disabled') {
      const usageCount = await countPricingUsage(id)
      if (usageCount > 0) {
        throw new Error(`卡型已被 ${usageCount} 条定价配置引用，无法禁用`)
      }
    }

    const [row] = await db
      .update(gpuCardType)
      .set({ status })
      .where(eq(gpuCardType.id, id))
      .returning()

    if (!row) {
      throw new Error('更新卡型状态失败')
    }

    supplierLog('gpu-card-types', 'setStatus', { id, status })
    return mapGpuCardTypeRow(row)
  },
}
