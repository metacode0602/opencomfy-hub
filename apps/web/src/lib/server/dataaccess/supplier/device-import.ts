import { db } from '@/lib/db'
import { resolveDeviceGpuCount, resolveGpuCardTypeRole } from '@/lib/supplier/gpu-card-type-metrics'
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
  findDeviceByImportKeys,
  generateImportBatchCode,
  maskInventoryRowsForPreview,
} from '@/lib/supplier/device-import-utils'
import {
  buildGpuCardTypeIdByIpMap,
  DeviceImportUnrecognizedGpuCardError,
  validateInventoryGpuCardTypes,
} from '@/lib/supplier/gpu-card-type-import-match'
import { refreshBatchProgress } from '@/lib/server/dataaccess/supplier/batch-progress'
import {
  resolveSingleBusinessBatchFromRows,
  ticketRefsForBatch,
} from '@/lib/server/dataaccess/supplier/changelog-business-batch-link'
import { supplierLog, supplierWarn, supplierError } from '@/lib/server/dataaccess/supplier/logger'
import { suppliersDataAccess } from '@/lib/server/dataaccess/supplier/suppliers'
import { ensurePricingRecordsForImportedCardTypes } from '@/lib/server/dataaccess/supplier/ensure-pricing-on-device-import'
import {
  refreshSupplierGpuInventoryForDataCenters,
} from '@/lib/server/dataaccess/supplier/gpu-inventory-sync'
import { resolveOnboardingBatchRefs } from '@/lib/server/dataaccess/supplier/physical-devices'
import {
  computeNode,
  dataCenter,
  faultIncident,
  gpuCardType,
  onboardingBatch,
  onboardingBatchDeviceLink,
  supplier,
  supplierActivity,
  supplierDevice,
  supplierDeviceChangeLog,
  supplierOpsUploadBatch,
} from '@workspace/db/schema'
import { and, count, desc, eq, inArray, isNull, or } from 'drizzle-orm'

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
      defaultCooperationMode: true,
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

async function loadAllGpuCardTypesForImport() {
  return db
    .select({
      id: gpuCardType.id,
      code: gpuCardType.code,
      name: gpuCardType.name,
    })
    .from(gpuCardType)
}

async function loadGpuCardTypeIdByInternalIp(supplierId: string) {
  const rows = await db
    .select({
      internalIp: supplierDevice.internalIp,
      gpuCardTypeId: supplierDevice.gpuCardTypeId,
    })
    .from(supplierDevice)
    .where(eq(supplierDevice.supplierId, supplierId))

  return buildGpuCardTypeIdByIpMap(rows)
}

async function assertInventoryGpuCardTypesResolved(
  supplierId: string,
  rows: DeviceInventoryParsedRow[],
) {
  const cardTypes = await loadAllGpuCardTypesForImport()
  if (cardTypes.length === 0) {
    throw new Error('系统中没有 GPU 卡型，请先在卡型管理中维护 gpu_card_type')
  }
  const gpuCardTypeIdByIp = await loadGpuCardTypeIdByInternalIp(supplierId)
  const validation = validateInventoryGpuCardTypes(rows, cardTypes, { gpuCardTypeIdByIp })
  if (validation.issues.length > 0) {
    throw new DeviceImportUnrecognizedGpuCardError(validation)
  }
  return validation
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
    gpu_card_type_id: row.gpuCardTypeId,
    external_ip: row.externalIp ?? '',
    internal_ip: row.internalIp ?? '',
    platform_resource_id: row.platformResourceId,
    external_device_id: row.externalDeviceId,
    ops_status: row.opsStatus,
    in_maintenance: row.inMaintenance,
    bandwidth_group: row.bandwidthGroup,
    rate_limit: row.rateLimit,
    cooperation_type: (row.cooperationType ?? 'idle_time') as SupplierDevice['cooperation_type'],
    device_spec: row.deviceSpec,
    device_purpose: row.devicePurpose,
    received_at: row.receivedAt?.toISOString() ?? null,
    remark: row.remark,
    login_username: row.loginUsername,
    login_password: row.loginPassword,
  }
}

async function listSupplierDevicesForImport(
  supplierId: string,
  dataCenterId?: string,
): Promise<SupplierDevice[]> {
  const conditions = [eq(supplierDevice.supplierId, supplierId)]
  if (dataCenterId) {
    conditions.push(
      or(eq(supplierDevice.dataCenterId, dataCenterId), isNull(supplierDevice.dataCenterId))!,
    )
  }

  const rows = await db
    .select({
      device: supplierDevice,
      cardTypeName: gpuCardType.name,
    })
    .from(supplierDevice)
    .innerJoin(gpuCardType, eq(supplierDevice.gpuCardTypeId, gpuCardType.id))
    .where(and(...conditions))

  return rows.map(({ device, cardTypeName }) => mapDbDeviceToDomain(device, cardTypeName))
}

function formatDeviceImportDbError(error: unknown): Error {
  const err = error as {
    message?: string
    cause?: { code?: string; constraint?: string; detail?: string }
  }
  const pg = err?.cause
  if (pg?.code === '23505') {
    const detail = pg.detail ?? ''
    if (pg.constraint?.includes('sn') || detail.includes('sn')) {
      return new Error(
        `设备 SN 已存在，无法重复入库。${detail || '请检查导入文件是否有重复行，或该 IP/设备 ID 是否已被其它记录占用'}`,
      )
    }
    if (pg.constraint?.includes('asset') || detail.includes('asset_no')) {
      return new Error(`设备资产编号已存在，无法重复入库。${detail || ''}`)
    }
    return new Error(`数据唯一性冲突，无法入库。${detail || pg.constraint || ''}`)
  }
  if (error instanceof Error) return error
  return new Error(String(error))
}

function upsertDeviceInImportPool(pool: SupplierDevice[], device: SupplierDevice) {
  const idx = pool.findIndex((d) => d.id === device.id)
  if (idx >= 0) {
    pool[idx] = device
    return
  }
  pool.push(device)
}

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function findImportRowForDevice(
  device: SupplierDevice,
  okRows: DeviceInventoryParsedRow[],
): DeviceInventoryParsedRow | undefined {
  return okRows.find(
    (r) =>
      (r.sn && r.sn === device.sn) ||
      (r.asset_no && r.asset_no === device.asset_no) ||
      (r.external_device_id && r.external_device_id === device.external_device_id) ||
      (r.internal_ip && r.internal_ip === device.internal_ip),
  )
}

function trackImportedCardType(
  map: Map<string, Set<string>>,
  dataCenterId: string,
  gpuCardTypeId: string,
) {
  if (!dataCenterId || !gpuCardTypeId) return
  const existing = map.get(dataCenterId)
  if (existing) {
    existing.add(gpuCardTypeId)
    return
  }
  map.set(dataCenterId, new Set([gpuCardTypeId]))
}

export const deviceImportDataAccess = {
  async getGpuCardTypeIdByInternalIp(supplierId: string): Promise<Record<string, string>> {
    await suppliersDataAccess.assertSupplierExists(supplierId)
    const map = await loadGpuCardTypeIdByInternalIp(supplierId)
    return Object.fromEntries(map)
  },

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

    const gpuValidation = await assertInventoryGpuCardTypesResolved(params.supplierId, params.rows)

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
      rows: params.rows,
      createId,
    })

    const cardTypesByDataCenter = new Map<string, Set<string>>()
    const affectedDataCenterIds = new Set<string>([dc.id])
    const warnings: string[] = []
    const affectedDeviceIds = new Set<string>()
    let insertedCount = 0
    let updatedCount = 0
    const existingDevices = await listSupplierDevicesForImport(params.supplierId)
    /** 本批次已写入的设备（含 insert/update），避免同文件重复行触发 sn UK */
    const devicesInImportPool: SupplierDevice[] = [...existingDevices]
    const existingComputeNodes =
      existingDevices.length > 0
        ? await db
            .select()
            .from(computeNode)
            .where(
              inArray(
                computeNode.supplierDeviceId,
                existingDevices.map((d) => d.id),
              ),
            )
        : []
    const computeNodeByDeviceId = new Map(
      existingComputeNodes.map((node) => [node.supplierDeviceId, node]),
    )

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
          const row = findImportRowForDevice(device, okRows)
          const resolution = row != null ? gpuValidation.rowResolutions.get(row.row_no) : undefined
          if (!resolution) {
            throw new Error(`第 ${row?.row_no ?? '?'} 行显卡型号未解析，无法入库`)
          }
          const gpuCardTypeId = resolution.gpuCardTypeId
          const gpuCount = resolveDeviceGpuCount(
            device.gpu_count,
            resolveGpuCardTypeRole({
              name: resolution.gpuCardTypeName,
              code: resolution.gpuCardTypeCode,
            }),
          )
          const existing = findDeviceByImportKeys(devicesInImportPool, {
            sn: device.sn,
            asset_no: device.asset_no,
            external_device_id: device.external_device_id ?? undefined,
            internal_ip: device.internal_ip,
          })
          const node = nodes.find((n) => n.device_id === device.id)

          if (existing) {
            await tx
              .update(supplierDevice)
              .set({
                onboardingBatchId: batchId,
                dataCenterId: dc.id,
                gpuCardTypeId,
                assetNo: device.asset_no,
                sn: device.sn,
                externalDeviceId: device.external_device_id,
                idcCode: device.idc_code,
                idcRegion: device.idc_region || null,
                gpuCount,
                internalIp: device.internal_ip || null,
                opsStatus: device.ops_status ?? '预留闲置中',
                lifecycleStatus: device.lifecycle_status,
                inMaintenance: device.in_maintenance ?? false,
                onboardingSubstage: device.onboarding_substage,
                bandwidthGroup: device.bandwidth_group,
                rateLimit: device.rate_limit,
                cooperationType: device.cooperation_type ?? 'idle_time',
                deviceSpec: device.device_spec,
                devicePurpose: device.device_purpose,
                receivedAt: parseIsoDate(device.received_at),
                remark: device.remark,
                loginUsername: device.login_username,
                loginPassword: device.login_password,
                updatedAt: now,
              })
              .where(eq(supplierDevice.id, existing.id))

            updatedCount++
            affectedDeviceIds.add(existing.id)
            const pricingDataCenterId = existing.data_center_id || dc.id
            affectedDataCenterIds.add(pricingDataCenterId)
            trackImportedCardType(cardTypesByDataCenter, pricingDataCenterId, gpuCardTypeId)
            warnings.push(`设备 ${existing.sn} 已存在，已更新`)

            if (node) {
              const existingNode = computeNodeByDeviceId.get(existing.id)
              if (existingNode) {
                await tx
                  .update(computeNode)
                  .set({
                    nodeRole: node.node_role,
                    mgmtIp: node.mgmt_ip || null,
                    clusterName: node.cluster_name,
                    nodeName: node.node_name,
                    expectedService: node.expected_service,
                    clusterId: node.cluster_id || null,
                    lifecycleStatus: node.lifecycle_status,
                    updatedAt: now,
                  })
                  .where(eq(computeNode.id, existingNode.id))
              } else {
                await tx.insert(computeNode).values({
                  id: node.id,
                  supplierDeviceId: existing.id,
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
              }
            }
            upsertDeviceInImportPool(devicesInImportPool, {
              ...device,
              id: existing.id,
              gpu_card_type_id: gpuCardTypeId,
            })
            continue
          }

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
            gpuCount,
            externalIp: device.external_ip || null,
            internalIp: device.internal_ip || null,
            opsStatus: device.ops_status ?? '预留闲置中',
            lifecycleStatus: device.lifecycle_status,
            inMaintenance: device.in_maintenance ?? false,
            onboardingSubstage: device.onboarding_substage,
            bandwidthGroup: device.bandwidth_group,
            rateLimit: device.rate_limit,
            cooperationType: device.cooperation_type ?? 'idle_time',
            deviceSpec: device.device_spec,
            devicePurpose: device.device_purpose,
            receivedAt: parseIsoDate(device.received_at),
            remark: device.remark,
            loginUsername: device.login_username,
            loginPassword: device.login_password,
            platformResourceId: device.platform_resource_id,
            createdAt: now,
            updatedAt: now,
          })
          insertedCount++
          affectedDeviceIds.add(device.id)
          trackImportedCardType(cardTypesByDataCenter, dc.id, gpuCardTypeId)
          upsertDeviceInImportPool(devicesInImportPool, {
            ...device,
            gpu_card_type_id: gpuCardTypeId,
          })

          if (node) {
            await tx.insert(computeNode).values({
              id: node.id,
              supplierDeviceId: device.id,
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
          }
        }

        const committedCount = insertedCount + updatedCount

        if (committedCount > 0) {
          let createdPricingCount = 0
          for (const [dataCenterId, cardTypeIds] of cardTypesByDataCenter) {
            const pricingEnsure = await ensurePricingRecordsForImportedCardTypes(tx, {
              supplierId: params.supplierId,
              dataCenterId,
              gpuCardTypeIds: [...cardTypeIds],
              defaultCooperationMode: supplierRow.defaultCooperationMode,
              syncedAt: now,
            })
            createdPricingCount += pricingEnsure.createdCardTypeIds.length
            if (pricingEnsure.createdCardTypeIds.length > 0) {
              supplierLog('device-import', 'pricing placeholders created', {
                dataCenterId,
                count: pricingEnsure.createdCardTypeIds.length,
                gpuCardTypeIds: pricingEnsure.createdCardTypeIds,
              })
            }
          }
          if (createdPricingCount > 0) {
            warnings.push(
              `新增 ${createdPricingCount} 条机房卡型成本占位（单价 0，新增收入，状态不可用，请在卡型成本中完善）`,
            )
          }

          await refreshSupplierGpuInventoryForDataCenters(tx, {
            supplierId: params.supplierId,
            dataCenterIds: [...affectedDataCenterIds],
            syncedAt: now,
          })
          supplierLog('device-import', 'gpu inventory synced', {
            dataCenterIds: [...affectedDataCenterIds],
          })
        }

        await tx.insert(supplierActivity).values({
          id: newId(),
          supplierId: params.supplierId,
          type: 'ops_import',
          title: `设备主数据导入 ${batchCode}`,
          description:
            insertedCount > 0 && updatedCount > 0
              ? `新增 ${insertedCount} 台，更新 ${updatedCount} 台物理机`
              : updatedCount > 0
                ? `更新 ${updatedCount} 台物理机`
                : `写入 ${insertedCount} 台物理机`,
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
      throw formatDeviceImportDbError(e)
    }

    const committedCount = insertedCount + updatedCount

    if (affectedDeviceIds.size > 0) {
      try {
        const { projectDeviceSnapshotsAfterInventoryImport } = await import(
          '@/lib/server/jobs/dashboard-masterdata-snapshot/project-devices'
        )
        await projectDeviceSnapshotsAfterInventoryImport({
          deviceIds: [...affectedDeviceIds],
          occurredAt: now,
          onboardingBatchId: batchId,
        })
      } catch (snapshotError) {
        supplierError('device-import', 'masterdata snapshot projection failed', snapshotError, {
          batchId,
          deviceCount: affectedDeviceIds.size,
        })
        warnings.push('设备主数据快照写入失败，Period 可能标记为近似值，请稍后重试或联系运维')
      }
    }

    supplierLog('device-import', 'commitInventory done', {
      batchId,
      committedCount,
      insertedCount,
      updatedCount,
      snapshotDevices: affectedDeviceIds.size,
    })

    return {
      batchId,
      batchCode,
      committedCount,
      skippedCount: 0,
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

    const ticketNos = okRows
      .map((r) => r.ticket_no?.trim())
      .filter((t): t is string => Boolean(t))
    const businessBatch = await resolveSingleBusinessBatchFromRows(
      params.supplierId,
      ticketNos,
    )

    if (businessBatch) {
      if (businessBatch.dataCenterId !== dc.id) {
        throw new Error(
          `导入机房与业务批次 ${businessBatch.batchCode} 所在机房不一致，请选择该批次对应机房后重试`,
        )
      }
    }

    const unknownTicketNos =
      businessBatch && ticketNos.length > 0
        ? [...new Set(ticketNos)].filter((t) => !ticketRefsForBatch(businessBatch).has(t))
        : []

    const supplierDevices = await listSupplierDevicesForImport(
      params.supplierId,
      dc.id,
    )
    const businessBatchLink = businessBatch
      ? {
          businessBatchId: businessBatch.id,
          businessDataCenterId: businessBatch.dataCenterId,
          ticketRefs: ticketRefsForBatch(businessBatch),
          batchKind: businessBatch.batchKind,
          retireActionType: businessBatch.retireActionType,
        }
      : undefined

    const { logs, updatedDevices, deviceLinks, bindWarnings } =
      buildChangeLogsFromChangelogImport({
        batchId,
        rows: params.rows,
        devices: supplierDevices,
        createId,
        businessBatchLink,
      })

    const notFoundCount = okRows.length - logs.length
    const warnings: string[] = [...bindWarnings]
    if (ticketNos.length > 0 && !businessBatch) {
      warnings.push(
        '变更表工单号未匹配到上架/订单接入/下架批次（请填写飞书工单号或批次号 ONB-/ORD-/RET-），仅写入变更审计',
      )
    }
    if (unknownTicketNos.length > 0 && businessBatch) {
      warnings.push(
        `工单号 ${unknownTicketNos.join('、')} 与业务批次 ${businessBatch.batchCode} 不一致，对应行不会挂接设备`,
      )
    }
    if (notFoundCount > 0) {
      warnings.push(`${notFoundCount} 行未匹配到本机房已有设备，已跳过`)
    }
    if (businessBatch && ticketNos.length > 0 && deviceLinks.length === 0 && logs.length > 0) {
      warnings.push(
        `已识别业务批次 ${businessBatch.batchCode}，但无设备满足挂接条件（请检查工单号、机房或设备卡型）`,
      )
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
          parentBatchId: businessBatch?.id ?? null,
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
            businessOnboardingBatchId: log.business_onboarding_batch_id ?? null,
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

        if (businessBatch) {
          for (const link of deviceLinks) {
            await tx
              .insert(onboardingBatchDeviceLink)
              .values({
                id: newId(),
                businessOnboardingBatchId: businessBatch.id,
              supplierDeviceId: link.supplierDeviceId,
              linkKind: link.linkKind,
              sourceChangeLogId: link.sourceChangeLogId,
              sourceChangelogBatchId: batchId,
              gpuCardTypeId: link.gpuCardTypeId,
              cooperationType: link.cooperationType,
              linkedAt: now,
              createdAt: now,
            })
              .onConflictDoUpdate({
                target: [
                  onboardingBatchDeviceLink.businessOnboardingBatchId,
                  onboardingBatchDeviceLink.supplierDeviceId,
                ],
                set: {
                  linkKind: link.linkKind,
                  sourceChangeLogId: link.sourceChangeLogId,
                  sourceChangelogBatchId: batchId,
                  linkedAt: now,
                },
              })
          }
        }

        if (businessBatch && deviceLinks.length > 0) {
          const hasActionMismatch = bindWarnings.some((w) => w.includes('不一致'))
          await refreshBatchProgress(
            businessBatch.id,
            tx,
            now,
            hasActionMismatch ? { has_action_mismatch: true } : undefined,
          )
        }

        const activityDescription = businessBatch
          ? `追加 ${logs.length} 条变更审计；${deviceLinks.length} 台设备已关联业务批次 ${businessBatch.batchCode}`
          : `追加 ${logs.length} 条变更审计`

        await tx.insert(supplierActivity).values({
          id: newId(),
          supplierId: params.supplierId,
          type: 'device_change_imported',
          title: businessBatch
            ? `设备变更导入 ${batchCode}（关联 ${businessBatch.batchCode}）`
            : `设备变更导入 ${batchCode}`,
          description: activityDescription,
          authorStaffId: params.operatorStaffId ?? null,
          authorName: params.operatorName ?? '运营',
          authorRole: 'ops',
          refDomain: 'batch',
          refId: batchId,
          metadata: businessBatch
            ? {
                linked_business_batch_id: businessBatch.id,
                bound_device_count: deviceLinks.length,
              }
            : null,
          occurredAt: now,
        })
      })
    } catch (e) {
      supplierError('device-import', 'commitChangelog failed', e, { batchId })
      throw e
    }

    supplierLog('device-import', 'commitChangelog done', {
      batchId,
      logs: logs.length,
      deviceLinks: deviceLinks.length,
      businessBatchId: businessBatch?.id,
    })

    return {
      batchId,
      batchCode,
      committedCount: logs.length,
      skippedCount: notFoundCount,
      warnings,
      linkedBusinessBatchId: businessBatch?.id ?? null,
      boundDeviceCount: deviceLinks.length,
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
