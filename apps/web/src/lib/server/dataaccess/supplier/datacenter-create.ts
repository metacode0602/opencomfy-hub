import { db } from '@/lib/db'
import type { DataCenter } from '@/lib/data/types'
import type { CreateDatacenterInput, CreateDatacenterResult } from '@/lib/types/datacenter-create'
import { supplierLog } from '@/lib/server/dataaccess/supplier/logger'
import { mapDataCenterRow } from '@/lib/server/mappers/supply'
import { suppliersDataAccess, newSupplierId } from '@/lib/server/dataaccess/supplier/suppliers'
import {
  buildRegionTags,
  deriveDatacenterCode,
  deriveLocation,
  normalizeDatacenterName,
} from '@/lib/supplier/datacenter-import-utils'
import type { DatacenterImportParsedRow } from '@/lib/types/datacenter-import'
import { dataCenter, supplier } from '@workspace/db/schema'
import { eq } from 'drizzle-orm'

const logTag = 'datacenter-create'

function toImportRow(input: CreateDatacenterInput): DatacenterImportParsedRow {
  return {
    row_no: 0,
    name: input.name.trim(),
    external_onboarding_id: input.externalOnboardingId?.trim() || undefined,
    container_instance_region: input.containerInstanceRegion?.trim() || undefined,
    bare_metal_region: input.bareMetalRegion?.trim() || undefined,
    field_warnings: [],
  }
}

function formatMoney(value: number): string {
  return Number.isFinite(value) ? String(value) : '0'
}

async function assertUniqueName(supplierId: string, name: string): Promise<void> {
  const normName = normalizeDatacenterName(name)
  const rows = await db
    .select({ id: dataCenter.id, name: dataCenter.name })
    .from(dataCenter)
    .where(eq(dataCenter.supplierId, supplierId))

  if (rows.some((row) => normalizeDatacenterName(row.name) === normName)) {
    throw new Error('机房名称已存在，请使用唯一名称')
  }
}

async function assertUniqueContainerInstanceRegion(region: string): Promise<void> {
  const [hit] = await db
    .select({ id: dataCenter.id, name: dataCenter.name })
    .from(dataCenter)
    .where(eq(dataCenter.containerInstanceRegion, region))
    .limit(1)

  if (hit) {
    throw new Error(
      `容器实例区域「${region}」已被机房「${hit.name}」使用，请填写唯一的 Karmada 标签值`,
    )
  }
}

export const datacenterCreateDataAccess = {
  async create(input: CreateDatacenterInput): Promise<CreateDatacenterResult> {
    await suppliersDataAccess.assertSupplierExists(input.supplierId)

    const [supplierRow] = await db
      .select({ id: supplier.id, name: supplier.name, platformTenantId: supplier.platformTenantId })
      .from(supplier)
      .where(eq(supplier.id, input.supplierId))
      .limit(1)

    if (!supplierRow) {
      throw new Error('供应商不存在')
    }
    const name = input.name.trim()
    const containerInstanceRegion = input.containerInstanceRegion?.trim() || undefined
    const bareMetalRegion = input.bareMetalRegion?.trim() || undefined

    await assertUniqueName(input.supplierId, name)
    if (containerInstanceRegion) {
      await assertUniqueContainerInstanceRegion(containerInstanceRegion)
    }

    const existing = await suppliersDataAccess.listDataCentersBySupplier(input.supplierId)
    const codeSet = new Set(existing.map((dc) => dc.code))
    const importRow = toImportRow(input)
    const manualCode = input.code?.trim()
    const code = manualCode || deriveDatacenterCode(importRow, codeSet)
    if (codeSet.has(code)) {
      throw new Error(`机房编码「${code}」已被占用，请修改自定义编码`)
    }

    const id = newSupplierId()
    const now = new Date()

    supplierLog(logTag, 'create start', {
      supplierId: input.supplierId,
      name,
      code,
      containerInstanceRegion,
    })

    await db.insert(dataCenter).values({
      id,
      supplierId: input.supplierId,
      code,
      name,
      location: deriveLocation(importRow) || null,
      address: input.address?.trim() || null,
      regionTags: buildRegionTags(importRow),
      status: input.status ?? 'offline',
      networkFeeMonthly: formatMoney(input.networkFee ?? 0),
      mgmtNodeFeeMonthly: formatMoney(input.managementNodeFee ?? 0),
      externalOnboardingId: input.externalOnboardingId?.trim() || null,
      platformTenantId: supplierRow.platformTenantId ?? null,
      containerInstanceRegion: containerInstanceRegion ?? null,
      bareMetalRegion: bareMetalRegion ?? null,
      description: input.description?.trim() || null,
      scale: input.scale ?? null,
      publicIpCount: input.publicIpCount ?? null,
      internalNetworkCidr: input.internalNetworkCidr?.trim() || null,
      auditStatus: 'pending',
      sourceDeleted: false,
      createdAt: now,
      updatedAt: now,
    })

    const [createdRow] = await db
      .select({ row: dataCenter, supplierName: supplier.name })
      .from(dataCenter)
      .innerJoin(supplier, eq(dataCenter.supplierId, supplier.id))
      .where(eq(dataCenter.id, id))
      .limit(1)

    if (!createdRow) {
      throw new Error('机房创建失败')
    }

    const dataCenterResult: DataCenter = mapDataCenterRow(
      createdRow.row,
      createdRow.supplierName,
      { total: 0, online: 0 },
    )

    supplierLog(logTag, 'create done', { id, code })

    return { dataCenter: dataCenterResult }
  },
}
