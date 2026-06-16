import { db } from '@/lib/db'
import { parseInventoryCsv } from '@/lib/supplier-ops/parse-inventory-csv'
import { generateBatchCode, inventoryRowsToParsed, maskPassword } from '@/lib/supplier/onboarding-batch-utils'
import type {
  OnboardingBatchCommitListResult,
  OnboardingBatchCreateInput,
  OnboardingBatchCreateResult,
  OnboardingBatchDatacenterDevicesResult,
  OnboardingBatchDetailPage,
  OnboardingBatchLinkedHold,
  OnboardingBatchListItem,
  OnboardingBatchParseListResult,
  OnboardingBatchPlannedLineJson,
  OnboardingBatchProgress,
} from '@/lib/types/onboarding-batch-api'
import type {
  DeviceCooperationType,
  OnboardingParsedRow,
} from '@/lib/types/supplier-domain'
import {
  INTERNAL_TEST_HOLD_DEPARTMENT_LABELS,
  INTERNAL_TEST_HOLD_SETTLEMENT_LABELS,
} from '@/lib/types/supplier-domain'
import { ONBOARDING_LIFECYCLES } from '@/lib/server/dataaccess/supplier/batch-progress'
import {
  appendBatchProgressEvent,
  BATCH_PROGRESS_EVENT_TYPE_LABELS,
} from '@/lib/server/aggregation/batch-progress-events'
import { DEFAULT_GPU_PER_DEVICE, TERMINAL_BATCH_STATUSES } from '@/lib/server/aggregation/overview-aggregation'
import { isInfraCardType, resolveDeviceGpuCount, resolveGpuCardTypeRole } from '@/lib/supplier/gpu-card-type-metrics'
import { supplierLog, supplierWarn, supplierError } from '@/lib/server/dataaccess/supplier/logger'
import { assertSupplierWorkOrderUnique } from '@/lib/server/dataaccess/supplier/work-order-uniqueness'
import { createFeishuApprovalForBatch } from '@/lib/server/dataaccess/integrations/feishu/create-batch-approval'
import {
  isFeishuAutoCreateEnabled,
  loadFeishuRuntimeConfig,
} from '@/lib/server/integrations/feishu/config'
import {
  accessConditionSheet,
  gpuCardType,
  onboardingBatch,
  onboardingBatchDeviceLink,
  onboardingBatchPlanLine,
  onboardingBatchProgressEvent,
  onboardingTask,
  supplier,
  supplierActivity,
  supplierContract,
  supplierDevice,
  supplierDeviceChangeLog,
  internalTestHold,
  dataCenter,
  userStaff,
} from '@workspace/db/schema'
import { TRPCError } from '@trpc/server'
import { and, desc, eq, ilike, inArray, isNotNull, or, sql } from 'drizzle-orm'

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

const ADJUST_TERMINAL_STATUSES = TERMINAL_BATCH_STATUSES
const EFFECTIVE_AT_FUTURE_MS = 5 * 60 * 1000
const BATCH_STATUS_COMPLETED = '已完成'
const BATCH_STATUS_VOIDED = 'cancelled'

function newId() {
  return crypto.randomUUID()
}

function readPlannedLine(line: Record<string, unknown>): OnboardingBatchPlannedLineJson {
  if (typeof line.gpuCardTypeId === 'string') {
    return line as OnboardingBatchPlannedLineJson
  }
  return {
    gpuCardTypeId: line.gpu_card_type_id as string,
    gpuCardTypeCode: line.gpu_card_type_code as string,
    cooperationType: line.cooperation_type as DeviceCooperationType,
    plannedQuantity: line.planned_quantity as number,
  }
}

async function loadSupplierRow(supplierId: string) {
  const row = await db.query.supplier.findFirst({
    where: eq(supplier.id, supplierId),
    columns: { id: true, code: true, name: true, shortName: true },
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

async function resolveContractRefs(
  supplierId: string,
  contractId?: string,
): Promise<{ contractId: string | null; accessSheetId: string | null }> {
  if (!contractId?.trim()) {
    return { contractId: null, accessSheetId: null }
  }

  const [contract] = await db
    .select({ id: supplierContract.id })
    .from(supplierContract)
    .where(and(eq(supplierContract.id, contractId), eq(supplierContract.supplierId, supplierId)))
    .limit(1)

  if (!contract) {
    throw new Error('合同不存在或不属于该供应商')
  }

  const [sheet] = await db
    .select({ id: accessConditionSheet.id })
    .from(accessConditionSheet)
    .where(
      and(eq(accessConditionSheet.contractId, contract.id), eq(accessConditionSheet.isCurrent, true)),
    )
    .limit(1)

  return { contractId: contract.id, accessSheetId: sheet?.id ?? null }
}

async function resolveGpuCardTypeId(
  codeOrId: string,
  cache: Map<string, string>,
): Promise<string> {
  const cached = cache.get(codeOrId)
  if (cached) return cached

  const byId = await db.query.gpuCardType.findFirst({
    where: eq(gpuCardType.id, codeOrId),
    columns: { id: true },
  })
  if (byId) {
    cache.set(codeOrId, byId.id)
    return byId.id
  }

  const byCode = await db.query.gpuCardType.findFirst({
    where: eq(gpuCardType.code, codeOrId),
    columns: { id: true },
  })
  if (byCode) {
    cache.set(codeOrId, byCode.id)
    return byCode.id
  }

  const byName = await db.query.gpuCardType.findFirst({
    where: eq(gpuCardType.name, codeOrId),
    columns: { id: true },
  })
  if (byName) {
    cache.set(codeOrId, byName.id)
    return byName.id
  }

  throw new Error(`卡型「${codeOrId}」不存在，请先在卡型管理中维护`)
}

function normalizePlanLines(
  planLines: OnboardingBatchCreateInput['planLines'],
  gpuCache: Map<string, string>,
): Promise<OnboardingBatchPlannedLineJson[]> {
  return Promise.all(
    planLines.map(async (line) => {
      const key = line.gpuCardTypeId ?? line.gpuCardTypeCode
      const gpuCardTypeId = await resolveGpuCardTypeId(key, gpuCache)
      const card = await db.query.gpuCardType.findFirst({
        where: eq(gpuCardType.id, gpuCardTypeId),
        columns: { code: true },
      })
      return {
        gpuCardTypeId,
        gpuCardTypeCode: card?.code ?? line.gpuCardTypeCode,
        cooperationType: line.cooperationType,
        plannedQuantity: line.plannedQuantity,
      }
    }),
  )
}

function sumPlannedQuantity(lines: OnboardingBatchPlannedLineJson[]) {
  return lines.reduce((sum, line) => sum + line.plannedQuantity, 0)
}

function parseHoldWindow(input: { holdFrom: string; holdUntil?: string | null }) {
  const holdFrom = new Date(input.holdFrom)
  if (Number.isNaN(holdFrom.getTime())) {
    throw new Error('开始时间无效')
  }
  const holdUntil = input.holdUntil ? new Date(input.holdUntil) : null
  if (holdUntil && Number.isNaN(holdUntil.getTime())) {
    throw new Error('结束时间无效')
  }
  return { holdFrom, holdUntil }
}

async function insertInternalOccupancyHolds(
  tx: DbTx,
  params: {
    batchId: string
    supplierId: string
    dataCenterId: string
    workOrderNo: string | null
    userName: string
    department: NonNullable<OnboardingBatchCreateInput['department']>
    settlementMode: NonNullable<OnboardingBatchCreateInput['settlementMode']>
    holdFrom: Date
    holdUntil: Date | null
    remark?: string | null
    plannedLines: OnboardingBatchPlannedLineJson[]
    now: Date
  },
) {
  for (const line of params.plannedLines) {
    await tx.insert(internalTestHold).values({
      id: newId(),
      supplierId: params.supplierId,
      dataCenterId: params.dataCenterId,
      workOrderNo: params.workOrderNo,
      userName: params.userName.trim(),
      department: params.department,
      settlementMode: params.settlementMode,
      gpuCardTypeId: line.gpuCardTypeId,
      unitCount: line.plannedQuantity,
      remark: params.remark?.trim() || null,
      scope: `planned:${line.plannedQuantity}`,
      holdFrom: params.holdFrom,
      holdUntil: params.holdUntil,
      onboardingBatchId: params.batchId,
      createdAt: params.now,
      updatedAt: params.now,
    })
  }
}

async function resolveDefaultGpuPerDevice(
  supplierId: string,
  dataCenterId: string,
  gpuCardTypeId: string,
): Promise<number> {
  const card = await db.query.gpuCardType.findFirst({
    where: eq(gpuCardType.id, gpuCardTypeId),
    columns: { id: true, name: true, code: true, deviceRole: true },
  })
  if (card && isInfraCardType(card)) return 0

  const rows = await db
    .select({ gpuCount: supplierDevice.gpuCount })
    .from(supplierDevice)
    .where(
      and(
        eq(supplierDevice.supplierId, supplierId),
        eq(supplierDevice.dataCenterId, dataCenterId),
        eq(supplierDevice.gpuCardTypeId, gpuCardTypeId),
      ),
    )

  if (rows.length === 0) return DEFAULT_GPU_PER_DEVICE

  const freq = new Map<number, number>()
  for (const row of rows) {
    freq.set(row.gpuCount, (freq.get(row.gpuCount) ?? 0) + 1)
  }

  let mode = DEFAULT_GPU_PER_DEVICE
  let maxFreq = 0
  for (const [gpuCount, count] of freq) {
    if (count > maxFreq) {
      maxFreq = count
      mode = gpuCount
    }
  }
  return mode
}

async function computePlannedGpuCount(
  supplierId: string,
  dataCenterId: string,
  lines: OnboardingBatchPlannedLineJson[],
): Promise<number> {
  let total = 0
  for (const line of lines) {
    const gpuPerDevice = await resolveDefaultGpuPerDevice(
      supplierId,
      dataCenterId,
      line.gpuCardTypeId,
    )
    total += line.plannedQuantity * gpuPerDevice
  }
  return total
}

async function replacePlanLines(
  tx: DbTx,
  batchId: string,
  lines: OnboardingBatchPlannedLineJson[],
) {
  await tx
    .delete(onboardingBatchPlanLine)
    .where(eq(onboardingBatchPlanLine.onboardingBatchId, batchId))
  const now = new Date()
  for (const line of lines) {
    await tx.insert(onboardingBatchPlanLine).values({
      id: newId(),
      onboardingBatchId: batchId,
      gpuCardTypeId: line.gpuCardTypeId,
      cooperationType: line.cooperationType,
      plannedQuantity: line.plannedQuantity,
      touchedQuantity: 0,
      onlineQuantity: 0,
      createdAt: now,
      updatedAt: now,
    })
  }
}

function parseEffectiveAt(
  raw: string | undefined,
  batchCreatedAt: Date,
): Date {
  const effectiveAt = raw ? new Date(raw) : new Date()
  if (Number.isNaN(effectiveAt.getTime())) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '生效时间格式无效' })
  }
  const now = new Date()
  if (effectiveAt.getTime() < batchCreatedAt.getTime()) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: '生效时间不能早于批次创建时间',
    })
  }
  if (effectiveAt.getTime() > now.getTime() + EFFECTIVE_AT_FUTURE_MS) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: '生效时间不能晚于当前时间 5 分钟',
    })
  }
  return effectiveAt
}

async function loadBatchForAdjust(batchId: string) {
  const [row] = await db.select().from(onboardingBatch).where(eq(onboardingBatch.id, batchId)).limit(1)
  if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: '批次不存在' })
  if (!['online', 'order_access', 'device_retire', 'internal_occupancy'].includes(row.batchKind)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '该批次类型不支持调整计划' })
  }
  return row
}

function assertBatchNotTerminal(batch: { batchStatus: string }) {
  if ((ADJUST_TERMINAL_STATUSES as readonly string[]).includes(batch.batchStatus)) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: '批次已结束，不可再操作',
    })
  }
}

async function countLinkedDevices(batchId: string, runner?: DbTx): Promise<number> {
  const q = runner ?? db
  const [row] = await q
    .select({
      touched: sql<number>`count(distinct ${onboardingBatchDeviceLink.supplierDeviceId})::int`.mapWith(
        Number,
      ),
    })
    .from(onboardingBatchDeviceLink)
    .where(eq(onboardingBatchDeviceLink.businessOnboardingBatchId, batchId))
  return row?.touched ?? 0
}

async function applyBatchLifecycleStatus(input: {
  batchId: string
  targetStatus: typeof BATCH_STATUS_COMPLETED | typeof BATCH_STATUS_VOIDED
  operatorStaffId?: string | null
  operatorName?: string | null
  reason?: string
  remark?: string
}) {
  const batch = await loadBatchForAdjust(input.batchId)
  assertBatchNotTerminal(batch)

  const linkedCount = await countLinkedDevices(batch.id)
  const touchedCount = Math.max(batch.touchedDeviceCount, linkedCount)

  if (input.targetStatus === BATCH_STATUS_VOIDED && touchedCount > 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `已有 ${touchedCount} 台设备接入本批次，不可作废，请调整计划或确认完成`,
    })
  }

  const prevStatus = batch.batchStatus
  const now = new Date()
  const isComplete = input.targetStatus === BATCH_STATUS_COMPLETED
  const activityId = newId()
  const kindLabel =
    batch.batchKind === 'device_retire'
      ? '下架'
      : batch.batchKind === 'order_access'
        ? '订单接入'
        : batch.batchKind === 'internal_occupancy'
          ? '内部占用'
          : '上架'

  await db.transaction(async (tx) => {
    await tx
      .update(onboardingBatch)
      .set({
        batchStatus: input.targetStatus,
        updatedAt: now,
      })
      .where(eq(onboardingBatch.id, batch.id))

    if (!isComplete && batch.batchKind === 'internal_occupancy') {
      await tx
        .update(internalTestHold)
        .set({ onboardingBatchId: null, updatedAt: now })
        .where(eq(internalTestHold.onboardingBatchId, batch.id))
    }

    await appendBatchProgressEvent({
      batchId: batch.id,
      eventType: 'status_changed',
      occurredAt: now,
      tx,
      payload: {
        source: 'manual_ui',
        from: prevStatus,
        to: input.targetStatus,
        operator_staff_id: input.operatorStaffId ?? undefined,
        activity_id: activityId,
        reason: input.reason ?? input.remark,
      },
    })

    await appendBatchProgressEvent({
      batchId: batch.id,
      eventType: isComplete ? 'batch_completed' : 'batch_cancelled',
      occurredAt: now,
      tx,
      payload: {
        source: 'manual_ui',
        operator_staff_id: input.operatorStaffId ?? undefined,
        activity_id: activityId,
        reason: input.reason ?? input.remark,
      },
    })

    await tx.insert(supplierActivity).values({
      id: activityId,
      supplierId: batch.supplierId,
      type: isComplete ? 'batch_completed' : 'batch_cancelled',
      title: isComplete ? `${kindLabel}批次已确认完成` : `${kindLabel}批次已作废`,
      description: isComplete
        ? `${batch.batchCode}：${prevStatus} → ${input.targetStatus}${input.remark?.trim() ? `；备注：${input.remark.trim()}` : ''}`
        : `${batch.batchCode}：${prevStatus} → 已取消；原因：${input.reason?.trim() ?? ''}`,
      authorStaffId: input.operatorStaffId ?? null,
      authorName: input.operatorName ?? '运营',
      authorRole: 'ops',
      refDomain: 'batch',
      refId: batch.id,
      metadata: {
        source: 'manual_ui',
        batch_kind: batch.batchKind,
        from_status: prevStatus,
        to_status: input.targetStatus,
        reason: input.reason ?? null,
        remark: input.remark ?? null,
        touched_device_count: touchedCount,
      },
      occurredAt: now,
      createdAt: now,
    })
  })

  supplierLog('onboarding-batch', isComplete ? 'completeBatch' : 'voidBatch', {
    batchId: batch.id,
    from: prevStatus,
    to: input.targetStatus,
    touchedCount,
  })

  return {
    batchId: batch.id,
    batchStatus: input.targetStatus,
    previousStatus: prevStatus,
  }
}

async function getBusinessBatch(batchId: string, batchKind?: 'online' | 'order_access') {
  const conditions = [eq(onboardingBatch.id, batchId)]
  if (batchKind) {
    conditions.push(eq(onboardingBatch.batchKind, batchKind))
  }
  const [row] = await db
    .select()
    .from(onboardingBatch)
    .where(and(...conditions))
    .limit(1)
  if (!row) throw new Error('批次不存在')
  if (!['online', 'order_access', 'internal_occupancy'].includes(row.batchKind)) {
    throw new Error('该批次类型不支持此操作')
  }
  return row
}

export const onboardingBatchDataAccess = {
  async create(input: OnboardingBatchCreateInput): Promise<OnboardingBatchCreateResult> {
    supplierLog('onboarding-batch', 'create start', {
      batchKind: input.batchKind,
      supplierId: input.supplierId,
      uploadList: input.uploadList,
    })

    const supplierRow = await loadSupplierRow(input.supplierId)
    const dc = await loadDataCenter(input.supplierId, input.dataCenterId)
    const { contractId, accessSheetId } = await resolveContractRefs(input.supplierId, input.contractId)

    const gpuCache = new Map<string, string>()
    const plannedLines = await normalizePlanLines(input.planLines, gpuCache)
    const plannedDeviceCount = sumPlannedQuantity(plannedLines)
    const plannedGpuCount = await computePlannedGpuCount(
      input.supplierId,
      input.dataCenterId,
      plannedLines,
    )

    const batchId = newId()
    const batchCode = generateBatchCode(input.batchKind)
    const feishuConfig = loadFeishuRuntimeConfig()
    const autoCreateFeishu = isFeishuAutoCreateEnabled(feishuConfig)
    const manualWorkOrderNo = input.workOrderNo?.trim() ?? ''
    if (!autoCreateFeishu && !manualWorkOrderNo) {
      throw new Error('请填写飞书审批工单号')
    }
    const workOrderNo = autoCreateFeishu ? null : manualWorkOrderNo
    const now = new Date()

    if (workOrderNo) {
      await assertSupplierWorkOrderUnique(input.supplierId, workOrderNo)
    }

    const isInternalOccupancy = input.batchKind === 'internal_occupancy'
    let holdWindow: { holdFrom: Date; holdUntil: Date | null } | null = null
    if (isInternalOccupancy) {
      if (
        !input.userName?.trim() ||
        !input.department ||
        !input.settlementMode ||
        !input.holdFrom?.trim()
      ) {
        throw new Error('内部占用计划需填写使用者、使用部门、结算方式与开始时间')
      }
      holdWindow = parseHoldWindow({
        holdFrom: input.holdFrom,
        holdUntil: input.holdUntil,
      })
    }
    const listUploadMode = input.uploadList && !isInternalOccupancy ? 'simplified_csv' : 'none'
    const importStatus = input.uploadList && !isInternalOccupancy ? 'draft' : 'none'
    const batchStatus = isInternalOccupancy
      ? '待开始'
      : input.uploadList
        ? '待开始'
        : '接入中'
    const kindLabel =
      input.batchKind === 'online'
        ? '设备上架'
        : input.batchKind === 'order_access'
          ? '订单接入'
          : '内部占用计划'

    try {
      await db.transaction(async (tx) => {
        await tx.insert(onboardingBatch).values({
          id: batchId,
          batchKind: input.batchKind,
          supplierId: input.supplierId,
          supplierCode: supplierRow.code,
          supplierName: supplierRow.name,
          supplierShortName: supplierRow.shortName,
          dataCenterId: dc.id,
          idcCode: dc.code,
          dataCenterName: dc.name,
          idcRegion: dc.location,
          contractId,
          accessConditionSheetId: accessSheetId,
          batchCode,
          batchStatus,
          plannedReadyAt: input.plannedReadyAt ? new Date(input.plannedReadyAt) : null,
          plannedLinesJson: plannedLines,
          plannedDeviceCount,
          plannedGpuCount,
          touchedDeviceCount: 0,
          listUploadMode,
          workOrderNo,
          onlineReason: input.batchKind === 'online' ? (input.onlineReason?.trim() ?? null) : null,
          orderNo: input.batchKind === 'order_access' ? (input.orderNo?.trim() ?? null) : null,
          remark: input.remark?.trim() || null,
          accessMethod: input.accessMethod,
          importFileName: '未上传',
          importStatus,
          parsedRowCount: 0,
          parsedSuccessCount: 0,
          committedDeviceCount: 0,
          createdByStaffId: input.operatorStaffId ?? null,
          metadata: autoCreateFeishu
            ? { feishu: { create_status: 'pending' as const } }
            : {},
          createdAt: now,
          updatedAt: now,
        })

        await replacePlanLines(tx, batchId, plannedLines)

        if (isInternalOccupancy && holdWindow) {
          await insertInternalOccupancyHolds(tx, {
            batchId,
            supplierId: input.supplierId,
            dataCenterId: dc.id,
            workOrderNo,
            userName: input.userName!.trim(),
            department: input.department!,
            settlementMode: input.settlementMode!,
            holdFrom: holdWindow.holdFrom,
            holdUntil: holdWindow.holdUntil,
            remark: input.remark,
            plannedLines,
            now,
          })
        }

        await tx.insert(supplierActivity).values({
          id: newId(),
          supplierId: input.supplierId,
          type: 'batch_started',
          title: `${kindLabel}批次 ${batchCode} 已创建`,
          description: isInternalOccupancy
            ? `计划占用 ${plannedDeviceCount} 台${workOrderNo ? `；工单号 ${workOrderNo}` : '；飞书工单创建中'} · ${input.userName!.trim()} · ${INTERNAL_TEST_HOLD_DEPARTMENT_LABELS[input.department!]} · ${INTERNAL_TEST_HOLD_SETTLEMENT_LABELS[input.settlementMode!]}`
            : `计划上架 ${plannedDeviceCount} 台${workOrderNo ? `；工单号 ${workOrderNo}` : '；飞书工单创建中'}`,
          authorStaffId: input.operatorStaffId ?? null,
          authorName: '运营',
          authorRole: 'ops',
          refDomain: 'batch',
          refId: batchId,
          occurredAt: now,
          createdAt: now,
        })

        await appendBatchProgressEvent({
          batchId,
          eventType: 'batch_created',
          occurredAt: now,
          tx,
          payload: { source: 'system' },
        })
      })
    } catch (e) {
      supplierError('onboarding-batch', 'create failed', e, { batchId })
      throw e
    }

    supplierLog('onboarding-batch', 'create done', { batchId, batchCode, plannedDeviceCount })

    let finalWorkOrderNo = workOrderNo ?? ''
    if (autoCreateFeishu) {
      const feishuResult = await createFeishuApprovalForBatch(batchId)
      finalWorkOrderNo = feishuResult.workOrderNo ?? ''
    }

    return { batchId, batchCode, workOrderNo: finalWorkOrderNo, plannedDeviceCount }
  },

  async list(params: {
    batchKind: 'all' | 'online' | 'order_access' | 'device_retire' | 'internal_occupancy'
    search?: string
    batchStatus?: string
    importStatus?: string
    supplierId?: string
    dataCenterId?: string
  }): Promise<{ items: OnboardingBatchListItem[]; total: number }> {
    const kinds =
      params.batchKind === 'all'
        ? (['online', 'order_access', 'device_retire', 'internal_occupancy'] as const)
        : ([params.batchKind] as const)

    const conditions = [inArray(onboardingBatch.batchKind, [...kinds])]

    if (params.supplierId && params.supplierId !== 'all') {
      conditions.push(eq(onboardingBatch.supplierId, params.supplierId))
    }
    if (params.dataCenterId) {
      conditions.push(eq(onboardingBatch.dataCenterId, params.dataCenterId))
    }
    if (params.batchStatus && params.batchStatus !== 'all') {
      conditions.push(eq(onboardingBatch.batchStatus, params.batchStatus))
    }
    if (params.importStatus && params.importStatus !== 'all') {
      conditions.push(eq(onboardingBatch.importStatus, params.importStatus))
    }
    if (params.search?.trim()) {
      const q = `%${params.search.trim()}%`
      conditions.push(
        or(
          ilike(onboardingBatch.batchCode, q),
          ilike(onboardingBatch.supplierName, q),
          ilike(onboardingBatch.supplierShortName, q),
          ilike(onboardingBatch.dataCenterName, q),
          ilike(onboardingBatch.idcCode, q),
          ilike(onboardingBatch.orderNo, q),
          ilike(onboardingBatch.workOrderNo, q),
        )!,
      )
    }

    const rows = await db
      .select()
      .from(onboardingBatch)
      .where(and(...conditions))
      .orderBy(desc(onboardingBatch.createdAt))

    const items = rows
    return { items, total: items.length }
  },

  async listBySupplierId(supplierId: string): Promise<OnboardingBatchListItem[]> {
    supplierLog('onboarding-batch', 'listBySupplierId start', { supplierId })

    const rows = await db
      .select()
      .from(onboardingBatch)
      .where(
        and(
          eq(onboardingBatch.supplierId, supplierId),
          inArray(onboardingBatch.batchKind, ['online', 'order_access']),
        ),
      )
      .orderBy(desc(onboardingBatch.createdAt))

    return rows
  },

  async getById(batchId: string): Promise<OnboardingBatchListItem | null> {
    supplierLog('onboarding-batch', 'getById start', { batchId })
    try {
      const [row] = await db
        .select()
        .from(onboardingBatch)
        .where(eq(onboardingBatch.id, batchId))
        .limit(1)
      if (!row) {
        supplierWarn('onboarding-batch', 'getById not found', { batchId })
        return null
      }
      supplierLog('onboarding-batch', 'getById done', { batchId, batchCode: row.batchCode })
      return row
    } catch (e) {
      supplierError('onboarding-batch', 'getById failed', e, { batchId })
      throw e
    }
  },

  async getProgress(batchId: string): Promise<OnboardingBatchProgress> {
    supplierLog('onboarding-batch', 'getProgress start', { batchId })
    try {
    const batch = await getBusinessBatch(batchId)
    const plannedLines = ((batch.plannedLinesJson as Record<string, unknown>[] | null) ?? []).map(
      readPlannedLine,
    )

    const deviceRows = await db
      .select({
        gpuCardTypeId: supplierDevice.gpuCardTypeId,
        cooperationType: supplierDevice.cooperationType,
        lifecycleStatus: supplierDevice.lifecycleStatus,
      })
      .from(onboardingBatchDeviceLink)
      .innerJoin(
        supplierDevice,
        eq(onboardingBatchDeviceLink.supplierDeviceId, supplierDevice.id),
      )
      .where(eq(onboardingBatchDeviceLink.businessOnboardingBatchId, batchId))

    let touched = 0
    let onboarding = 0
    let online = 0

    const lineStats = plannedLines.map((line) => {
      const matches = deviceRows.filter(
        (d) =>
          d.gpuCardTypeId === line.gpuCardTypeId &&
          d.cooperationType === line.cooperationType,
      )
      const lineTouched = matches.length
      const lineOnline = matches.filter((d) => d.lifecycleStatus === '在线').length
      touched += lineTouched
      online += lineOnline
      onboarding += matches.filter((d) => ONBOARDING_LIFECYCLES.has(d.lifecycleStatus)).length
      return {
        ...line,
        touched: lineTouched,
        linked: lineTouched,
        online: lineOnline,
      }
    })

    const result = {
      planned: batch.plannedDeviceCount,
      touched,
      linked: touched,
      onboarding,
      online,
      planLines: lineStats,
    }
    supplierLog('onboarding-batch', 'getProgress done', {
      batchId,
      planned: result.planned,
      touched: result.touched,
      online: result.online,
    })
    return result
    } catch (e) {
      supplierError('onboarding-batch', 'getProgress failed', e, { batchId })
      throw e
    }
  },

  async getDetailPage(batchId: string): Promise<OnboardingBatchDetailPage | null> {
    supplierLog('onboarding-batch', 'getDetailPage start', { batchId })
    try {
      const [batchRow] = await db
        .select()
        .from(onboardingBatch)
        .where(eq(onboardingBatch.id, batchId))
        .limit(1)
      if (!batchRow) {
        supplierWarn('onboarding-batch', 'getDetailPage not found', { batchId })
        return null
      }

      const progress = await onboardingBatchDataAccess.getProgress(batchId)

      let contractNo: string | null = null
      if (batchRow.contractId) {
        const [contract] = await db
          .select({ contractNo: supplierContract.contractNo })
          .from(supplierContract)
          .where(eq(supplierContract.id, batchRow.contractId))
          .limit(1)
        contractNo = contract?.contractNo ?? null
      }

      const deviceRows = await db
        .select({
          id: supplierDevice.id,
          sn: supplierDevice.sn,
          assetNo: supplierDevice.assetNo,
          lifecycleStatus: supplierDevice.lifecycleStatus,
          onboardingSubstage: supplierDevice.onboardingSubstage,
          externalIp: supplierDevice.externalIp,
          internalIp: supplierDevice.internalIp,
          cooperationType: supplierDevice.cooperationType,
          devicePurpose: supplierDevice.devicePurpose,
          cardTypeCode: gpuCardType.code,
        })
        .from(onboardingBatchDeviceLink)
        .innerJoin(
          supplierDevice,
          eq(onboardingBatchDeviceLink.supplierDeviceId, supplierDevice.id),
        )
        .innerJoin(gpuCardType, eq(supplierDevice.gpuCardTypeId, gpuCardType.id))
        .where(eq(onboardingBatchDeviceLink.businessOnboardingBatchId, batchId))
        .orderBy(desc(onboardingBatchDeviceLink.linkedAt))

      const taskRows = await db
        .select({
          id: onboardingTask.id,
          onboardingBatchId: onboardingTask.onboardingBatchId,
          supplierDeviceId: onboardingTask.supplierDeviceId,
          taskType: onboardingTask.taskType,
          assigneeStaffId: onboardingTask.assigneeStaffId,
          assigneeName: userStaff.displayName,
          taskStatus: onboardingTask.taskStatus,
          startedAt: onboardingTask.startedAt,
          finishedAt: onboardingTask.finishedAt,
          deviceSn: supplierDevice.sn,
        })
        .from(onboardingTask)
        .innerJoin(userStaff, eq(onboardingTask.assigneeStaffId, userStaff.id))
        .leftJoin(supplierDevice, eq(onboardingTask.supplierDeviceId, supplierDevice.id))
        .where(eq(onboardingTask.onboardingBatchId, batchId))
        .orderBy(desc(onboardingTask.createdAt))

      let linkedHolds: OnboardingBatchLinkedHold[] = []
      if (batchRow.batchKind === 'internal_occupancy') {
        const holdRows = await db
          .select({
            id: internalTestHold.id,
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
          })
          .from(internalTestHold)
          .innerJoin(gpuCardType, eq(internalTestHold.gpuCardTypeId, gpuCardType.id))
          .where(eq(internalTestHold.onboardingBatchId, batchId))
          .orderBy(desc(internalTestHold.createdAt))

        linkedHolds = holdRows.map((row) => ({
          id: row.id,
          userName: row.userName ?? '—',
          department: (row.department ?? 'test') as OnboardingBatchLinkedHold['department'],
          settlementMode: (row.settlementMode ?? 'whole_rent') as OnboardingBatchLinkedHold['settlementMode'],
          gpuCardTypeId: row.gpuCardTypeId!,
          cardTypeCode: row.cardTypeCode ?? '—',
          cardTypeName: row.cardTypeName ?? row.cardTypeCode ?? '—',
          unitCount: row.unitCount ?? 0,
          holdFrom: row.holdFrom,
          holdUntil: row.holdUntil,
          remark: row.remark,
        }))
      }

      const detail: OnboardingBatchDetailPage = {
        batch: batchRow,
        contractNo,
        progress,
        devices: deviceRows,
        tasks: taskRows,
        linkedHolds,
      }

      supplierLog('onboarding-batch', 'getDetailPage done', {
        batchId,
        batchCode: batchRow.batchCode,
        deviceCount: detail.devices.length,
        taskCount: detail.tasks.length,
      })
      return detail
    } catch (e) {
      supplierError('onboarding-batch', 'getDetailPage failed', e, { batchId })
      throw e
    }
  },

  async listDatacenterUploadedDevices(
    batchId: string,
  ): Promise<OnboardingBatchDatacenterDevicesResult | null> {
    supplierLog('onboarding-batch', 'listDatacenterUploadedDevices start', { batchId })
    try {
      const [batchRow] = await db
        .select()
        .from(onboardingBatch)
        .where(eq(onboardingBatch.id, batchId))
        .limit(1)
      if (!batchRow) {
        supplierWarn('onboarding-batch', 'listDatacenterUploadedDevices batch not found', {
          batchId,
        })
        return null
      }

      const deviceRows = await db
        .select({
          id: supplierDevice.id,
          sn: supplierDevice.sn,
          externalDeviceId: supplierDevice.externalDeviceId,
          assetNo: supplierDevice.assetNo,
          internalIp: supplierDevice.internalIp,
          externalIp: supplierDevice.externalIp,
          gpuCount: supplierDevice.gpuCount,
          opsStatus: supplierDevice.opsStatus,
          lifecycleStatus: supplierDevice.lifecycleStatus,
          cooperationType: supplierDevice.cooperationType,
          devicePurpose: supplierDevice.devicePurpose,
          inMaintenance: supplierDevice.inMaintenance,
          cardTypeCode: gpuCardType.code,
          cardTypeName: gpuCardType.name,
        })
        .from(supplierDevice)
        .innerJoin(gpuCardType, eq(supplierDevice.gpuCardTypeId, gpuCardType.id))
        .where(
          and(
            eq(supplierDevice.supplierId, batchRow.supplierId),
            eq(supplierDevice.dataCenterId, batchRow.dataCenterId),
          ),
        )
        .orderBy(supplierDevice.sn)

      const linkRows = await db
        .select({ supplierDeviceId: onboardingBatchDeviceLink.supplierDeviceId })
        .from(onboardingBatchDeviceLink)
        .where(eq(onboardingBatchDeviceLink.businessOnboardingBatchId, batchId))

      const linkedIds = new Set(linkRows.map((r) => r.supplierDeviceId))
      const deviceIds = deviceRows.map((d) => d.id)

      const changeLogRows =
        deviceIds.length > 0
          ? await db
              .select({
                id: supplierDeviceChangeLog.id,
                supplierDeviceId: supplierDeviceChangeLog.supplierDeviceId,
                occurredAt: supplierDeviceChangeLog.occurredAt,
                changeAction: supplierDeviceChangeLog.changeAction,
                changeContent: supplierDeviceChangeLog.changeContent,
                description: supplierDeviceChangeLog.description,
                ticketNo: supplierDeviceChangeLog.ticketNo,
                importRowNo: supplierDeviceChangeLog.importRowNo,
                previousLifecycleStatus: supplierDeviceChangeLog.previousLifecycleStatus,
                newLifecycleStatus: supplierDeviceChangeLog.newLifecycleStatus,
                previousOpsStatus: supplierDeviceChangeLog.previousOpsStatus,
                newOpsStatus: supplierDeviceChangeLog.newOpsStatus,
                businessOnboardingBatchId: supplierDeviceChangeLog.businessOnboardingBatchId,
              })
              .from(supplierDeviceChangeLog)
              .where(inArray(supplierDeviceChangeLog.supplierDeviceId, deviceIds))
              .orderBy(desc(supplierDeviceChangeLog.occurredAt))
          : []

      const logsByDevice = new Map<string, OnboardingBatchDatacenterDevicesResult['devices'][0]['changeLogs']>()
      for (const log of changeLogRows) {
        const entry = {
          id: log.id,
          occurredAt: log.occurredAt,
          changeAction: log.changeAction,
          changeContent: log.changeContent,
          description: log.description,
          ticketNo: log.ticketNo,
          importRowNo: log.importRowNo,
          previousLifecycleStatus: log.previousLifecycleStatus,
          newLifecycleStatus: log.newLifecycleStatus,
          previousOpsStatus: log.previousOpsStatus,
          newOpsStatus: log.newOpsStatus,
          businessOnboardingBatchId: log.businessOnboardingBatchId,
          linkedToCurrentBatch: log.businessOnboardingBatchId === batchId,
        }
        const list = logsByDevice.get(log.supplierDeviceId) ?? []
        list.push(entry)
        logsByDevice.set(log.supplierDeviceId, list)
      }

      const devices = deviceRows.map((d) => ({
        ...d,
        linkedToBatch: linkedIds.has(d.id),
        changeLogs: logsByDevice.get(d.id) ?? [],
      }))

      const result: OnboardingBatchDatacenterDevicesResult = {
        dataCenterName: batchRow.dataCenterName,
        idcCode: batchRow.idcCode,
        totalDevices: devices.length,
        linkedDevices: linkedIds.size,
        devices,
      }

      supplierLog('onboarding-batch', 'listDatacenterUploadedDevices done', {
        batchId,
        totalDevices: result.totalDevices,
        linkedDevices: result.linkedDevices,
      })
      return result
    } catch (e) {
      supplierError('onboarding-batch', 'listDatacenterUploadedDevices failed', e, { batchId })
      throw e
    }
  },

  async parseList(params: {
    batchId: string
    fileName: string
    csvText: string
  }): Promise<OnboardingBatchParseListResult> {
    const batch = await getBusinessBatch(params.batchId)
    const result = parseInventoryCsv(params.csvText)
    if (!result.ok) {
      throw new Error(result.error)
    }

    const rows = inventoryRowsToParsed(result.rows)
    if (rows.length > batch.plannedDeviceCount) {
      throw new Error(`清单行数 ${rows.length} 超过计划总台数 ${batch.plannedDeviceCount}`)
    }

    const okCount = rows.filter((r) => r.parse_status === 'ok').length
    const previewRows = rows.map((r) => ({ ...r, root_password: maskPassword(r.root_password) }))
    const now = new Date()

    await db
      .update(onboardingBatch)
      .set({
        importFileName: params.fileName,
        importStatus: 'parsed',
        parsedRowCount: rows.length,
        parsedSuccessCount: okCount,
        parsedRowsJson: previewRows,
        parsedAt: now,
        updatedAt: now,
      })
      .where(eq(onboardingBatch.id, params.batchId))

    return { rowCount: rows.length, okCount, rows: previewRows }
  },

  async commitList(params: {
    batchId: string
    operatorStaffId?: string | null
  }): Promise<OnboardingBatchCommitListResult> {
    const batch = await getBusinessBatch(params.batchId)
    const parsedRows = (batch.parsedRowsJson as OnboardingParsedRow[] | null) ?? []
    const okRows = parsedRows.filter((r) => r.parse_status === 'ok')

    if (okRows.length === 0) {
      throw new Error('没有通过校验的行可入库')
    }
    if (batch.importStatus !== 'parsed') {
      throw new Error('批次尚未完成清单解析，无法入库')
    }

    const plannedLines = ((batch.plannedLinesJson as Record<string, unknown>[] | null) ?? []).map(
      readPlannedLine,
    )
    const defaultLine = plannedLines[0]
    if (!defaultLine?.gpuCardTypeId) {
      throw new Error('批次缺少有效的上架计划卡型')
    }

    const defaultCooperation = (defaultLine.cooperationType ?? 'idle_time') as DeviceCooperationType
    const defaultCard = await db.query.gpuCardType.findFirst({
      where: eq(gpuCardType.id, defaultLine.gpuCardTypeId),
      columns: { name: true, code: true, deviceRole: true },
    })
    const defaultCardRole = resolveGpuCardTypeRole({
      name: defaultCard?.name ?? '',
      code: defaultCard?.code,
      deviceRole: defaultCard?.deviceRole,
    })
    const now = new Date()
    let inserted = 0

    try {
      await db.transaction(async (tx) => {
        for (let idx = 0; idx < okRows.length; idx++) {
          const row = okRows[idx]!
          const deviceId = newId()
          const sn = row.sn?.trim() || `SN-${Date.now().toString(36).slice(-6)}-${idx + 1}`
          const asset = row.asset_no?.trim() || `AST-${batch.idcCode}-${String(idx + 1).padStart(5, '0')}`

          await tx.insert(supplierDevice).values({
            id: deviceId,
            supplierId: batch.supplierId,
            contractId: batch.contractId,
            onboardingBatchId: null,
            dataCenterId: batch.dataCenterId,
            gpuCardTypeId: defaultLine.gpuCardTypeId,
            externalDeviceId: null,
            assetNo: asset,
            sn,
            idcCode: batch.idcCode,
            idcRegion: batch.idcRegion,
            gpuCount: resolveDeviceGpuCount(row.gpu_count, defaultCardRole),
            externalIp: row.public_ip || null,
            internalIp: row.private_ip || null,
            opsStatus: '网关直连裸金属上架中',
            lifecycleStatus: '接入中',
            inMaintenance: false,
            onboardingSubstage: '待施工',
            cooperationType: defaultCooperation,
            loginUsername: row.root_account || null,
            loginPassword: row.root_password || null,
            createdAt: now,
            updatedAt: now,
          })
          inserted++
        }

        await tx
          .update(onboardingBatch)
          .set({
            importStatus: 'committed',
            batchStatus: '接入中',
            committedDeviceCount: inserted,
            committedAt: now,
            updatedAt: now,
          })
          .where(eq(onboardingBatch.id, batch.id))

        await tx.insert(supplierActivity).values({
          id: newId(),
          supplierId: batch.supplierId,
          type: 'ops_import',
          title: `接入批次 ${batch.batchCode} 已入库`,
          description: `共入库 ${inserted} 台物理机`,
          authorStaffId: params.operatorStaffId ?? null,
          authorName: '运营',
          authorRole: 'ops',
          refDomain: 'batch',
          refId: batch.id,
          occurredAt: now,
          createdAt: now,
        })
      })
    } catch (e) {
      supplierError('onboarding-batch', 'commitList failed', e, { batchId: params.batchId })
      throw e
    }

    return { committedCount: inserted }
  },

  async listProgressEvents(batchId: string) {
    const rows = await db
      .select()
      .from(onboardingBatchProgressEvent)
      .where(eq(onboardingBatchProgressEvent.onboardingBatchId, batchId))
      .orderBy(desc(onboardingBatchProgressEvent.occurredAt))

    return rows.map((row) => ({
      ...row,
      eventTypeLabel:
        BATCH_PROGRESS_EVENT_TYPE_LABELS[
          row.eventType as keyof typeof BATCH_PROGRESS_EVENT_TYPE_LABELS
        ] ?? row.eventType,
    }))
  },

  async listAdjustHistory(batchId: string) {
    return db
      .select()
      .from(supplierActivity)
      .where(
        and(
          eq(supplierActivity.refDomain, 'batch'),
          eq(supplierActivity.refId, batchId),
          eq(supplierActivity.type, 'batch_plan_adjusted'),
        ),
      )
      .orderBy(desc(supplierActivity.occurredAt))
  },

  async adjustPlan(input: {
    batchId: string
    reason: string
    effectiveAt?: string
    planLines: OnboardingBatchCreateInput['planLines']
    plannedReadyAt?: string
    batchStatus?: string
    operatorStaffId?: string | null
    operatorName?: string | null
  }) {
    const batch = await loadBatchForAdjust(input.batchId)
    if ((ADJUST_TERMINAL_STATUSES as readonly string[]).includes(batch.batchStatus)) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: '已完成或已取消的批次不可调整计划',
      })
    }

    const effectiveAt = parseEffectiveAt(input.effectiveAt, batch.createdAt)
    const gpuCache = new Map<string, string>()
    const plannedLines = await normalizePlanLines(input.planLines, gpuCache)
    const plannedDeviceCount = sumPlannedQuantity(plannedLines)
    const plannedGpuCount = await computePlannedGpuCount(
      batch.supplierId,
      batch.dataCenterId,
      plannedLines,
    )

    if (plannedDeviceCount < batch.touchedDeviceCount) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `计划台数（${plannedDeviceCount}）不能小于已触达台数（${batch.touchedDeviceCount}）`,
      })
    }

    const beforeLines = ((batch.plannedLinesJson as OnboardingBatchPlannedLineJson[] | null) ?? [])
    const before = {
      planned_device_count: batch.plannedDeviceCount,
      planned_gpu_count: batch.plannedGpuCount,
      planned_lines: beforeLines,
      batch_status: batch.batchStatus,
      planned_ready_at: batch.plannedReadyAt?.toISOString() ?? null,
    }
    const after = {
      planned_device_count: plannedDeviceCount,
      planned_gpu_count: plannedGpuCount,
      planned_lines: plannedLines,
      batch_status: input.batchStatus?.trim() || batch.batchStatus,
      planned_ready_at: input.plannedReadyAt
        ? new Date(input.plannedReadyAt).toISOString()
        : batch.plannedReadyAt?.toISOString() ?? null,
    }

    const planChanged =
      plannedDeviceCount !== batch.plannedDeviceCount ||
      plannedGpuCount !== batch.plannedGpuCount ||
      JSON.stringify(plannedLines) !== JSON.stringify(beforeLines) ||
      (input.plannedReadyAt != null &&
        batch.plannedReadyAt?.toISOString() !== new Date(input.plannedReadyAt).toISOString())

    const statusChanged =
      Boolean(input.batchStatus?.trim()) && input.batchStatus!.trim() !== batch.batchStatus

    if (!planChanged && !statusChanged) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: '未检测到计划或状态变更' })
    }

    const activityId = newId()
    const diff: Record<string, [unknown, unknown]> = {
      planned_device_count: [before.planned_device_count, after.planned_device_count],
      planned_gpu_count: [before.planned_gpu_count, after.planned_gpu_count],
    }
    if (statusChanged) {
      diff.batch_status = [before.batch_status, after.batch_status]
    }

    const description = `计划台数 ${before.planned_device_count}→${after.planned_device_count}；GPU ${before.planned_gpu_count}→${after.planned_gpu_count}${statusChanged ? `；状态 ${before.batch_status}→${after.batch_status}` : ''}；原因：${input.reason}`

    await db.transaction(async (tx) => {
      await tx
        .update(onboardingBatch)
        .set({
          plannedLinesJson: plannedLines,
          plannedDeviceCount,
          plannedGpuCount,
          plannedReadyAt: input.plannedReadyAt ? new Date(input.plannedReadyAt) : batch.plannedReadyAt,
          batchStatus: statusChanged ? input.batchStatus!.trim() : batch.batchStatus,
          updatedAt: new Date(),
        })
        .where(eq(onboardingBatch.id, batch.id))

      if (planChanged) {
        await replacePlanLines(tx, batch.id, plannedLines)
      }

      const progressResult = await appendBatchProgressEvent({
        batchId: batch.id,
        eventType: planChanged ? 'plan_revised' : 'status_changed',
        occurredAt: effectiveAt,
        tx,
        payload: {
          source: 'manual_ui',
          reason: input.reason,
          activity_id: activityId,
          operator_staff_id: input.operatorStaffId ?? undefined,
          diff,
        },
      })

      if (statusChanged && planChanged) {
        await appendBatchProgressEvent({
          batchId: batch.id,
          eventType: 'status_changed',
          occurredAt: effectiveAt,
          tx,
          payload: {
            source: 'manual_ui',
            reason: input.reason,
            activity_id: activityId,
            operator_staff_id: input.operatorStaffId ?? undefined,
            diff: {
              batch_status: [before.batch_status, after.batch_status] as [unknown, unknown],
            },
          },
        })
      } else if (statusChanged && !planChanged) {
        // already written as status_changed above
      }

      const newStatus = statusChanged ? input.batchStatus!.trim() : batch.batchStatus
      if (newStatus === '已完成') {
        await appendBatchProgressEvent({
          batchId: batch.id,
          eventType: 'batch_completed',
          occurredAt: effectiveAt,
          tx,
          payload: { source: 'manual_ui', reason: input.reason },
        })
      } else if (newStatus === '已取消' || newStatus === 'cancelled') {
        await appendBatchProgressEvent({
          batchId: batch.id,
          eventType: 'batch_cancelled',
          occurredAt: effectiveAt,
          tx,
          payload: { source: 'manual_ui', reason: input.reason },
        })
      }

      await tx.insert(supplierActivity).values({
        id: activityId,
        supplierId: batch.supplierId,
        type: 'batch_plan_adjusted',
        title: batch.batchKind === 'device_retire' ? '手动调整下架计划' : '手动调整上架计划',
        description,
        authorStaffId: input.operatorStaffId ?? null,
        authorName: input.operatorName ?? '运营',
        authorRole: 'ops',
        refDomain: 'batch',
        refId: batch.id,
        metadata: {
          source: 'manual_ui',
          reason: input.reason,
          effective_at: effectiveAt.toISOString(),
          before,
          after,
          progress_event_id: progressResult.eventId ?? null,
          operator_staff_id: input.operatorStaffId ?? null,
        },
        occurredAt: effectiveAt,
        createdAt: new Date(),
      })
    })

    supplierLog('onboarding-batch', 'adjustPlan done', { batchId: batch.id, plannedDeviceCount })

    return { batchId: batch.id, plannedDeviceCount, plannedGpuCount }
  },

  async completeBatch(input: {
    batchId: string
    remark?: string
    operatorStaffId?: string | null
    operatorName?: string | null
  }) {
    return applyBatchLifecycleStatus({
      batchId: input.batchId,
      targetStatus: BATCH_STATUS_COMPLETED,
      remark: input.remark,
      operatorStaffId: input.operatorStaffId,
      operatorName: input.operatorName,
    })
  },

  async voidBatch(input: {
    batchId: string
    reason: string
    operatorStaffId?: string | null
    operatorName?: string | null
  }) {
    return applyBatchLifecycleStatus({
      batchId: input.batchId,
      targetStatus: BATCH_STATUS_VOIDED,
      reason: input.reason,
      operatorStaffId: input.operatorStaffId,
      operatorName: input.operatorName,
    })
  },
}
