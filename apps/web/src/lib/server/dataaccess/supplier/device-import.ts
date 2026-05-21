import { db } from '@/lib/db'
import type {
  DeviceChangelogParsedRow,
  DeviceInventoryParsedRow,
  FaultRecordsParsedRow,
  SupplierDevice,
} from '@/lib/types/supplier-domain'
import type {
  DeviceImportCommitResult,
  DeviceImportContext,
} from '@/lib/types/device-import-api'
import {
  buildChangeLogsFromChangelogImport,
  buildDevicesFromInventoryImport,
  buildFaultIncidentsFromRecordsImport,
  generateImportBatchCode,
  maskInventoryRowsForPreview,
} from '@/lib/supplier/device-import-utils'
import { supplierLog, supplierWarn, supplierError } from '@/lib/server/dataaccess/supplier/logger'
import { suppliersDataAccess } from '@/lib/server/dataaccess/supplier/suppliers'
import { resolveOnboardingBatchRefs } from '@/lib/server/dataaccess/supplier/physical-devices'
import {
  computeNode,
  dataCenter,
  faultIncident,
  gpuCardType,
  onboardingBatch,
  supplier,
  supplierActivity,
  supplierDevice,
  supplierDeviceChangeLog,
  supplierOpsUploadBatch,
} from '@workspace/db/schema'
import { and, count, desc, eq, inArray } from 'drizzle-orm'

function newId() {
  return crypto.randomUUID()
}

const createId = (_prefix: string) => newId()

async function loadSupplierRow(supplierId: string) {
  const row = await db.query.supplier.findFirst({
    where: eq(supplier.id, supplierId),
    columns: {
      id: true,
      code: true,
      name: true,
      shortName: true,
    },
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

async function resolveGpuCardTypeId(
  codeOrName: string | undefined,
  cache: Map<string, string>,
): Promise<string> {
  const key = (codeOrName?.trim() || 'A100-80G').toLowerCase()
  const cached = cache.get(key)
  if (cached) return cached

  const byName = await db.query.gpuCardType.findFirst({
    where: eq(gpuCardType.name, codeOrName?.trim() || 'A100-80G'),
    columns: { id: true },
  })
  if (byName) {
    cache.set(key, byName.id)
    return byName.id
  }

  const fallback = await db.query.gpuCardType.findFirst({
    where: eq(gpuCardType.status, 'active'),
    columns: { id: true },
  })
  if (!fallback) throw new Error('系统中没有可用的 GPU 卡型，请先维护 gpu_card_type')
  cache.set(key, fallback.id)
  return fallback.id
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

async function listSupplierDevicesForImport(supplierId: string): Promise<SupplierDevice[]> {
  const rows = await db
    .select({
      device: supplierDevice,
      cardTypeName: gpuCardType.name,
    })
    .from(supplierDevice)
    .innerJoin(gpuCardType, eq(supplierDevice.gpuCardTypeId, gpuCardType.id))
    .where(eq(supplierDevice.supplierId, supplierId))

  return rows.map(({ device, cardTypeName }) => mapDbDeviceToDomain(device, cardTypeName))
}

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export const deviceImportDataAccess = {
  async getContext(supplierId: string): Promise<DeviceImportContext> {
    await suppliersDataAccess.assertSupplierExists(supplierId)

    const inventoryRows = await db
      .select()
      .from(onboardingBatch)
      .where(
        and(
          eq(onboardingBatch.supplierId, supplierId),
          eq(onboardingBatch.batchKind, 'device_inventory'),
        ),
      )
      .orderBy(desc(onboardingBatch.createdAt))
      .limit(5)

    const changelogRows = await db
      .select()
      .from(onboardingBatch)
      .where(
        and(
          eq(onboardingBatch.supplierId, supplierId),
          eq(onboardingBatch.batchKind, 'device_changelog'),
        ),
      )
      .orderBy(desc(onboardingBatch.createdAt))
      .limit(5)

    const faultRows = await db
      .select()
      .from(supplierOpsUploadBatch)
      .where(
        and(
          eq(supplierOpsUploadBatch.supplierId, supplierId),
          eq(supplierOpsUploadBatch.kind, 'fault_records'),
        ),
      )
      .orderBy(desc(supplierOpsUploadBatch.createdAt))
      .limit(5)

    const deviceIds = await db
      .select({ id: supplierDevice.id })
      .from(supplierDevice)
      .where(eq(supplierDevice.supplierId, supplierId))

    const ids = deviceIds.map((d) => d.id)
    let changeLogCount = 0
    if (ids.length > 0) {
      const [row] = await db
        .select({ value: count() })
        .from(supplierDeviceChangeLog)
        .where(inArray(supplierDeviceChangeLog.supplierDeviceId, ids))
      changeLogCount = Number(row?.value ?? 0)
    }

    const mapOnboarding = (row: typeof onboardingBatch.$inferSelect) => ({
      id: row.id,
      code: row.batchCode,
      kind: row.batchKind as 'device_inventory' | 'device_changelog',
      importStatus: row.importStatus,
      committedCount: row.committedDeviceCount,
      parsedSuccessCount: row.parsedSuccessCount,
      committedAt: row.committedAt?.toISOString() ?? null,
      parsedAt: row.parsedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })

    return {
      inventoryBatches: inventoryRows.map(mapOnboarding),
      changelogBatches: changelogRows.map(mapOnboarding),
      faultBatches: faultRows.map((row) => ({
        id: row.id,
        code: row.fileName,
        kind: 'fault_records' as const,
        importStatus: row.importStatus,
        committedCount: row.committedIncidentCount,
        parsedSuccessCount: row.parsedSuccessCount,
        committedAt: row.committedAt?.toISOString() ?? null,
        parsedAt: null,
        createdAt: row.createdAt.toISOString(),
      })),
      changeLogCount,
    }
  },

  async commitInventory(params: {
    supplierId: string
    dataCenterId: string
    fileName: string
    rows: DeviceInventoryParsedRow[]
    operatorStaffId?: string | null
    operatorName?: string | null
  }): Promise<DeviceImportCommitResult> {
    supplierLog('device-import', 'commitInventory start', {
      supplierId: params.supplierId,
      dataCenterId: params.dataCenterId,
      rows: params.rows.length,
    })

    const supplierRow = await loadSupplierRow(params.supplierId)
    const dc = await loadDataCenter(params.supplierId, params.dataCenterId)
    const { contractId, accessSheetId } = await resolveOnboardingBatchRefs(params.supplierId)

    const okRows = params.rows.filter((r) => r.parse_status !== 'error')
    if (okRows.length === 0) {
      throw new Error('没有可入库的有效行')
    }

    const batchId = newId()
    const batchCode = generateImportBatchCode('device_inventory')
    const now = new Date()
    const okCount = params.rows.filter((r) => r.parse_status === 'ok').length
    const previewRows = maskInventoryRowsForPreview(params.rows)

    const { devices: newDevices, nodes } = buildDevicesFromInventoryImport({
      batchId,
      supplierId: params.supplierId,
      contractId,
      dataCenterId: dc.id,
      idcCode: dc.code,
      idcRegion: dc.location ?? '',
      cardTypeDefault: 'A100-80G',
      rows: params.rows,
      createId,
    })

    const gpuCache = new Map<string, string>()
    const warnings: string[] = []
    let committedCount = 0
    let skippedCount = 0

    try {
      await db.transaction(async (tx) => {
        await tx.insert(onboardingBatch).values({
          id: batchId,
          batchKind: 'device_inventory',
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
          importFileName: params.fileName,
          importStatus: 'committed',
          parsedRowCount: params.rows.length,
          parsedSuccessCount: okCount,
          parsedRowsJson: previewRows,
          parsedAt: now,
          committedDeviceCount: newDevices.length,
          committedAt: now,
          createdByStaffId: params.operatorStaffId ?? null,
          createdAt: now,
          updatedAt: now,
        })

        for (const device of newDevices) {
          const row = okRows.find(
            (r) =>
              r.external_device_id === device.external_device_id ||
              r.internal_ip === device.internal_ip ||
              r.sn === device.sn,
          )
          try {
            const gpuCardTypeId = await resolveGpuCardTypeId(row?.gpu_card_type_code, gpuCache)
            await tx.insert(supplierDevice).values({
              id: device.id,
              supplierId: params.supplierId,
              contractId,
              onboardingBatchId: batchId,
              dataCenterId: dc.id,
              gpuCardTypeId,
              externalDeviceId: device.external_device_id,
              assetNo: device.asset_no,
              sn: device.sn,
              idcCode: device.idc_code,
              idcRegion: device.idc_region || null,
              gpuCount: Number(device.gpu_count) || 8,
              externalIp: device.external_ip || null,
              internalIp: device.internal_ip || null,
              opsStatus: device.ops_status ?? '预留闲置中',
              lifecycleStatus: device.lifecycle_status,
              inMaintenance: device.in_maintenance ?? false,
              onboardingSubstage: device.onboarding_substage,
              bandwidthGroup: device.bandwidth_group,
              rateLimit: device.rate_limit,
              deviceSpec: device.device_spec,
              receivedAt: parseIsoDate(device.received_at),
              remark: device.remark,
              loginUsername: device.login_username,
              loginPassword: device.login_password,
              platformResourceId: device.platform_resource_id,
              createdAt: now,
              updatedAt: now,
            })
            committedCount++
          } catch (e) {
            skippedCount++
            const message = e instanceof Error ? e.message : '写入失败'
            if (message.includes('unique') || message.includes('duplicate')) {
              warnings.push(`设备 ${device.sn} 已存在，已跳过`)
            } else {
              warnings.push(`设备 ${device.sn}: ${message}`)
            }
            supplierWarn('device-import', 'device insert skipped', {
              sn: device.sn,
              message,
            })
          }
        }

        for (const node of nodes) {
          const deviceExists = newDevices.some((d) => d.id === node.device_id)
          if (!deviceExists) continue
          try {
            await tx.insert(computeNode).values({
              id: node.id,
              supplierDeviceId: node.device_id,
              nodeRole: node.node_role,
              mgmtIp: node.mgmt_ip || null,
              clusterName: node.cluster_name,
              nodeName: node.node_name,
              expectedService: node.expected_service,
              clusterId: node.cluster_id || null,
              lifecycleStatus: node.lifecycle_status,
              createdAt: now,
              updatedAt: now,
            })
          } catch (e) {
            supplierWarn('device-import', 'compute node insert failed', {
              deviceId: node.device_id,
              err: e instanceof Error ? e.message : String(e),
            })
          }
        }

        await tx.insert(supplierActivity).values({
          id: newId(),
          supplierId: params.supplierId,
          type: 'ops_import',
          title: `设备主数据导入 ${batchCode}`,
          description: `写入 ${committedCount} 台物理机`,
          authorStaffId: params.operatorStaffId ?? null,
          authorName: params.operatorName ?? '运营',
          authorRole: 'ops',
          refDomain: 'batch',
          refId: batchId,
          occurredAt: now,
        })

        await tx
          .update(onboardingBatch)
          .set({
            committedDeviceCount: committedCount,
            updatedAt: now,
          })
          .where(eq(onboardingBatch.id, batchId))
      })
    } catch (e) {
      supplierError('device-import', 'commitInventory failed', e, { batchId })
      throw e
    }

    supplierLog('device-import', 'commitInventory done', {
      batchId,
      committedCount,
      skippedCount,
    })

    return {
      batchId,
      batchCode,
      committedCount,
      skippedCount,
      warnings,
    }
  },

  async commitChangelog(params: {
    supplierId: string
    dataCenterId: string
    fileName: string
    rows: DeviceChangelogParsedRow[]
    operatorStaffId?: string | null
    operatorName?: string | null
  }): Promise<DeviceImportCommitResult> {
    supplierLog('device-import', 'commitChangelog start', {
      supplierId: params.supplierId,
      rows: params.rows.length,
    })

    const supplierRow = await loadSupplierRow(params.supplierId)
    const dc = await loadDataCenter(params.supplierId, params.dataCenterId)
    const { contractId, accessSheetId } = await resolveOnboardingBatchRefs(params.supplierId)

    const okRows = params.rows.filter((r) => r.parse_status !== 'error')
    if (okRows.length === 0) {
      throw new Error('没有可入库的有效行')
    }

    const batchId = newId()
    const batchCode = generateImportBatchCode('device_changelog')
    const now = new Date()
    const okCount = params.rows.filter((r) => r.parse_status === 'ok').length

    const supplierDevices = await listSupplierDevicesForImport(params.supplierId)
    const { logs, updatedDevices } = buildChangeLogsFromChangelogImport({
      batchId,
      rows: params.rows,
      devices: supplierDevices,
      createId,
    })

    const notFoundCount = okRows.length - logs.length
    const warnings: string[] = []
    if (notFoundCount > 0) {
      warnings.push(`${notFoundCount} 行未匹配到已有设备，已跳过`)
    }

    try {
      await db.transaction(async (tx) => {
        await tx.insert(onboardingBatch).values({
          id: batchId,
          batchKind: 'device_changelog',
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
          importFileName: params.fileName,
          importStatus: 'committed',
          parsedRowCount: params.rows.length,
          parsedSuccessCount: okCount,
          parsedRowsJson: params.rows,
          parsedAt: now,
          committedDeviceCount: logs.length,
          committedAt: now,
          createdByStaffId: params.operatorStaffId ?? null,
          createdAt: now,
          updatedAt: now,
        })

        for (const log of logs) {
          await tx.insert(supplierDeviceChangeLog).values({
            id: log.id,
            supplierDeviceId: log.supplier_device_id,
            onboardingBatchId: batchId,
            internalIp: log.internal_ip,
            occurredAt: parseIsoDate(log.occurred_at) ?? now,
            changeAction: log.change_action,
            changeContent: log.change_content,
            description: log.description,
            ticketNo: log.ticket_no,
            importRowNo: log.import_row_no,
            previousOpsStatus: log.previous_ops_status,
            newOpsStatus: log.new_ops_status,
            previousLifecycleStatus: log.previous_lifecycle_status,
            newLifecycleStatus: log.new_lifecycle_status,
            createdAt: now,
          })
        }

        for (const device of updatedDevices) {
          await tx
            .update(supplierDevice)
            .set({
              opsStatus: device.ops_status ?? undefined,
              lifecycleStatus: device.lifecycle_status,
              inMaintenance: device.in_maintenance ?? false,
              updatedAt: now,
            })
            .where(eq(supplierDevice.id, device.id))
        }

        await tx.insert(supplierActivity).values({
          id: newId(),
          supplierId: params.supplierId,
          type: 'device_change_imported',
          title: `设备变更导入 ${batchCode}`,
          description: `追加 ${logs.length} 条变更审计`,
          authorStaffId: params.operatorStaffId ?? null,
          authorName: params.operatorName ?? '运营',
          authorRole: 'ops',
          refDomain: 'batch',
          refId: batchId,
          occurredAt: now,
        })
      })
    } catch (e) {
      supplierError('device-import', 'commitChangelog failed', e, { batchId })
      throw e
    }

    supplierLog('device-import', 'commitChangelog done', { batchId, logs: logs.length })

    return {
      batchId,
      batchCode,
      committedCount: logs.length,
      skippedCount: notFoundCount,
      warnings,
    }
  },

  async commitFaultRecords(params: {
    supplierId: string
    dataCenterId?: string
    fileName: string
    rows: FaultRecordsParsedRow[]
    operatorStaffId?: string | null
    operatorName?: string | null
  }): Promise<DeviceImportCommitResult> {
    supplierLog('device-import', 'commitFaultRecords start', {
      supplierId: params.supplierId,
      rows: params.rows.length,
    })

    await loadSupplierRow(params.supplierId)

    let idcCode = 'DEFAULT-DC'
    if (params.dataCenterId) {
      const dc = await loadDataCenter(params.supplierId, params.dataCenterId)
      idcCode = dc.code
    } else {
      const dcs = await suppliersDataAccess.listDataCentersBySupplier(params.supplierId)
      if (dcs[0]?.code) idcCode = dcs[0].code
    }

    const okRows = params.rows.filter((r) => r.parse_status !== 'error')
    if (okRows.length === 0) {
      throw new Error('没有可入库的有效行')
    }

    const batchId = newId()
    const now = new Date()
    const okCount = params.rows.filter((r) => r.parse_status === 'ok').length

    const incidents = buildFaultIncidentsFromRecordsImport({
      batchId,
      supplierId: params.supplierId,
      rows: params.rows,
      createId,
    })

    try {
      await db.transaction(async (tx) => {
        await tx.insert(supplierOpsUploadBatch).values({
          id: batchId,
          kind: 'fault_records',
          supplierId: params.supplierId,
          idcCode,
          fileName: params.fileName,
          rowsJson: params.rows,
          status: 'committed',
          importStatus: 'committed',
          parsedRowCount: params.rows.length,
          parsedSuccessCount: okCount,
          committedIncidentCount: incidents.length,
          committedAt: now,
          createdByStaffId: params.operatorStaffId ?? null,
          createdAt: now,
        })

        for (const incident of incidents) {
          await tx.insert(faultIncident).values({
            id: incident.id,
            supplierId: params.supplierId,
            supplierOpsUploadBatchId: batchId,
            supplierDeviceId: incident.device_id,
            computeNodeId: incident.compute_node_id,
            faultType: incident.fault_type ?? incident.title,
            severity: incident.severity,
            incidentStatus: incident.incident_status,
            impactMinutes: incident.impact_minutes,
            impactScope: incident.impact_scope,
            affectedDeviceCount: incident.affected_device_count,
            postmortem: incident.postmortem,
            resolutionOutcome: incident.resolution_outcome || null,
            openedAt: parseIsoDate(incident.opened_at) ?? now,
            closedAt: parseIsoDate(incident.closed_at),
            createdAt: now,
          })
        }

        await tx.insert(supplierActivity).values({
          id: newId(),
          supplierId: params.supplierId,
          type: 'fault_opened',
          title: `故障记录导入 ${params.fileName}`,
          description: `写入 ${incidents.length} 条故障事件`,
          authorStaffId: params.operatorStaffId ?? null,
          authorName: params.operatorName ?? '运营',
          authorRole: 'ops',
          refDomain: 'ops_upload_batch',
          refId: batchId,
          occurredAt: now,
        })
      })
    } catch (e) {
      supplierError('device-import', 'commitFaultRecords failed', e, { batchId })
      throw e
    }

    supplierLog('device-import', 'commitFaultRecords done', {
      batchId,
      incidents: incidents.length,
    })

    return {
      batchId,
      batchCode: params.fileName,
      committedCount: incidents.length,
      skippedCount: okRows.length - incidents.length,
      warnings: [],
    }
  },
}
