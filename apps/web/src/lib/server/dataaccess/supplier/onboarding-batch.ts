import { db } from '@/lib/db'
import { parseInventoryCsv } from '@/lib/supplier-ops/parse-inventory-csv'
import { generateBatchCode, inventoryRowsToParsed, maskPassword } from '@/lib/supplier/onboarding-batch-utils'
import type {
  OnboardingBatchCommitListResult,
  OnboardingBatchCreateInput,
  OnboardingBatchCreateResult,
  OnboardingBatchDetailPage,
  OnboardingBatchListItem,
  OnboardingBatchParseListResult,
  OnboardingBatchProgress,
} from '@/lib/types/onboarding-batch-api'
import type {
  DeviceCooperationType,
  OnboardingBatchPlanLine,
  OnboardingParsedRow,
} from '@/lib/types/supplier-domain'
import { supplierLog, supplierWarn, supplierError } from '@/lib/server/dataaccess/supplier/logger'
import {
  accessConditionSheet,
  gpuCardType,
  onboardingBatch,
  onboardingTask,
  supplier,
  supplierActivity,
  supplierContract,
  supplierDevice,
  dataCenter,
  userStaff,
} from '@workspace/db/schema'
import { and, desc, eq, ilike, inArray, or } from 'drizzle-orm'

function newId() {
  return crypto.randomUUID()
}

type BatchRow = typeof onboardingBatch.$inferSelect

function mapBatchRow(row: BatchRow): OnboardingBatchListItem {
  return {
    id: row.id,
    batch_kind: row.batchKind as OnboardingBatchListItem['batch_kind'],
    supplier_id: row.supplierId,
    supplier_code: row.supplierCode,
    supplier_name: row.supplierName,
    supplier_short_name: row.supplierShortName ?? '',
    data_center_id: row.dataCenterId,
    idc_code: row.idcCode,
    data_center_name: row.dataCenterName,
    idc_region: row.idcRegion ?? '',
    contract_id: row.contractId,
    access_condition_sheet_id: row.accessConditionSheetId,
    batch_code: row.batchCode,
    batch_status: row.batchStatus,
    planned_ready_at: row.plannedReadyAt?.toISOString() ?? null,
    online_reason: row.onlineReason,
    order_no: row.orderNo,
    remark: row.remark,
    planned_lines: (row.plannedLinesJson as OnboardingBatchPlanLine[] | null) ?? [],
    planned_device_count: row.plannedDeviceCount,
    work_order_no: row.workOrderNo,
    access_method: row.accessMethod,
    import_file_name: row.importFileName ?? '未上传',
    import_status: row.importStatus as OnboardingBatchListItem['import_status'],
    parse_error: row.parseError,
    parsed_row_count: row.parsedRowCount,
    parsed_success_count: row.parsedSuccessCount,
    parsed_rows_json: (row.parsedRowsJson as OnboardingBatchListItem['parsed_rows_json']) ?? null,
    parsed_at: row.parsedAt?.toISOString() ?? null,
    committed_device_count: row.committedDeviceCount,
    committed_at: row.committedAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
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
): Promise<OnboardingBatchPlanLine[]> {
  return Promise.all(
    planLines.map(async (line) => {
      const key = line.gpuCardTypeId ?? line.gpuCardTypeCode
      const gpuCardTypeId = await resolveGpuCardTypeId(key, gpuCache)
      const card = await db.query.gpuCardType.findFirst({
        where: eq(gpuCardType.id, gpuCardTypeId),
        columns: { code: true },
      })
      return {
        gpu_card_type_id: gpuCardTypeId,
        gpu_card_type_code: card?.code ?? line.gpuCardTypeCode,
        cooperation_type: line.cooperationType,
        planned_quantity: line.plannedQuantity,
      }
    }),
  )
}

function sumPlannedQuantity(lines: OnboardingBatchPlanLine[]) {
  return lines.reduce((sum, line) => sum + line.planned_quantity, 0)
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
  if (row.batchKind !== 'online' && row.batchKind !== 'order_access') {
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

    const batchId = newId()
    const batchCode = generateBatchCode(input.batchKind)
    const workOrderNo = `WO-${batchCode}`
    const now = new Date()
    const listUploadMode = input.uploadList ? 'simplified_csv' : 'none'
    const importStatus = input.uploadList ? 'draft' : 'none'
    const batchStatus = input.uploadList ? '待开始' : '接入中'

    try {
      await db.insert(onboardingBatch).values({
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
        createdAt: now,
        updatedAt: now,
      })

      await db.insert(supplierActivity).values({
        id: newId(),
        supplierId: input.supplierId,
        type: 'batch_started',
        title: `${input.batchKind === 'online' ? '设备上架' : '订单接入'}批次 ${batchCode} 已创建`,
        description: `计划上架 ${plannedDeviceCount} 台；工单号 ${workOrderNo}`,
        authorStaffId: input.operatorStaffId ?? null,
        authorName: '运营',
        authorRole: 'ops',
        refDomain: 'batch',
        refId: batchId,
        occurredAt: now,
        createdAt: now,
      })
    } catch (e) {
      supplierError('onboarding-batch', 'create failed', e, { batchId })
      throw e
    }

    supplierLog('onboarding-batch', 'create done', { batchId, batchCode, plannedDeviceCount })

    return { batchId, batchCode, workOrderNo, plannedDeviceCount }
  },

  async list(params: {
    batchKind: 'online' | 'order_access'
    search?: string
    batchStatus?: string
    importStatus?: string
  }): Promise<{ items: OnboardingBatchListItem[]; total: number }> {
    const conditions = [eq(onboardingBatch.batchKind, params.batchKind)]

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

    const items = rows.map(mapBatchRow)
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

    return rows.map(mapBatchRow)
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
      return mapBatchRow(row)
    } catch (e) {
      supplierError('onboarding-batch', 'getById failed', e, { batchId })
      throw e
    }
  },

  async getProgress(batchId: string): Promise<OnboardingBatchProgress> {
    supplierLog('onboarding-batch', 'getProgress start', { batchId })
    try {
    const batch = await getBusinessBatch(batchId)
    const plannedLines = (batch.plannedLinesJson as OnboardingBatchPlanLine[] | null) ?? []

    const deviceRows = await db
      .select({
        gpuCardTypeId: supplierDevice.gpuCardTypeId,
        cooperationType: supplierDevice.cooperationType,
        lifecycleStatus: supplierDevice.lifecycleStatus,
      })
      .from(supplierDevice)
      .where(eq(supplierDevice.onboardingBatchId, batchId))

    let linked = 0
    let onboarding = 0
    let online = 0

    const lineStats = plannedLines.map((line) => {
      const matches = deviceRows.filter(
        (d) =>
          d.gpuCardTypeId === line.gpu_card_type_id &&
          d.cooperationType === line.cooperation_type,
      )
      const lineLinked = matches.length
      const lineOnline = matches.filter((d) => d.lifecycleStatus === '在线').length
      linked += lineLinked
      online += lineOnline
      onboarding += matches.filter((d) =>
        ['待接入', '接入中'].includes(d.lifecycleStatus),
      ).length
      return {
        ...line,
        linked: lineLinked,
        online: lineOnline,
      }
    })

    const result = {
      planned: batch.plannedDeviceCount,
      linked,
      onboarding,
      online,
      planLines: lineStats,
    }
    supplierLog('onboarding-batch', 'getProgress done', {
      batchId,
      planned: result.planned,
      linked: result.linked,
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
      const batch = mapBatchRow(batchRow)

      const progress = await onboardingBatchDataAccess.getProgress(batchId)

      let contractNo: string | null = null
      if (batch.contract_id) {
        const [contract] = await db
          .select({ contractNo: supplierContract.contractNo })
          .from(supplierContract)
          .where(eq(supplierContract.id, batch.contract_id))
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
          cardTypeCode: gpuCardType.code,
        })
        .from(supplierDevice)
        .innerJoin(gpuCardType, eq(supplierDevice.gpuCardTypeId, gpuCardType.id))
        .where(eq(supplierDevice.onboardingBatchId, batchId))
        .orderBy(desc(supplierDevice.createdAt))

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

      const detail: OnboardingBatchDetailPage = {
        batch,
        contractNo,
        progress,
        devices: deviceRows.map((row) => ({
          id: row.id,
          sn: row.sn,
          asset_no: row.assetNo ?? '—',
          lifecycle_status: row.lifecycleStatus,
          onboarding_substage: row.onboardingSubstage ?? '—',
          external_ip: row.externalIp,
          card_type_code: row.cardTypeCode,
        })),
        tasks: taskRows.map((row) => ({
          id: row.id,
          onboarding_batch_id: row.onboardingBatchId,
          device_id: row.supplierDeviceId,
          device_sn: row.deviceSn,
          task_type: row.taskType,
          assignee_id: row.assigneeStaffId,
          assignee_name: row.assigneeName,
          task_status: row.taskStatus,
          started_at: row.startedAt?.toISOString() ?? null,
          finished_at: row.finishedAt?.toISOString() ?? null,
        })),
      }

      supplierLog('onboarding-batch', 'getDetailPage done', {
        batchId,
        batchCode: batch.batch_code,
        deviceCount: detail.devices.length,
        taskCount: detail.tasks.length,
      })
      return detail
    } catch (e) {
      supplierError('onboarding-batch', 'getDetailPage failed', e, { batchId })
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

    const plannedLines = (batch.plannedLinesJson as OnboardingBatchPlanLine[] | null) ?? []
    const defaultLine = plannedLines[0]
    if (!defaultLine?.gpu_card_type_id) {
      throw new Error('批次缺少有效的上架计划卡型')
    }

    const defaultCooperation = (defaultLine.cooperation_type ?? 'idle_time') as DeviceCooperationType
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
            onboardingBatchId: batch.id,
            dataCenterId: batch.dataCenterId,
            gpuCardTypeId: defaultLine.gpu_card_type_id!,
            externalDeviceId: null,
            assetNo: asset,
            sn,
            idcCode: batch.idcCode,
            idcRegion: batch.idcRegion,
            gpuCount: row.gpu_count ?? 8,
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
}
