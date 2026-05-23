import { db } from '@/lib/db'
import { parseDeviceRetireFile } from '@/lib/supplier/parse-device-retire-xlsx'
import {
  buildDeviceRetirePreview,
  validateDeviceRetireBatch,
} from '@/lib/supplier/device-retire-validation'
import { generateImportBatchCode } from '@/lib/supplier/device-import-utils'
import {
  getDeviceRetireReasonLabel,
  isDeviceRetireFileName,
  DEVICE_RETIRE_MAX_BYTES,
  type DeviceRetireBatchDetail,
  type DeviceRetireBatchListItem,
  type DeviceRetireCommitResult,
  type DeviceRetireParsedRow,
  type DeviceRetirePreviewResult,
  type DeviceRetireReason,
} from '@/lib/types/device-retire'
import { getRetireScenarioLabel } from '@/lib/supplier/datacenter-device-retire-ui'
import type { RetireProgressFlags } from '@/lib/supplier/retire-changelog-utils'
import type { RetireActionType, RetirePlanMode } from '@/lib/types/datacenter-device-retire'
import type { OnboardingBatchPlannedLineJson } from '@/lib/types/onboarding-batch-api'
import type { SupplierDevice } from '@/lib/types/supplier-domain'
import { supplierLog, supplierError } from '@/lib/server/dataaccess/supplier/logger'
import { mapDbDeviceToDomain } from '@/lib/server/dataaccess/supplier/datacenter-retire-shared'
import { suppliersDataAccess } from '@/lib/server/dataaccess/supplier/suppliers'
import { resolveOnboardingBatchRefs } from '@/lib/server/dataaccess/supplier/physical-devices'
import {
  dataCenter,
  gpuCardType,
  onboardingBatch,
  onboardingBatchDeviceLink,
  supplier,
  supplierActivity,
  supplierDevice,
  supplierDeviceChangeLog,
} from '@workspace/db/schema'
import { and, desc, eq, ilike, or } from 'drizzle-orm'

function newId() {
  return crypto.randomUUID()
}

function bufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

function assertImportFile(fileName: string, buffer: Buffer) {
  if (!isDeviceRetireFileName(fileName)) {
    throw new Error('仅支持 .xlsx / .xls / .csv / .tsv 文件')
  }
  if (buffer.length > DEVICE_RETIRE_MAX_BYTES) {
    throw new Error('文件不能超过 10MB')
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

async function listSupplierDevicesForRetire(supplierId: string): Promise<SupplierDevice[]> {
  const rows = await db
    .select({ device: supplierDevice, cardTypeName: gpuCardType.name })
    .from(supplierDevice)
    .innerJoin(gpuCardType, eq(supplierDevice.gpuCardTypeId, gpuCardType.id))
    .where(eq(supplierDevice.supplierId, supplierId))

  return rows.map(({ device, cardTypeName }) => mapDbDeviceToDomain(device, cardTypeName))
}

type RetireMetaInput = {
  reason: DeviceRetireReason
  expectedCompletionDate: string
  remark?: string
}

type RetireFileInput = {
  dataCenterId: string
  fileName: string
  fileBase64: string
}

function parseExpectedDate(value: string): Date {
  const d = new Date(`${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) {
    throw new Error('期望完成日期格式无效')
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (d < today) {
    throw new Error('期望完成日期不能早于今天')
  }
  return d
}

async function buildPreviewFromFiles(params: {
  supplierId: string
  meta: RetireMetaInput
  files: RetireFileInput[]
}): Promise<DeviceRetirePreviewResult> {
  if (params.files.length === 0) {
    throw new Error('请至少为一个机房上传下架清单')
  }

  await suppliersDataAccess.assertSupplierExists(params.supplierId)
  const devices = await listSupplierDevicesForRetire(params.supplierId)
  const meta = {
    reason: params.meta.reason,
    reasonLabel: getDeviceRetireReasonLabel(params.meta.reason),
    expectedCompletionDate: params.meta.expectedCompletionDate,
    remark: params.meta.remark?.trim() ?? '',
  }

  parseExpectedDate(params.meta.expectedCompletionDate)

  const batches = []
  for (const file of params.files) {
    const dc = await loadDataCenter(params.supplierId, file.dataCenterId)
    const buffer = Buffer.from(file.fileBase64, 'base64')
    assertImportFile(file.fileName, buffer)

    supplierLog('device-retire', 'parse file', {
      supplierId: params.supplierId,
      dataCenterId: file.dataCenterId,
      fileName: file.fileName,
      bytes: buffer.length,
    })

    const { rows, originalHeaders } = parseDeviceRetireFile(
      bufferToArrayBuffer(buffer),
      file.fileName,
    )

    batches.push(
      validateDeviceRetireBatch({
        dataCenterId: dc.id,
        dataCenterName: dc.name,
        fileName: file.fileName,
        originalHeaders,
        parsedRows: rows,
        devices,
      }),
    )
  }

  return buildDeviceRetirePreview({
    supplierId: params.supplierId,
    meta,
    batches,
  })
}

function normalizeParsedRows(json: unknown): DeviceRetireParsedRow[] {
  if (!Array.isArray(json)) return []
  return json.map((row) => {
    if (row && typeof row === 'object' && 'parseStatus' in row) {
      const r = row as {
        rowNo: number
        externalDeviceId?: string | null
        assetNo?: string | null
        externalIp?: string | null
        internalIp?: string | null
        parseStatus: 'ok' | 'error'
        errors?: string[]
        warnings?: string[]
        matchedDeviceId?: string | null
      }
      return {
        row_no: r.rowNo,
        external_device_id: r.externalDeviceId ?? null,
        asset_no: r.assetNo ?? null,
        external_ip: r.externalIp ?? null,
        internal_ip: r.internalIp ?? null,
        originalCells: [],
        parse_status: r.parseStatus,
        errors: r.errors ?? [],
        warnings: r.warnings ?? [],
        errorColumnIndexes: [],
        matched_device_id: r.matchedDeviceId ?? null,
      }
    }
    return row as DeviceRetireParsedRow
  })
}

function mapBatchListItem(
  row: typeof onboardingBatch.$inferSelect,
): DeviceRetireBatchListItem {
  const parsedRows = normalizeParsedRows(row.parsedRowsJson)
  const parsedErrorCount = parsedRows.filter((r) => r.parse_status === 'error').length
  const reason = row.retireReason as DeviceRetireReason | null
  const retirePlanMode = (row.retirePlanMode as RetirePlanMode | null) ?? null
  const retireActionType = (row.retireActionType as RetireActionType | null) ?? null
  const progressFlags = (row.progressFlagsJson as RetireProgressFlags | null) ?? null
  const scenarioLabel =
    retirePlanMode && retireActionType
      ? getRetireScenarioLabel(retirePlanMode, retireActionType)
      : null

  return {
    id: row.id,
    batchCode: row.batchCode,
    supplierId: row.supplierId,
    supplierName: row.supplierName,
    supplierShortName: row.supplierShortName,
    dataCenterId: row.dataCenterId,
    dataCenterName: row.dataCenterName,
    idcCode: row.idcCode,
    importStatus: row.importStatus,
    batchStatus: row.batchStatus,
    workOrderNo: row.workOrderNo ?? null,
    plannedDeviceCount: row.plannedDeviceCount,
    touchedDeviceCount: row.touchedDeviceCount,
    retiredDeviceCount: row.retiredDeviceCount,
    parsedRowCount: row.parsedRowCount,
    parsedSuccessCount: row.parsedSuccessCount,
    parsedErrorCount,
    retireReason: reason,
    retireReasonLabel: reason ? getDeviceRetireReasonLabel(reason) : null,
    retirePlanMode,
    retireActionType,
    scenarioLabel,
    progressFlags,
    expectedCompletionDate: row.expectedCompletionDate ?? null,
    importFileName: row.importFileName,
    committedAt: row.committedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

export const deviceRetireDataAccess = {
  async listBatches(params?: {
    supplierId?: string
    dataCenterId?: string
    importStatus?: string
    search?: string
  }): Promise<{ items: DeviceRetireBatchListItem[]; total: number }> {
    supplierLog('device-retire', 'listBatches', params ?? {})

    const conditions = [eq(onboardingBatch.batchKind, 'device_retire')]
    if (params?.supplierId) {
      conditions.push(eq(onboardingBatch.supplierId, params.supplierId))
    }
    if (params?.dataCenterId) {
      conditions.push(eq(onboardingBatch.dataCenterId, params.dataCenterId))
    }
    if (params?.importStatus && params.importStatus !== 'all') {
      conditions.push(eq(onboardingBatch.importStatus, params.importStatus))
    }
    if (params?.search?.trim()) {
      const q = `%${params.search.trim()}%`
      conditions.push(
        or(
          ilike(onboardingBatch.batchCode, q),
          ilike(onboardingBatch.supplierName, q),
          ilike(onboardingBatch.supplierShortName, q),
          ilike(onboardingBatch.dataCenterName, q),
          ilike(onboardingBatch.idcCode, q),
        )!,
      )
    }

    const rows = await db
      .select()
      .from(onboardingBatch)
      .where(and(...conditions))
      .orderBy(desc(onboardingBatch.createdAt))

    const items = rows.map(mapBatchListItem)
    return { items, total: items.length }
  },

  async getBatchById(batchId: string): Promise<DeviceRetireBatchDetail | null> {
    supplierLog('device-retire', 'getBatchById', { batchId })

    const [row] = await db
      .select()
      .from(onboardingBatch)
      .where(and(eq(onboardingBatch.id, batchId), eq(onboardingBatch.batchKind, 'device_retire')))
      .limit(1)

    if (!row) return null

    const parsedRows = normalizeParsedRows(row.parsedRowsJson)
    const parsedRowMap = new Map(
      parsedRows
        .filter((r) => r.matched_device_id)
        .map((r) => [r.matched_device_id!, r]),
    )
    const plannedLines = (row.plannedLinesJson as OnboardingBatchPlannedLineJson[] | null) ?? []

    const linkRows = await db
      .select({
        link: onboardingBatchDeviceLink,
        device: supplierDevice,
        cardTypeName: gpuCardType.name,
        changeLog: supplierDeviceChangeLog,
      })
      .from(onboardingBatchDeviceLink)
      .innerJoin(supplierDevice, eq(onboardingBatchDeviceLink.supplierDeviceId, supplierDevice.id))
      .innerJoin(gpuCardType, eq(supplierDevice.gpuCardTypeId, gpuCardType.id))
      .leftJoin(
        supplierDeviceChangeLog,
        and(
          eq(supplierDeviceChangeLog.supplierDeviceId, supplierDevice.id),
          eq(supplierDeviceChangeLog.businessOnboardingBatchId, batchId),
        ),
      )
      .where(eq(onboardingBatchDeviceLink.businessOnboardingBatchId, batchId))
      .orderBy(supplierDeviceChangeLog.importRowNo, onboardingBatchDeviceLink.linkedAt)

    const devicesFromLinks = linkRows.map(({ link, device, cardTypeName, changeLog }) => {
      const parsed = parsedRowMap.get(device.id)
      return {
        deviceId: device.id,
        sn: device.sn,
        assetNo: device.assetNo,
        externalDeviceId: device.externalDeviceId,
        externalIp: device.externalIp,
        internalIp: device.internalIp,
        cardTypeName,
        lifecycleStatus: device.lifecycleStatus,
        opsStatus: device.opsStatus,
        previousLifecycleStatus: changeLog?.previousLifecycleStatus ?? null,
        previousOpsStatus: changeLog?.previousOpsStatus ?? null,
        linkKind: link.linkKind,
        parseStatus: parsed?.parse_status ?? null,
        rowNo: changeLog?.importRowNo ?? null,
        warnings: parsed?.warnings ?? [],
        errors: parsed?.errors ?? [],
      }
    })

    const base = mapBatchListItem(row)
    return {
      ...base,
      idcRegion: row.idcRegion,
      retireRemark: row.retireRemark,
      parsedAt: row.parsedAt?.toISOString() ?? null,
      parsedRows,
      plannedLines,
      devices: devicesFromLinks,
    }
  },

  async getContext(supplierId: string) {
    await suppliersDataAccess.assertSupplierExists(supplierId)

    const recentBatches = await db
      .select()
      .from(onboardingBatch)
      .where(
        and(
          eq(onboardingBatch.supplierId, supplierId),
          eq(onboardingBatch.batchKind, 'device_retire'),
        ),
      )
      .orderBy(desc(onboardingBatch.createdAt))
      .limit(10)

    return {
      recentBatches: recentBatches.map(mapBatchListItem),
    }
  },

  async preview(params: {
    supplierId: string
    meta: RetireMetaInput
    files: RetireFileInput[]
  }): Promise<DeviceRetirePreviewResult> {
    supplierLog('device-retire', 'preview start', {
      supplierId: params.supplierId,
      fileCount: params.files.length,
    })
    const preview = await buildPreviewFromFiles(params)
    supplierLog('device-retire', 'preview done', {
      supplierId: params.supplierId,
      total: preview.summary.total,
      ok: preview.summary.ok + preview.summary.warning,
      error: preview.summary.error,
    })
    return preview
  },

  async commit(params: {
    supplierId: string
    meta: RetireMetaInput
    files: RetireFileInput[]
    operatorStaffId?: string | null
    operatorName?: string | null
  }): Promise<DeviceRetireCommitResult & { batchIds: string[] }> {
    supplierLog('device-retire', 'commit start', {
      supplierId: params.supplierId,
      fileCount: params.files.length,
    })

    const preview = await buildPreviewFromFiles(params)
    const okCount = preview.summary.ok + preview.summary.warning
    if (okCount === 0) {
      throw new Error('没有通过校验的设备可创建下架批次')
    }

    const supplierRow = await loadSupplierRow(params.supplierId)
    const { contractId, accessSheetId } = await resolveOnboardingBatchRefs(params.supplierId)
    parseExpectedDate(params.meta.expectedCompletionDate)
    const now = new Date()
    const batchIds: string[] = []
    const batchCodes: string[] = []
    const skippedCount = preview.summary.error

    try {
      await db.transaction(async (tx) => {
        for (const batchPreview of preview.batches) {
          const dc = await loadDataCenter(params.supplierId, batchPreview.dataCenterId)
          const batchId = newId()
          const batchCode = generateImportBatchCode('device_retire')
          batchIds.push(batchId)
          batchCodes.push(batchCode)

          const commitRows = batchPreview.rows.filter((r) => r.parse_status !== 'error')
          const plannedDeviceCount = commitRows.length

          await tx.insert(onboardingBatch).values({
            id: batchId,
            batchKind: 'device_retire',
            supplierId: params.supplierId,
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
            batchStatus: '待开始',
            accessMethod: 'on_site',
            importFileName: batchPreview.fileName,
            importStatus: 'parsed',
            parsedRowCount: batchPreview.rows.length,
            parsedSuccessCount: commitRows.length,
            parsedRowsJson: batchPreview.rows,
            parsedAt: now,
            plannedDeviceCount,
            plannedLinesJson: [],
            committedDeviceCount: 0,
            retiredDeviceCount: 0,
            committedAt: null,
            retireReason: params.meta.reason,
            retireActionType: 'device_unsubscribe',
            retirePlanMode: 'line_plan',
            expectedCompletionDate: params.meta.expectedCompletionDate,
            retireRemark: params.meta.remark?.trim() || null,
            listUploadMode: 'legacy_excel',
            progressFlagsJson: {},
            createdByStaffId: params.operatorStaffId ?? null,
            createdAt: now,
            updatedAt: now,
          })

          await tx.insert(supplierActivity).values({
            id: newId(),
            supplierId: params.supplierId,
            type: 'device_retire',
            title: `机房 ${dc.name} 下架计划已创建（Legacy 清单 ${plannedDeviceCount} 台）`,
            description: `${getDeviceRetireReasonLabel(params.meta.reason)} · 期望 ${params.meta.expectedCompletionDate} · 请运维通过变更表更新设备状态`,
            authorStaffId: params.operatorStaffId ?? null,
            authorName: params.operatorName ?? '运营',
            authorRole: 'ops',
            refDomain: 'batch',
            refId: batchId,
            metadata: {
              batchCode,
              dataCenterId: dc.id,
              dataCenterName: dc.name,
              plannedDeviceCount,
              skippedErrors: batchPreview.summary.error,
              reason: params.meta.reason,
              legacyImport: true,
            },
            occurredAt: now,
          })

          supplierLog('device-retire', 'batch created (legacy, no device mutation)', {
            batchId,
            batchCode,
            plannedDeviceCount,
            errors: batchPreview.summary.error,
          })
        }
      })
    } catch (e) {
      supplierError('device-retire', 'commit failed', e, { supplierId: params.supplierId })
      throw e
    }

    supplierLog('device-retire', 'commit done', {
      supplierId: params.supplierId,
      skippedCount,
      batchIds,
    })

    return {
      batchCount: preview.batches.length,
      retiredCount: 0,
      skippedCount,
      batchCodes,
      batchIds,
      meta: preview.meta,
    }
  },
}
