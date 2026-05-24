import { db } from '@/lib/db'
import type { DataCenter } from '@/lib/data/types'
import type {
  UpdateDatacenterInput,
  UpdateDatacenterResult,
  UpdateDatacenterStatusInput,
} from '@/lib/types/datacenter-update'
import { supplierLog } from '@/lib/server/dataaccess/supplier/logger'
import { mapDataCenterRow } from '@/lib/server/mappers/supply'
import {
  buildRegionTags,
  deriveLocation,
  normalizeDatacenterName,
} from '@/lib/supplier/datacenter-import-utils'
import type { DatacenterImportParsedRow } from '@/lib/types/datacenter-import'
import { dataCenter, supplier, supplierGpuInventory } from '@workspace/db/schema'
import { eq, sum } from 'drizzle-orm'

const logTag = 'datacenter-update'

function toImportRow(input: UpdateDatacenterInput): DatacenterImportParsedRow {
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

async function assertDataCenterExists(dataCenterId: string) {
  const [hit] = await db
    .select({ id: dataCenter.id, supplierId: dataCenter.supplierId })
    .from(dataCenter)
    .where(eq(dataCenter.id, dataCenterId))
    .limit(1)

  if (!hit) {
    throw new Error('机房不存在')
  }

  return hit
}

async function assertUniqueName(
  supplierId: string,
  name: string,
  excludeDataCenterId: string,
): Promise<void> {
  const normName = normalizeDatacenterName(name)
  const rows = await db
    .select({ id: dataCenter.id, name: dataCenter.name })
    .from(dataCenter)
    .where(eq(dataCenter.supplierId, supplierId))

  if (
    rows.some(
      (row) => row.id !== excludeDataCenterId && normalizeDatacenterName(row.name) === normName,
    )
  ) {
    throw new Error('机房名称已存在，请使用唯一名称')
  }
}

async function assertUniqueContainerInstanceRegion(
  region: string,
  excludeDataCenterId: string,
): Promise<void> {
  const [hit] = await db
    .select({ id: dataCenter.id, name: dataCenter.name })
    .from(dataCenter)
    .where(eq(dataCenter.containerInstanceRegion, region))
    .limit(1)

  if (hit && hit.id !== excludeDataCenterId) {
    throw new Error(
      `容器实例区域「${region}」已被机房「${hit.name}」使用，请填写唯一的 Karmada 标签值`,
    )
  }
}

async function loadDataCenterResult(dataCenterId: string): Promise<DataCenter> {
  const [row] = await db
    .select({ row: dataCenter, supplierName: supplier.name })
    .from(dataCenter)
    .innerJoin(supplier, eq(dataCenter.supplierId, supplier.id))
    .where(eq(dataCenter.id, dataCenterId))
    .limit(1)

  if (!row) {
    throw new Error('机房不存在')
  }

  const [invCount] = await db
    .select({
      total: sum(supplierGpuInventory.quantity),
      online: sum(supplierGpuInventory.onlineQuantity),
    })
    .from(supplierGpuInventory)
    .where(eq(supplierGpuInventory.dataCenterId, dataCenterId))

  return mapDataCenterRow(row.row, row.supplierName, {
    total: Number(invCount?.total ?? 0),
    online: Number(invCount?.online ?? 0),
  })
}

export const datacenterUpdateDataAccess = {
  async update(input: UpdateDatacenterInput): Promise<UpdateDatacenterResult> {
    const hit = await assertDataCenterExists(input.dataCenterId)

    const name = input.name.trim()
    const containerInstanceRegion = input.containerInstanceRegion?.trim() || undefined
    const bareMetalRegion = input.bareMetalRegion?.trim() || undefined

    await assertUniqueName(hit.supplierId, name, input.dataCenterId)
    if (containerInstanceRegion) {
      await assertUniqueContainerInstanceRegion(containerInstanceRegion, input.dataCenterId)
    }

    const importRow = toImportRow(input)
    const now = new Date()

    supplierLog(logTag, 'update start', {
      dataCenterId: input.dataCenterId,
      name,
      containerInstanceRegion,
    })

    await db
      .update(dataCenter)
      .set({
        name,
        location: deriveLocation(importRow) || null,
        address: input.address?.trim() || null,
        regionTags: buildRegionTags(importRow),
        networkFeeMonthly: formatMoney(input.networkFee ?? 0),
        mgmtNodeFeeMonthly: formatMoney(input.managementNodeFee ?? 0),
        externalOnboardingId: input.externalOnboardingId?.trim() || null,
        containerInstanceRegion: containerInstanceRegion ?? null,
        bareMetalRegion: bareMetalRegion ?? null,
        description: input.description?.trim() || null,
        scale: input.scale ?? null,
        publicIpCount: input.publicIpCount ?? null,
        internalNetworkCidr: input.internalNetworkCidr?.trim() || null,
        updatedAt: now,
      })
      .where(eq(dataCenter.id, input.dataCenterId))

    const dataCenterResult = await loadDataCenterResult(input.dataCenterId)

    supplierLog(logTag, 'update done', { id: input.dataCenterId })

    return { dataCenter: dataCenterResult }
  },

  async updateStatus(input: UpdateDatacenterStatusInput): Promise<UpdateDatacenterResult> {
    await assertDataCenterExists(input.dataCenterId)

    supplierLog(logTag, 'update status', {
      dataCenterId: input.dataCenterId,
      status: input.status,
    })

    await db
      .update(dataCenter)
      .set({
        status: input.status,
        updatedAt: new Date(),
      })
      .where(eq(dataCenter.id, input.dataCenterId))

    const dataCenterResult = await loadDataCenterResult(input.dataCenterId)

    return { dataCenter: dataCenterResult }
  },
}
