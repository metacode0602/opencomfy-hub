import { db } from '@/lib/db'
import type { PhysicalDevice, PhysicalDeviceStats } from '@/lib/data/types'
import { mapPhysicalDeviceRow } from '@/lib/server/mappers/supply'
import { supplierLog, supplierWarn, supplierError } from '@/lib/server/dataaccess/supplier/logger'
import { suppliersDataAccess } from '@/lib/server/dataaccess/supplier/suppliers'
import {
  accessConditionSheet,
  entityStateTransitionLog,
  gpuCardType,
  supplier,
  supplierActivity,
  supplierDevice,
} from '@workspace/db/schema'
import { and, count, eq, sql } from 'drizzle-orm'

function newId() {
  return crypto.randomUUID()
}

export const physicalDevicesDataAccess = {
  async list(params: { supplierId?: string }): Promise<PhysicalDevice[]> {
    supplierLog('physical-devices', 'list start', { supplierId: params.supplierId ?? 'all' })

    const conditions = params.supplierId
      ? eq(supplierDevice.supplierId, params.supplierId)
      : undefined

    const rows = await db
      .select({
        device: supplierDevice,
        supplierShortName: supplier.shortName,
        cardTypeName: gpuCardType.name,
      })
      .from(supplierDevice)
      .innerJoin(supplier, eq(supplierDevice.supplierId, supplier.id))
      .innerJoin(gpuCardType, eq(supplierDevice.gpuCardTypeId, gpuCardType.id))
      .where(conditions)
      .orderBy(sql`${supplierDevice.updatedAt} DESC`)

    supplierLog('physical-devices', 'list done', { count: rows.length })
    return rows.map(({ device, supplierShortName, cardTypeName }) =>
      mapPhysicalDeviceRow(device, { supplierShortName, cardTypeName }),
    )
  },

  async getStats(params: { supplierId?: string }): Promise<PhysicalDeviceStats> {
    const conditions = params.supplierId
      ? eq(supplierDevice.supplierId, params.supplierId)
      : undefined

    const [totalRow] = await db
      .select({ value: count() })
      .from(supplierDevice)
      .where(conditions)

    const [onlineRow] = await db
      .select({ value: count() })
      .from(supplierDevice)
      .where(
        conditions
          ? and(conditions, eq(supplierDevice.lifecycleStatus, '在线'))
          : eq(supplierDevice.lifecycleStatus, '在线'),
      )

    const [onboardingRow] = await db
      .select({ value: count() })
      .from(supplierDevice)
      .where(
        conditions
          ? and(conditions, eq(supplierDevice.lifecycleStatus, '接入中'))
          : eq(supplierDevice.lifecycleStatus, '接入中'),
      )

    return {
      total: Number(totalRow?.value ?? 0),
      online: Number(onlineRow?.value ?? 0),
      onboarding: Number(onboardingRow?.value ?? 0),
    }
  },

  async markOnline(params: {
    deviceId: string
    operatorStaffId?: string | null
    operatorName?: string | null
  }): Promise<PhysicalDevice> {
    supplierLog('physical-devices', 'markOnline start', { deviceId: params.deviceId })

    const [hit] = await db
      .select({
        device: supplierDevice,
        supplierShortName: supplier.shortName,
        cardTypeName: gpuCardType.name,
      })
      .from(supplierDevice)
      .innerJoin(supplier, eq(supplierDevice.supplierId, supplier.id))
      .innerJoin(gpuCardType, eq(supplierDevice.gpuCardTypeId, gpuCardType.id))
      .where(eq(supplierDevice.id, params.deviceId))
      .limit(1)

    if (!hit) {
      throw new Error('设备不存在')
    }

    const { device } = hit
    if (device.lifecycleStatus === '在线') {
      throw new Error('设备已在线')
    }

    const fromState = device.lifecycleStatus
    const now = new Date()
    const platformResourceId =
      device.platformResourceId ?? `res-${device.sn.toLowerCase()}`

    try {
      await db.transaction(async (tx) => {
        await tx
          .update(supplierDevice)
          .set({
            lifecycleStatus: '在线',
            onboardingSubstage: '已完成',
            platformResourceId,
            updatedAt: now,
          })
          .where(eq(supplierDevice.id, params.deviceId))

        await tx.insert(entityStateTransitionLog).values({
          id: newId(),
          entityType: 'device',
          entityId: params.deviceId,
          fromState,
          toState: '在线',
          operatorStaffId: params.operatorStaffId ?? null,
          reasonCode: 'ONBOARDING_DONE',
          occurredAt: now,
        })

        await tx.insert(supplierActivity).values({
          id: newId(),
          supplierId: device.supplierId,
          type: 'device_online',
          title: `设备 ${device.sn} 已上线`,
          description: `机房 ${device.idcCode}`,
          authorStaffId: params.operatorStaffId ?? null,
          authorName: params.operatorName ?? '运营',
          authorRole: 'ops',
          refDomain: 'device',
          refId: params.deviceId,
          occurredAt: now,
        })
      })
    } catch (e) {
      supplierError('physical-devices', 'markOnline failed', e, { deviceId: params.deviceId })
      throw e
    }

    supplierLog('physical-devices', 'markOnline done', {
      deviceId: params.deviceId,
      from: fromState,
    })

    return mapPhysicalDeviceRow(
      {
        ...device,
        lifecycleStatus: '在线',
        onboardingSubstage: '已完成',
        platformResourceId,
        updatedAt: now,
      },
      { supplierShortName: hit.supplierShortName, cardTypeName: hit.cardTypeName },
    )
  },
}

export async function resolveOnboardingBatchRefs(supplierId: string): Promise<{
  contractId: string | null
  accessSheetId: string | null
}> {
  await suppliersDataAccess.assertSupplierExists(supplierId)

  const contracts = await suppliersDataAccess.listContractsBySupplier(supplierId)
  const contract = contracts.find((c) => c.status === 'active') ?? contracts[0] ?? null
  if (!contract) {
    supplierLog('physical-devices', 'resolveOnboardingBatchRefs: no contract', { supplierId })
    return { contractId: null, accessSheetId: null }
  }

  const [sheet] = await db
    .select({ id: accessConditionSheet.id })
    .from(accessConditionSheet)
    .where(
      and(
        eq(accessConditionSheet.contractId, contract.id),
        eq(accessConditionSheet.isCurrent, true),
      ),
    )
    .limit(1)

  if (!sheet) {
    supplierWarn('physical-devices', 'resolveOnboardingBatchRefs: no access sheet', {
      supplierId,
      contractId: contract.id,
    })
    return { contractId: contract.id, accessSheetId: null }
  }

  return { contractId: contract.id, accessSheetId: sheet.id }
}
