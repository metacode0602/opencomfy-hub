import { db } from '@/lib/db'
import { parseDatacenterRetireListText } from '@/lib/supplier/parse-datacenter-retire-list'
import { validateDatacenterRetireList } from '@/lib/supplier/datacenter-retire-list-validation'
import {
  buildClientDatacenterRetirePreview,
  resolveRetireActionType,
  resolveRetirePlanMode,
} from '@/lib/supplier/datacenter-device-retire-ui'
import { generateImportBatchCode } from '@/lib/supplier/device-import-utils'
import {
  getDeviceRetireReasonLabel,
  isDeviceRetireFileName,
  DEVICE_RETIRE_MAX_BYTES,
  type DeviceRetireReason,
} from '@/lib/types/device-retire'
import type {
  DatacenterRetireAvailability,
  DatacenterRetireCommitResult,
  DatacenterRetireContext,
  DatacenterRetireListParseResult,
  DatacenterRetireListSampleRow,
  DatacenterRetirePlanLine,
  DatacenterRetirePreviewResult,
  RetireActionType,
} from '@/lib/types/datacenter-device-retire'
import type { OnboardingBatchPlannedLineJson } from '@/lib/types/onboarding-batch-api'
import {
  DEVICE_COOPERATION_TYPE_LABELS,
  type DeviceCooperationType,
} from '@/lib/types/supplier-domain'
import { appendBatchProgressEvent } from '@/lib/server/aggregation/batch-progress-events'
import { supplierLog, supplierError } from '@/lib/server/dataaccess/supplier/logger'
import { resolveOnboardingBatchRefs } from '@/lib/server/dataaccess/supplier/physical-devices'
import { mapDbDeviceToDomain } from '@/lib/server/dataaccess/supplier/datacenter-retire-shared'
import {
  dataCenter,
  gpuCardType,
  onboardingBatch,
  supplier,
  supplierActivity,
  supplierDevice,
  supplierGpuInventory,
} from '@workspace/db/schema'
import { and, eq, gt, ne, sql } from 'drizzle-orm'

export type DatacenterRetireRequestInput = {
  dataCenterId: string
  meta: {
    reason: DeviceRetireReason
    retireActionType?: RetireActionType
    expectedCompletionDate: string
    workOrderNo: string
    remark?: string
  }
  planLines: Array<{
    gpuCardTypeId?: string
    gpuCardTypeCode: string
    cooperationType: DeviceCooperationType
    plannedQuantity: number
  }>
  uploadList: boolean
  listFile?: {
    fileName: string
    fileBase64: string
  }
  operatorStaffId?: string | null
  operatorName?: string | null
}

function newId() {
  return crypto.randomUUID()
}

function parseExpectedDate(value: string): Date {
  const d = new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) {
    throw new Error('期望完成日期格式无效')
  }
  return d
}

async function loadDataCenterById(dataCenterId: string) {
  const [hit] = await db
    .select({
      dataCenter: dataCenter,
      supplierName: supplier.name,
    })
    .from(dataCenter)
    .innerJoin(supplier, eq(dataCenter.supplierId, supplier.id))
    .where(eq(dataCenter.id, dataCenterId))
    .limit(1)
  if (!hit) throw new Error('机房不存在')
  return hit
}

async function resolveGpuCardTypeId(codeOrId: string, cache: Map<string, string>): Promise<string> {
  const cached = cache.get(codeOrId)
  if (cached) return cached

  const byId = await db.query.gpuCardType.findFirst({
    where: eq(gpuCardType.id, codeOrId),
    columns: { id: true, code: true, name: true },
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

async function normalizePlanLines(
  dataCenterId: string,
  planLines: DatacenterRetireRequestInput['planLines'],
): Promise<DatacenterRetirePlanLine[]> {
  const gpuCache = new Map<string, string>()
  const cardTypes = await queryCardTypesInDataCenter(dataCenterId)
  const cardTypeIds = new Set(cardTypes.map((c) => c.id))
  const normalized: DatacenterRetirePlanLine[] = []

  for (const line of planLines) {
    const gpuCardTypeId = await resolveGpuCardTypeId(line.gpuCardTypeId ?? line.gpuCardTypeCode, gpuCache)
    if (!cardTypeIds.has(gpuCardTypeId)) {
      throw new Error('所选卡型在本机房不存在')
    }
    const card = await db.query.gpuCardType.findFirst({
      where: eq(gpuCardType.id, gpuCardTypeId),
      columns: { code: true, name: true },
    })
    normalized.push({
      gpuCardTypeId,
      gpuCardTypeCode: card?.code ?? line.gpuCardTypeCode,
      gpuCardTypeName: card?.name ?? line.gpuCardTypeCode,
      cooperationType: line.cooperationType,
      plannedQuantity: line.plannedQuantity,
    })
  }

  return normalized
}

async function queryCardTypesInDataCenter(dataCenterId: string) {
  const rows = await db
    .select({
      id: gpuCardType.id,
      code: gpuCardType.code,
      name: gpuCardType.name,
    })
    .from(supplierGpuInventory)
    .innerJoin(gpuCardType, eq(supplierGpuInventory.gpuCardTypeId, gpuCardType.id))
    .where(and(eq(supplierGpuInventory.dataCenterId, dataCenterId), gt(supplierGpuInventory.quantity, 0)))

  const map = new Map<string, { id: string; code: string; name: string }>()
  for (const row of rows) {
    map.set(row.id, { id: row.id, code: row.code ?? row.id, name: row.name })
  }
  return [...map.values()]
}

async function queryAvailability(dataCenterId: string): Promise<DatacenterRetireAvailability[]> {
  const [dc] = await db
    .select({ supplierId: dataCenter.supplierId })
    .from(dataCenter)
    .where(eq(dataCenter.id, dataCenterId))
    .limit(1)
  if (!dc) return []

  const rows = await db
    .select({
      gpuCardTypeId: supplierDevice.gpuCardTypeId,
      cooperationType: supplierDevice.cooperationType,
      cardCode: gpuCardType.code,
      cardName: gpuCardType.name,
      listedQuantity: sql<number>`count(*)::int`.mapWith(Number),
    })
    .from(supplierDevice)
    .innerJoin(gpuCardType, eq(supplierDevice.gpuCardTypeId, gpuCardType.id))
    .where(
      and(
        eq(supplierDevice.dataCenterId, dataCenterId),
        eq(supplierDevice.supplierId, dc.supplierId),
        eq(supplierDevice.lifecycleStatus, '在线'),
        ne(supplierDevice.opsStatus, '已退订'),
      ),
    )
    .groupBy(
      supplierDevice.gpuCardTypeId,
      supplierDevice.cooperationType,
      gpuCardType.code,
      gpuCardType.name,
    )

  return rows.map((r) => ({
    gpuCardTypeId: r.gpuCardTypeId,
    gpuCardTypeCode: r.cardCode ?? r.gpuCardTypeId,
    gpuCardTypeName: r.cardName,
    cooperationType: (r.cooperationType ?? 'idle_time') as DeviceCooperationType,
    listedQuantity: r.listedQuantity,
  }))
}

function validatePlanAgainstAvailability(
  planLines: DatacenterRetirePlanLine[],
  availability: DatacenterRetireAvailability[],
) {
  for (const line of planLines) {
    const max =
      availability.find(
        (a) =>
          a.gpuCardTypeId === line.gpuCardTypeId && a.cooperationType === line.cooperationType,
      )?.listedQuantity ?? 0
    if (max <= 0) {
      throw new Error(
        `${line.gpuCardTypeName} · ${DEVICE_COOPERATION_TYPE_LABELS[line.cooperationType]} 在本机房无可下架设备`,
      )
    }
    if (line.plannedQuantity > max) {
      throw new Error(`下架数量不能超过可下架数量（当前 ${max} 台）`)
    }
  }
}

async function assertWorkOrderUnique(supplierId: string, workOrderNo: string) {
  const [dup] = await db
    .select({ id: onboardingBatch.id })
    .from(onboardingBatch)
    .where(
      and(eq(onboardingBatch.supplierId, supplierId), eq(onboardingBatch.workOrderNo, workOrderNo)),
    )
    .limit(1)
  if (dup) {
    throw new Error(`该供应商下飞书工单号「${workOrderNo}」已存在，请更换后重试`)
  }
}

async function listDevicesInDataCenter(supplierId: string, dataCenterId: string) {
  const rows = await db
    .select({ device: supplierDevice, cardTypeName: gpuCardType.name })
    .from(supplierDevice)
    .innerJoin(gpuCardType, eq(supplierDevice.gpuCardTypeId, gpuCardType.id))
    .where(
      and(eq(supplierDevice.supplierId, supplierId), eq(supplierDevice.dataCenterId, dataCenterId)),
    )
  return rows.map(({ device, cardTypeName }) => mapDbDeviceToDomain(device, cardTypeName))
}

function parseListFile(fileName: string, fileBase64: string): string {
  if (!isDeviceRetireFileName(fileName)) {
    throw new Error('仅支持 .csv / .tsv / .txt 清单文件')
  }
  const buffer = Buffer.from(fileBase64, 'base64')
  if (buffer.length > DEVICE_RETIRE_MAX_BYTES) {
    throw new Error('文件不能超过 10MB')
  }
  return buffer.toString('utf-8')
}

async function buildListParseResult(
  input: DatacenterRetireRequestInput,
  planLines: DatacenterRetirePlanLine[],
  hit: Awaited<ReturnType<typeof loadDataCenterById>>,
): Promise<DatacenterRetireListParseResult | undefined> {
  if (!input.uploadList || !input.listFile) return undefined

  const csvText = parseListFile(input.listFile.fileName, input.listFile.fileBase64)
  const { rows: parsedRows, originalHeaders } = parseDatacenterRetireListText(csvText)
  const cardTypes = await queryCardTypesInDataCenter(input.dataCenterId)
  const devicesInDc = await listDevicesInDataCenter(hit.dataCenter.supplierId, input.dataCenterId)

  return validateDatacenterRetireList({
    parsedRows,
    originalHeaders,
    fileName: input.listFile.fileName,
    planLines,
    cardTypes,
    devicesInDc,
  })
}

function toPlannedLinesJson(lines: DatacenterRetirePlanLine[]): OnboardingBatchPlannedLineJson[] {
  return lines.map((l) => ({
    gpuCardTypeId: l.gpuCardTypeId,
    gpuCardTypeCode: l.gpuCardTypeCode,
    cooperationType: l.cooperationType,
    plannedQuantity: l.plannedQuantity,
  }))
}

async function buildPreview(
  input: DatacenterRetireRequestInput,
): Promise<DatacenterRetirePreviewResult> {
  parseExpectedDate(input.meta.expectedCompletionDate)
  const hit = await loadDataCenterById(input.dataCenterId)
  const availability = await queryAvailability(input.dataCenterId)
  const cardTypes = await queryCardTypesInDataCenter(input.dataCenterId)
  const planMode = resolveRetirePlanMode(input.meta.reason)
  const actionType = resolveRetireActionType(
    input.meta.reason,
    input.meta.retireActionType ?? '',
  )

  let planLines: DatacenterRetirePlanLine[] = []
  let list: DatacenterRetireListParseResult | undefined

  if (planMode === 'line_plan') {
    planLines = await normalizePlanLines(input.dataCenterId, input.planLines)
    validatePlanAgainstAvailability(planLines, availability)
    list = await buildListParseResult(input, planLines, hit)
  }

  const context: DatacenterRetireContext = {
    dataCenterId: hit.dataCenter.id,
    dataCenterName: hit.dataCenter.name,
    supplierId: hit.dataCenter.supplierId,
    supplierName: hit.supplierName,
    cardTypes,
    availability,
  }

  return buildClientDatacenterRetirePreview({
    context,
    meta: {
      reason: input.meta.reason,
      retireActionType: actionType,
      expectedCompletionDate: input.meta.expectedCompletionDate,
      workOrderNo: input.meta.workOrderNo.trim(),
      remark: input.meta.remark?.trim(),
    },
    retireActionType: actionType,
    planLines,
    list,
  })
}

async function listRetireListSampleRows(
  dataCenterId: string,
  planLines: DatacenterRetireRequestInput['planLines'],
): Promise<DatacenterRetireListSampleRow[]> {
  const hit = await loadDataCenterById(dataCenterId)
  const normalized = await normalizePlanLines(dataCenterId, planLines)
  const rows: DatacenterRetireListSampleRow[] = []

  for (const line of normalized) {
    const devices = await db
      .select({
        externalIp: supplierDevice.externalIp,
        internalIp: supplierDevice.internalIp,
        externalDeviceId: supplierDevice.externalDeviceId,
        assetNo: supplierDevice.assetNo,
        cardName: gpuCardType.name,
      })
      .from(supplierDevice)
      .innerJoin(gpuCardType, eq(supplierDevice.gpuCardTypeId, gpuCardType.id))
      .where(
        and(
          eq(supplierDevice.dataCenterId, dataCenterId),
          eq(supplierDevice.supplierId, hit.dataCenter.supplierId),
          eq(supplierDevice.gpuCardTypeId, line.gpuCardTypeId),
          eq(supplierDevice.cooperationType, line.cooperationType),
          eq(supplierDevice.lifecycleStatus, '在线'),
          ne(supplierDevice.opsStatus, '已退订'),
        ),
      )
      .limit(line.plannedQuantity)

    if (devices.length < line.plannedQuantity) {
      throw new Error(
        `${line.gpuCardTypeName} · ${DEVICE_COOPERATION_TYPE_LABELS[line.cooperationType]} 可下架设备不足（需要 ${line.plannedQuantity} 台，仅 ${devices.length} 台）`,
      )
    }

    for (const device of devices) {
      rows.push({
        gpuCardTypeName: device.cardName ?? line.gpuCardTypeName,
        cooperationType: DEVICE_COOPERATION_TYPE_LABELS[line.cooperationType],
        externalIp: device.externalIp ?? '',
        internalIp: device.internalIp ?? '',
        externalDeviceId: device.externalDeviceId ?? '',
        assetNo: device.assetNo ?? '',
      })
    }
  }

  return rows
}

export const datacenterDeviceRetireDataAccess = {
  async getContext(dataCenterId: string): Promise<DatacenterRetireContext> {
    const hit = await loadDataCenterById(dataCenterId)
    const cardTypes = await queryCardTypesInDataCenter(dataCenterId)
    const availability = await queryAvailability(dataCenterId)
    return {
      dataCenterId: hit.dataCenter.id,
      dataCenterName: hit.dataCenter.name,
      supplierId: hit.dataCenter.supplierId,
      supplierName: hit.supplierName,
      cardTypes,
      availability,
    }
  },

  listRetireListSampleRows,

  async preview(input: DatacenterRetireRequestInput): Promise<DatacenterRetirePreviewResult> {
    supplierLog('datacenter-device-retire', 'preview start', {
      dataCenterId: input.dataCenterId,
      reason: input.meta.reason,
      uploadList: input.uploadList,
    })
    try {
      const preview = await buildPreview(input)
      supplierLog('datacenter-device-retire', 'preview done', {
        dataCenterId: input.dataCenterId,
        valid: preview.valid,
        scenario: preview.scenarioLabel,
        planned: preview.totalPlannedQuantity,
        listOk: preview.list?.summary.ok,
        errors: preview.errors.length,
      })
      return preview
    } catch (e) {
      supplierError('datacenter-device-retire', 'preview failed', e, {
        dataCenterId: input.dataCenterId,
      })
      throw e
    }
  },

  async commit(
    input: DatacenterRetireRequestInput,
  ): Promise<DatacenterRetireCommitResult & { batchId: string }> {
    supplierLog('datacenter-device-retire', 'commit start', {
      dataCenterId: input.dataCenterId,
      reason: input.meta.reason,
    })

    const preview = await buildPreview(input)
    if (!preview.valid) {
      const msg = preview.errors[0] ?? '校验未通过，无法提交'
      supplierError('datacenter-device-retire', 'commit validation failed', new Error(msg), {
        dataCenterId: input.dataCenterId,
        errors: preview.errors,
      })
      throw new Error(msg)
    }

    const hit = await loadDataCenterById(input.dataCenterId)
    const supplierRow = await db.query.supplier.findFirst({
      where: eq(supplier.id, hit.dataCenter.supplierId),
      columns: { id: true, code: true, name: true, shortName: true },
    })
    if (!supplierRow) throw new Error('供应商不存在')

    const workOrderNo = input.meta.workOrderNo.trim()
    await assertWorkOrderUnique(supplierRow.id, workOrderNo)

    const { contractId, accessSheetId } = await resolveOnboardingBatchRefs(supplierRow.id)
    parseExpectedDate(input.meta.expectedCompletionDate)
    const now = new Date()
    const batchId = newId()
    const batchCode = generateImportBatchCode('device_retire')
    const plannedLinesJson = toPlannedLinesJson(preview.planLines)
    const plannedDeviceCount = preview.totalPlannedQuantity
    const hasList = Boolean(preview.list && preview.list.summary.ok > 0)

    try {
      await db.transaction(async (tx) => {
        await tx.insert(onboardingBatch).values({
          id: batchId,
          batchKind: 'device_retire',
          supplierId: supplierRow.id,
          supplierCode: supplierRow.code,
          supplierName: supplierRow.name,
          supplierShortName: supplierRow.shortName,
          dataCenterId: hit.dataCenter.id,
          idcCode: hit.dataCenter.code,
          dataCenterName: hit.dataCenter.name,
          idcRegion: hit.dataCenter.location,
          contractId,
          accessConditionSheetId: accessSheetId,
          batchCode,
          batchStatus: '待开始',
          plannedLinesJson,
          plannedDeviceCount,
          workOrderNo,
          accessMethod: 'on_site',
          importFileName: preview.list?.fileName ?? null,
          importStatus: hasList ? 'parsed' : 'none',
          parsedRowCount: preview.list?.summary.total ?? 0,
          parsedSuccessCount: preview.list?.summary.ok ?? 0,
          parsedRowsJson: preview.list?.rows ?? [],
          parsedAt: hasList ? now : null,
          committedDeviceCount: 0,
          retiredDeviceCount: 0,
          committedAt: null,
          retireReason: input.meta.reason,
          retireActionType: preview.retireActionType,
          retirePlanMode: preview.retirePlanMode,
          expectedCompletionDate: input.meta.expectedCompletionDate,
          retireRemark: input.meta.remark?.trim() || null,
          remark: input.meta.remark?.trim() || null,
          listUploadMode: input.uploadList ? 'simplified_csv' : 'none',
          progressFlagsJson: {},
          createdByStaffId: input.operatorStaffId ?? null,
          createdAt: now,
          updatedAt: now,
        })

        await tx.insert(supplierActivity).values({
          id: newId(),
          supplierId: supplierRow.id,
          type: 'device_retire',
          title: `机房 ${hit.dataCenter.name} ${preview.scenarioLabel}计划已创建`,
          description: `${getDeviceRetireReasonLabel(input.meta.reason)} · 工单 ${workOrderNo} · 计划 ${plannedDeviceCount} 台 · 请运维通过变更表更新设备状态`,
          authorStaffId: input.operatorStaffId ?? null,
          authorName: input.operatorName ?? '运营',
          authorRole: 'ops',
          refDomain: 'batch',
          refId: batchId,
          metadata: {
            batchCode,
            dataCenterId: hit.dataCenter.id,
            workOrderNo,
            plannedDeviceCount,
            retirePlanMode: preview.retirePlanMode,
            retireActionType: preview.retireActionType,
            hasList,
          },
          occurredAt: now,
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
      supplierError('datacenter-device-retire', 'commit failed', e, {
        dataCenterId: input.dataCenterId,
      })
      throw e
    }

    supplierLog('datacenter-device-retire', 'commit done', {
      batchId,
      batchCode,
      scenario: preview.scenarioLabel,
      plannedDeviceCount,
      hasList,
    })

    return {
      batchCount: 1,
      retiredCount: 0,
      skippedCount: preview.list?.summary.error ?? 0,
      batchCodes: [batchCode],
      meta: preview.meta,
      batchId,
      dataCenterId: hit.dataCenter.id,
      dataCenterName: hit.dataCenter.name,
      workOrderNo: preview.meta.workOrderNo,
      plannedLines: preview.planLines,
      totalPlannedQuantity: plannedDeviceCount,
      retirePlanMode: preview.retirePlanMode,
      retireActionType: preview.retireActionType,
      scenarioLabel: preview.scenarioLabel,
      changelogActionHint: preview.changelogActionHint,
    }
  },
}
