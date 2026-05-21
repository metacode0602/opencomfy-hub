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
import type { SupplierDevice } from '@/lib/types/supplier-domain'
import { supplierLog, supplierWarn, supplierError } from '@/lib/server/dataaccess/supplier/logger'
import { suppliersDataAccess } from '@/lib/server/dataaccess/supplier/suppliers'
import { resolveOnboardingBatchRefs } from '@/lib/server/dataaccess/supplier/physical-devices'
import {
  dataCenter,
  entityStateTransitionLog,
  gpuCardType,
  onboardingBatch,
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

function mapDbDeviceToDomain(
  row: typeof supplierDevice.$inferSelect,
  cardTypeName: string,
): SupplierDevice {
  return {
    id: row.id,
    supplier_id: row.supplierId,
    contract_id: row.contractId,
    onboarding_batch_id: row.onboardingBatchId ?? '',
    data_center_id: row.dataCenterId ?? '',
    asset_no: row.assetNo ?? '',
    sn: row.sn,
    lifecycle_status: row.lifecycleStatus,
    onboarding_substage: row.onboardingSubstage ?? '',
    idc_region: row.idcRegion ?? '',
    idc_code: row.idcCode,
    gpu_count: String(row.gpuCount),
    card_type: cardTypeName,
    external_ip: row.externalIp ?? '',
    internal_ip: row.internalIp ?? '',
    platform_resource_id: row.platformResourceId,
    external_device_id: row.externalDeviceId,
    ops_status: row.opsStatus,
    in_maintenance: row.inMaintenance,
    bandwidth_group: row.bandwidthGroup,
    rate_limit: row.rateLimit,
    device_spec: row.deviceSpec,
    received_at: row.receivedAt?.toISOString() ?? null,
    remark: row.remark,
    login_username: row.loginUsername,
    login_password: row.loginPassword,
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

function mapBatchListItem(
  row: typeof onboardingBatch.$inferSelect,
): DeviceRetireBatchListItem {
  const parsedRows = (row.parsedRowsJson as DeviceRetireParsedRow[] | null) ?? []
  const parsedErrorCount = parsedRows.filter((r) => r.parse_status === 'error').length
  const reason = row.retireReason as DeviceRetireReason | null

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
    retiredDeviceCount: row.retiredDeviceCount,
    parsedRowCount: row.parsedRowCount,
    parsedSuccessCount: row.parsedSuccessCount,
    parsedErrorCount,
    retireReason: reason,
    retireReasonLabel: reason ? getDeviceRetireReasonLabel(reason) : null,
    expectedCompletionDate: row.expectedCompletionDate ?? null,
    importFileName: row.importFileName,
    committedAt: row.committedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

export const deviceRetireDataAccess = {
  async listBatches(params?: {
    supplierId?: string
    importStatus?: string
    search?: string
  }): Promise<{ items: DeviceRetireBatchListItem[]; total: number }> {
    supplierLog('device-retire', 'listBatches', params ?? {})

    const conditions = [eq(onboardingBatch.batchKind, 'device_retire')]
    if (params?.supplierId) {
      conditions.push(eq(onboardingBatch.supplierId, params.supplierId))
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

    const parsedRows = (row.parsedRowsJson as DeviceRetireParsedRow[] | null) ?? []
    const parsedRowMap = new Map(
      parsedRows
        .filter((r) => r.matched_device_id)
        .map((r) => [r.matched_device_id!, r]),
    )

    const changeRows = await db
      .select({
        changeLog: supplierDeviceChangeLog,
        device: supplierDevice,
        cardTypeName: gpuCardType.name,
      })
      .from(supplierDeviceChangeLog)
      .innerJoin(supplierDevice, eq(supplierDeviceChangeLog.supplierDeviceId, supplierDevice.id))
      .innerJoin(gpuCardType, eq(supplierDevice.gpuCardTypeId, gpuCardType.id))
      .where(eq(supplierDeviceChangeLog.onboardingBatchId, batchId))
      .orderBy(supplierDeviceChangeLog.importRowNo)

    const devicesFromLogs = changeRows.map(({ changeLog, device, cardTypeName }) => {
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
        previousLifecycleStatus: changeLog.previousLifecycleStatus,
        previousOpsStatus: changeLog.previousOpsStatus,
        parseStatus: parsed?.parse_status ?? null,
        rowNo: changeLog.importRowNo,
        warnings: parsed?.warnings ?? [],
        errors: parsed?.errors ?? [],
      }
    })

    const loggedDeviceIds = new Set(devicesFromLogs.map((d) => d.deviceId))
    const errorOnlyRows = parsedRows
      .filter((r) => r.parse_status === 'error' && r.matched_device_id && !loggedDeviceIds.has(r.matched_device_id))
      .map((r) => ({
        deviceId: r.matched_device_id!,
        sn: r.asset_no ?? '—',
        assetNo: r.asset_no,
        externalDeviceId: r.external_device_id,
        externalIp: r.external_ip,
        internalIp: r.internal_ip,
        cardTypeName: '—',
        lifecycleStatus: '—',
        opsStatus: '—',
        previousLifecycleStatus: null,
        previousOpsStatus: null,
        parseStatus: r.parse_status,
        rowNo: r.row_no,
        warnings: r.warnings,
        errors: r.errors,
      }))

    const base = mapBatchListItem(row)
    return {
      ...base,
      idcRegion: row.idcRegion,
      retireRemark: row.retireRemark,
      parsedAt: row.parsedAt?.toISOString() ?? null,
      parsedRows,
      devices: [...devicesFromLogs, ...errorOnlyRows],
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
      throw new Error('没有通过校验的设备可下架')
    }

    const supplierRow = await loadSupplierRow(params.supplierId)
    const { contractId, accessSheetId } = await resolveOnboardingBatchRefs(params.supplierId)
    const expectedDate = parseExpectedDate(params.meta.expectedCompletionDate)
    const now = new Date()
    const batchIds: string[] = []
    const batchCodes: string[] = []
    let retiredCount = 0
    let skippedCount = preview.summary.error

    try {
      await db.transaction(async (tx) => {
        for (const batchPreview of preview.batches) {
          const dc = await loadDataCenter(params.supplierId, batchPreview.dataCenterId)
          const batchId = newId()
          const batchCode = generateImportBatchCode('device_retire')
          batchIds.push(batchId)
          batchCodes.push(batchCode)

          const commitRows = batchPreview.rows.filter((r) => r.parse_status !== 'error')
          let batchRetired = 0

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
            batchStatus: '已完成',
            accessMethod: 'on_site',
            importFileName: batchPreview.fileName,
            importStatus: 'committed',
            parsedRowCount: batchPreview.rows.length,
            parsedSuccessCount: commitRows.length,
            parsedRowsJson: batchPreview.rows,
            parsedAt: now,
            committedDeviceCount: 0,
            retiredDeviceCount: 0,
            committedAt: now,
            retireReason: params.meta.reason,
            expectedCompletionDate: params.meta.expectedCompletionDate,
            retireRemark: params.meta.remark?.trim() || null,
            createdByStaffId: params.operatorStaffId ?? null,
            createdAt: now,
            updatedAt: now,
          })

          for (const row of commitRows) {
            const deviceId = row.matched_device_id
            if (!deviceId) {
              skippedCount += 1
              supplierWarn('device-retire', 'skip row without device id', {
                batchId,
                rowNo: row.row_no,
              })
              continue
            }

            const [device] = await tx
              .select()
              .from(supplierDevice)
              .where(
                and(
                  eq(supplierDevice.id, deviceId),
                  eq(supplierDevice.supplierId, params.supplierId),
                  eq(supplierDevice.dataCenterId, dc.id),
                ),
              )
              .limit(1)

            if (!device) {
              skippedCount += 1
              supplierWarn('device-retire', 'device not found at commit', {
                batchId,
                deviceId,
                rowNo: row.row_no,
              })
              continue
            }

            const fromState = device.lifecycleStatus
            const fromOps = device.opsStatus

            await tx
              .update(supplierDevice)
              .set({
                lifecycleStatus: '已下线',
                opsStatus: '已退订',
                platformResourceId: null,
                inMaintenance: false,
                updatedAt: now,
              })
              .where(eq(supplierDevice.id, deviceId))

            await tx.insert(entityStateTransitionLog).values({
              id: newId(),
              entityType: 'device',
              entityId: deviceId,
              fromState,
              toState: '已下线',
              operatorStaffId: params.operatorStaffId ?? null,
              reasonCode: 'UI_RETIRE_BATCH',
              occurredAt: now,
              payload: {
                batchId,
                batchCode,
                reason: params.meta.reason,
                expectedCompletionDate: params.meta.expectedCompletionDate,
                rowNo: row.row_no,
              },
            })

            await tx.insert(supplierDeviceChangeLog).values({
              id: newId(),
              supplierDeviceId: deviceId,
              onboardingBatchId: batchId,
              internalIp: device.internalIp,
              occurredAt: now,
              changeAction: '下架',
              changeContent: getDeviceRetireReasonLabel(params.meta.reason),
              description: params.meta.remark?.trim() || null,
              importRowNo: row.row_no,
              previousOpsStatus: fromOps,
              newOpsStatus: '已退订',
              previousLifecycleStatus: fromState,
              newLifecycleStatus: '已下线',
              createdAt: now,
            })

            batchRetired += 1
            retiredCount += 1
          }

          await tx
            .update(onboardingBatch)
            .set({
              retiredDeviceCount: batchRetired,
              committedDeviceCount: batchRetired,
              updatedAt: now,
            })
            .where(eq(onboardingBatch.id, batchId))

          await tx.insert(supplierActivity).values({
            id: newId(),
            supplierId: params.supplierId,
            type: 'device_retire',
            title: `机房 ${dc.name} 下架 ${batchRetired} 台设备`,
            description: `${getDeviceRetireReasonLabel(params.meta.reason)} · 期望 ${params.meta.expectedCompletionDate}`,
            authorStaffId: params.operatorStaffId ?? null,
            authorName: params.operatorName ?? '运营',
            authorRole: 'ops',
            refDomain: 'batch',
            refId: batchId,
            metadata: {
              batchCode,
              dataCenterId: dc.id,
              dataCenterName: dc.name,
              retiredCount: batchRetired,
              skippedErrors: batchPreview.summary.error,
              reason: params.meta.reason,
            },
            occurredAt: now,
          })

          supplierLog('device-retire', 'batch committed', {
            batchId,
            batchCode,
            retired: batchRetired,
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
      retiredCount,
      skippedCount,
      batchIds,
    })

    return {
      batchCount: preview.batches.length,
      retiredCount,
      skippedCount,
      batchCodes,
      batchIds,
      meta: preview.meta,
    }
  },
}
