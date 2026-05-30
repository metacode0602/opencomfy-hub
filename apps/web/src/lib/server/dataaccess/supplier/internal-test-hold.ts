import { db } from '@/lib/db'
import { maskPassword } from '@/lib/supplier/onboarding-batch-utils'
import type {
  InternalTestHoldCreateInput,
  InternalTestHoldCreateResult,
  InternalTestHoldDetail,
  InternalTestHoldEndResult,
  InternalTestHoldLinkDevicesInput,
  InternalTestHoldLinkDevicesResult,
  InternalTestHoldListItem,
} from '@/lib/types/internal-test-hold-api'
import type {
  InternalTestHoldDepartment,
  InternalTestHoldSettlement,
} from '@/lib/types/supplier-domain'
import {
  INTERNAL_TEST_HOLD_DEPARTMENT_LABELS,
  INTERNAL_TEST_HOLD_SETTLEMENT_LABELS,
} from '@/lib/types/supplier-domain'
import { supplierLog } from '@/lib/server/dataaccess/supplier/logger'
import {
  dataCenter,
  gpuCardType,
  internalTestHold,
  internalTestHoldDeviceLink,
  onboardingBatch,
  supplier,
  supplierActivity,
  supplierDevice,
} from '@workspace/db/schema'
import { and, desc, eq, ilike, inArray, isNotNull, or, sql } from 'drizzle-orm'

function newId() {
  return crypto.randomUUID()
}

function isHoldActive(holdFrom: Date, holdUntil: Date | null, at = Date.now()): boolean {
  const from = holdFrom.getTime()
  const until = holdUntil?.getTime() ?? null
  if (at < from) return false
  if (until != null && at > until) return false
  return true
}

async function loadSupplierRow(supplierId: string) {
  const row = await db.query.supplier.findFirst({
    where: eq(supplier.id, supplierId),
    columns: { id: true, name: true, shortName: true },
  })
  if (!row) throw new Error('供应商不存在')
  return row
}

async function loadDataCenter(supplierId: string, dataCenterId: string) {
  const [dc] = await db
    .select()
    .from(dataCenter)
    .where(and(eq(dataCenter.id, dataCenterId), eq(dataCenter.supplierId, supplierId)))
    .limit(1)
  if (!dc) throw new Error('机房不存在或不属于该供应商')
  return dc
}

async function assertWorkOrderUnique(supplierId: string, workOrderNo: string) {
  const normalized = workOrderNo.trim()

  const [batchDup] = await db
    .select({ id: onboardingBatch.id })
    .from(onboardingBatch)
    .where(and(eq(onboardingBatch.supplierId, supplierId), eq(onboardingBatch.workOrderNo, normalized)))
    .limit(1)
  if (batchDup) {
    throw new Error(`该供应商下飞书工单号「${normalized}」已存在，请更换后重试`)
  }

  const [holdDup] = await db
    .select({ id: internalTestHold.id })
    .from(internalTestHold)
    .where(
      and(
        eq(internalTestHold.supplierId, supplierId),
        eq(internalTestHold.workOrderNo, normalized),
        isNotNull(internalTestHold.supplierId),
      ),
    )
    .limit(1)
  if (holdDup) {
    throw new Error(`该供应商下飞书工单号「${normalized}」已存在，请更换后重试`)
  }
}

async function resolveGpuCardType(gpuCardTypeId: string) {
  const row = await db.query.gpuCardType.findFirst({
    where: eq(gpuCardType.id, gpuCardTypeId),
    columns: { id: true, code: true, name: true },
  })
  if (!row) throw new Error('卡型不存在')
  return row
}

async function countDevicesByHoldIds(holdIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (holdIds.length === 0) return map

  const rows = await db
    .select({
      holdId: internalTestHoldDeviceLink.holdId,
      count: sql<number>`count(*)::int`,
    })
    .from(internalTestHoldDeviceLink)
    .where(inArray(internalTestHoldDeviceLink.holdId, holdIds))
    .groupBy(internalTestHoldDeviceLink.holdId)

  for (const row of rows) {
    map.set(row.holdId, row.count)
  }
  return map
}

function mapListRow(
  row: {
    id: string
    supplierId: string | null
    supplierName: string | null
    supplierShortName: string | null
    dataCenterId: string | null
    dataCenterName: string | null
    workOrderNo: string | null
    userName: string | null
    department: string | null
    settlementMode: string | null
    gpuCardTypeId: string | null
    cardTypeCode: string | null
    cardTypeName: string | null
    unitCount: number | null
    holdFrom: Date
    holdUntil: Date | null
    remark: string | null
    createdAt: Date
  },
  deviceCount: number,
): InternalTestHoldListItem {
  return {
    id: row.id,
    supplierId: row.supplierId!,
    supplierName: row.supplierName ?? '—',
    supplierShortName: row.supplierShortName,
    dataCenterId: row.dataCenterId!,
    dataCenterName: row.dataCenterName ?? '—',
    workOrderNo: row.workOrderNo ?? '—',
    userName: row.userName ?? '—',
    department: (row.department ?? 'test') as InternalTestHoldDepartment,
    settlementMode: (row.settlementMode ?? 'whole_rent') as InternalTestHoldSettlement,
    gpuCardTypeId: row.gpuCardTypeId!,
    cardTypeCode: row.cardTypeCode ?? '—',
    cardTypeName: row.cardTypeName ?? row.cardTypeCode ?? '—',
    unitCount: row.unitCount ?? 0,
    holdFrom: row.holdFrom,
    holdUntil: row.holdUntil,
    remark: row.remark,
    deviceCount,
    createdAt: row.createdAt,
  }
}

async function findDeviceForHold(params: {
  supplierId: string
  dataCenterId: string
  internalIp?: string
  externalIp?: string
}) {
  const internalIp = params.internalIp?.trim()
  const externalIp = params.externalIp?.trim()

  if (!internalIp && !externalIp) {
    throw new Error('请填写内网 IP 或外网 IP')
  }

  const baseConditions = [
    eq(supplierDevice.supplierId, params.supplierId),
    eq(supplierDevice.dataCenterId, params.dataCenterId),
  ]

  if (internalIp && externalIp) {
    const [device] = await db
      .select()
      .from(supplierDevice)
      .where(
        and(...baseConditions, eq(supplierDevice.internalIp, internalIp), eq(supplierDevice.externalIp, externalIp)),
      )
      .limit(1)
    if (!device) throw new Error('内网 IP 与外网 IP 不匹配同一台设备')
    return device
  }

  if (internalIp) {
    const [device] = await db
      .select()
      .from(supplierDevice)
      .where(and(...baseConditions, eq(supplierDevice.internalIp, internalIp)))
      .limit(1)
    if (!device) throw new Error(`内网 IP ${internalIp} 在该供应商机房下不存在`)
    return device
  }

  const [device] = await db
    .select()
    .from(supplierDevice)
    .where(and(...baseConditions, eq(supplierDevice.externalIp, externalIp!)))
    .limit(1)
  if (!device) throw new Error(`外网 IP ${externalIp} 在该供应商机房下不存在`)
  return device
}

export const internalTestHoldDataAccess = {
  async list(params: {
    search?: string
    activeOnly?: 'all' | 'yes' | 'no'
    supplierId?: string
    dataCenterId?: string
  }): Promise<{ items: InternalTestHoldListItem[]; total: number }> {
    const conditions = [isNotNull(internalTestHold.supplierId)]

    if (params.supplierId) {
      conditions.push(eq(internalTestHold.supplierId, params.supplierId))
    }
    if (params.dataCenterId) {
      conditions.push(eq(internalTestHold.dataCenterId, params.dataCenterId))
    }
    if (params.search?.trim()) {
      const q = `%${params.search.trim()}%`
      conditions.push(
        or(
          ilike(internalTestHold.workOrderNo, q),
          ilike(internalTestHold.userName, q),
          ilike(gpuCardType.code, q),
          ilike(gpuCardType.name, q),
        )!,
      )
    }

    const rows = await db
      .select({
        id: internalTestHold.id,
        supplierId: internalTestHold.supplierId,
        supplierName: supplier.name,
        supplierShortName: supplier.shortName,
        dataCenterId: internalTestHold.dataCenterId,
        dataCenterName: dataCenter.name,
        workOrderNo: internalTestHold.workOrderNo,
        userName: internalTestHold.userName,
        department: internalTestHold.department,
        settlementMode: internalTestHold.settlementMode,
        gpuCardTypeId: internalTestHold.gpuCardTypeId,
        cardTypeCode: gpuCardType.code,
        cardTypeName: gpuCardType.name,
        unitCount: internalTestHold.unitCount,
        holdFrom: internalTestHold.holdFrom,
        holdUntil: internalTestHold.holdUntil,
        remark: internalTestHold.remark,
        createdAt: internalTestHold.createdAt,
      })
      .from(internalTestHold)
      .innerJoin(supplier, eq(internalTestHold.supplierId, supplier.id))
      .innerJoin(dataCenter, eq(internalTestHold.dataCenterId, dataCenter.id))
      .innerJoin(gpuCardType, eq(internalTestHold.gpuCardTypeId, gpuCardType.id))
      .where(and(...conditions))
      .orderBy(desc(internalTestHold.createdAt))

    const deviceCounts = await countDevicesByHoldIds(rows.map((r) => r.id))

    let items = rows.map((row) => mapListRow(row, deviceCounts.get(row.id) ?? 0))

    if (params.activeOnly === 'yes') {
      items = items.filter((item) => isHoldActive(item.holdFrom, item.holdUntil))
    } else if (params.activeOnly === 'no') {
      items = items.filter((item) => !isHoldActive(item.holdFrom, item.holdUntil))
    }

    return { items, total: items.length }
  },

  async getById(holdId: string): Promise<InternalTestHoldDetail | null> {
    const [row] = await db
      .select({
        id: internalTestHold.id,
        supplierId: internalTestHold.supplierId,
        supplierName: supplier.name,
        supplierShortName: supplier.shortName,
        dataCenterId: internalTestHold.dataCenterId,
        dataCenterName: dataCenter.name,
        workOrderNo: internalTestHold.workOrderNo,
        userName: internalTestHold.userName,
        department: internalTestHold.department,
        settlementMode: internalTestHold.settlementMode,
        gpuCardTypeId: internalTestHold.gpuCardTypeId,
        cardTypeCode: gpuCardType.code,
        cardTypeName: gpuCardType.name,
        unitCount: internalTestHold.unitCount,
        holdFrom: internalTestHold.holdFrom,
        holdUntil: internalTestHold.holdUntil,
        remark: internalTestHold.remark,
        createdAt: internalTestHold.createdAt,
      })
      .from(internalTestHold)
      .innerJoin(supplier, eq(internalTestHold.supplierId, supplier.id))
      .innerJoin(dataCenter, eq(internalTestHold.dataCenterId, dataCenter.id))
      .innerJoin(gpuCardType, eq(internalTestHold.gpuCardTypeId, gpuCardType.id))
      .where(and(eq(internalTestHold.id, holdId), isNotNull(internalTestHold.supplierId)))
      .limit(1)

    if (!row) return null

    const deviceRows = await db
      .select({
        id: internalTestHoldDeviceLink.id,
        deviceId: internalTestHoldDeviceLink.supplierDeviceId,
        sn: supplierDevice.sn,
        internalIp: supplierDevice.internalIp,
        externalIp: supplierDevice.externalIp,
        port: internalTestHoldDeviceLink.port,
        rootAccount: internalTestHoldDeviceLink.loginUsername,
        rootPassword: internalTestHoldDeviceLink.loginPassword,
      })
      .from(internalTestHoldDeviceLink)
      .innerJoin(supplierDevice, eq(internalTestHoldDeviceLink.supplierDeviceId, supplierDevice.id))
      .where(eq(internalTestHoldDeviceLink.holdId, holdId))

    const base = mapListRow(row, deviceRows.length)

    return {
      ...base,
      devices: deviceRows.map((d) => ({
        id: d.id,
        deviceId: d.deviceId,
        sn: d.sn,
        internalIp: d.internalIp,
        externalIp: d.externalIp,
        port: d.port,
        rootAccount: d.rootAccount,
        rootPasswordMasked: maskPassword(d.rootPassword),
      })),
    }
  },

  async create(input: InternalTestHoldCreateInput): Promise<InternalTestHoldCreateResult> {
    supplierLog('internal-test-hold', 'create start', {
      supplierId: input.supplierId,
      dataCenterId: input.dataCenterId,
    })

    const supplierRow = await loadSupplierRow(input.supplierId)
    const dc = await loadDataCenter(input.supplierId, input.dataCenterId)
    const workOrderNo = input.workOrderNo.trim()
    await assertWorkOrderUnique(input.supplierId, workOrderNo)

    const holdFrom = new Date(input.holdFrom)
    if (Number.isNaN(holdFrom.getTime())) {
      throw new Error('开始时间无效')
    }
    const holdUntil = input.holdUntil ? new Date(input.holdUntil) : null
    if (holdUntil && Number.isNaN(holdUntil.getTime())) {
      throw new Error('结束时间无效')
    }

    const now = new Date()
    const holdIds: string[] = []
    const cardSummaries: string[] = []

    for (const line of input.cardLines) {
      const card = await resolveGpuCardType(line.gpuCardTypeId)
      const holdId = newId()
      holdIds.push(holdId)
      cardSummaries.push(`${card.code ?? card.name} × ${line.unitCount}台`)

      await db.insert(internalTestHold).values({
        id: holdId,
        supplierId: input.supplierId,
        dataCenterId: dc.id,
        workOrderNo,
        userName: input.userName.trim(),
        department: input.department,
        settlementMode: input.settlementMode,
        gpuCardTypeId: card.id,
        unitCount: line.unitCount,
        remark: input.remark?.trim() || null,
        scope: `planned:${line.unitCount}`,
        holdFrom,
        holdUntil,
        createdAt: now,
        updatedAt: now,
      })
    }

    const cardSummary = cardSummaries.join('、')
    await db.insert(supplierActivity).values({
      id: newId(),
      supplierId: input.supplierId,
      type: 'internal_test_hold',
      title:
        input.cardLines.length === 1
          ? `内部占用 ${cardSummary}`
          : `内部占用 ${input.cardLines.length} 种卡型`,
      description: `工单 ${workOrderNo} · ${cardSummary} · ${input.userName.trim()} · ${INTERNAL_TEST_HOLD_DEPARTMENT_LABELS[input.department]} · ${INTERNAL_TEST_HOLD_SETTLEMENT_LABELS[input.settlementMode]}${input.remark?.trim() ? ` · ${input.remark.trim()}` : ''}`,
      authorStaffId: input.operatorStaffId ?? null,
      authorName: '运营',
      authorRole: 'ops',
      refDomain: 'data_center',
      refId: dc.id,
      occurredAt: now,
      createdAt: now,
    })

    supplierLog('internal-test-hold', 'create done', { holdIds, workOrderNo })

    return {
      holdIds,
      workOrderNo,
      createdCount: holdIds.length,
    }
  },

  async endHold(holdId: string): Promise<InternalTestHoldEndResult> {
    const [row] = await db
      .select({ id: internalTestHold.id })
      .from(internalTestHold)
      .where(and(eq(internalTestHold.id, holdId), isNotNull(internalTestHold.supplierId)))
      .limit(1)
    if (!row) throw new Error('内部占用记录不存在')

    const holdUntil = new Date()
    await db
      .update(internalTestHold)
      .set({ holdUntil, updatedAt: holdUntil })
      .where(eq(internalTestHold.id, holdId))

    return { holdId, holdUntil }
  },

  async linkDevices(input: InternalTestHoldLinkDevicesInput): Promise<InternalTestHoldLinkDevicesResult> {
    const hold = await this.getById(input.holdId)
    if (!hold) throw new Error('内部占用记录不存在')

    const existingLinks = await db
      .select({ supplierDeviceId: internalTestHoldDeviceLink.supplierDeviceId })
      .from(internalTestHoldDeviceLink)
      .where(eq(internalTestHoldDeviceLink.holdId, input.holdId))

    const linkedIds = new Set(existingLinks.map((l) => l.supplierDeviceId))
    const batchIds = new Set<string>()
    const now = new Date()
    let linkedCount = 0

    for (const draft of input.devices) {
      const device = await findDeviceForHold({
        supplierId: hold.supplierId,
        dataCenterId: hold.dataCenterId,
        internalIp: draft.internalIp,
        externalIp: draft.externalIp,
      })

      if (linkedIds.has(device.id) || batchIds.has(device.id)) {
        throw new Error('该设备已录入，请勿重复添加')
      }

      batchIds.add(device.id)
      await db.insert(internalTestHoldDeviceLink).values({
        id: newId(),
        holdId: input.holdId,
        supplierDeviceId: device.id,
        port: draft.port?.trim() || '22',
        loginUsername: draft.rootAccount.trim(),
        loginPassword: draft.rootPassword,
        createdAt: now,
      })
      linkedCount += 1
    }

    if (linkedCount === 0) {
      throw new Error('请至少填写一行有效的设备信息')
    }

    return { linkedCount }
  },

  async unlinkDevice(holdId: string, linkId: string): Promise<void> {
    const [link] = await db
      .select({ id: internalTestHoldDeviceLink.id })
      .from(internalTestHoldDeviceLink)
      .where(and(eq(internalTestHoldDeviceLink.id, linkId), eq(internalTestHoldDeviceLink.holdId, holdId)))
      .limit(1)
    if (!link) throw new Error('设备关联不存在')

    await db.delete(internalTestHoldDeviceLink).where(eq(internalTestHoldDeviceLink.id, linkId))
  },
}
