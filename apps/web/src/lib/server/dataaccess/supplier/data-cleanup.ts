import { db } from '@/lib/db'
import type {
  SupplierDataCleanupExecuteInput,
  SupplierDataCleanupMode,
  SupplierDataCleanupPreviewInput,
} from '@/lib/server/routers/supplier/data-cleanup-schemas'
import { supplierLog, supplierWarn } from '@/lib/server/dataaccess/supplier/logger'
import {
  dataCenter,
  entityStateTransitionLog,
  faultIncident,
  internalTestHold,
  onboardingBatch,
  onboardingBatchDeviceLink,
  onboardingBatchProgressEvent,
  supplier,
  supplierActivity,
  supplierContract,
  supplierDevice,
  supplierDeviceChangeLog,
  supplierGpuInventory,
  supplierOpsUploadBatch,
} from '@workspace/db/schema'
import {
  and,
  count,
  eq,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'

const CLEANUP_LOCK_KEY = 88472931

const BUSINESS_BATCH_KINDS = ['online', 'order_access'] as const

export type SupplierDataCleanupScope = {
  mode: SupplierDataCleanupMode
  supplierId?: string
  dataCenterId?: string
  includeOpsUploadBatch: boolean
}

export type SupplierDataCleanupPreviewRow = {
  key: string
  label: string
  currentCount: number
  willDeleteCount: number
}

export type SupplierDataCleanupStepResult = {
  step: string
  label: string
  affected: number
}

function resolveScope(input: SupplierDataCleanupPreviewInput): SupplierDataCleanupScope {
  if (input.mode === 'scoped' && !input.supplierId && !input.dataCenterId) {
    throw new Error('按范围清理需至少选择供应商或机房')
  }
  return {
    mode: input.mode,
    supplierId: input.supplierId,
    dataCenterId: input.dataCenterId,
    includeOpsUploadBatch: input.includeOpsUploadBatch ?? input.mode !== 'business_batches_only',
  }
}

function deviceScopeWhere(scope: SupplierDataCleanupScope): SQL | undefined {
  const parts: SQL[] = []
  if (scope.supplierId) parts.push(eq(supplierDevice.supplierId, scope.supplierId))
  if (scope.dataCenterId) parts.push(eq(supplierDevice.dataCenterId, scope.dataCenterId))
  return parts.length > 0 ? and(...parts) : undefined
}

function batchScopeWhere(
  scope: SupplierDataCleanupScope,
  kinds?: readonly string[],
): SQL | undefined {
  const parts: SQL[] = []
  if (kinds?.length) parts.push(inArray(onboardingBatch.batchKind, [...kinds]))
  if (scope.supplierId) parts.push(eq(onboardingBatch.supplierId, scope.supplierId))
  if (scope.dataCenterId) parts.push(eq(onboardingBatch.dataCenterId, scope.dataCenterId))
  return parts.length > 0 ? and(...parts) : undefined
}

function inventoryScopeWhere(scope: SupplierDataCleanupScope): SQL | undefined {
  const parts: SQL[] = []
  if (scope.supplierId) parts.push(eq(supplierGpuInventory.supplierId, scope.supplierId))
  if (scope.dataCenterId) parts.push(eq(supplierGpuInventory.dataCenterId, scope.dataCenterId))
  return parts.length > 0 ? and(...parts) : undefined
}

function isFullLikeScope(scope: SupplierDataCleanupScope): boolean {
  return scope.mode === 'full' || scope.mode === 'scoped'
}

async function countTable(table: PgTable, where?: SQL): Promise<number> {
  const q = db.select({ c: count() }).from(table)
  const [row] = where ? await q.where(where) : await q
  return Number(row?.c ?? 0)
}

async function countProgressEventsForBatches(batchWhere?: SQL): Promise<number> {
  if (!batchWhere) {
    return countTable(onboardingBatchProgressEvent)
  }
  const [row] = await db
    .select({ c: count() })
    .from(onboardingBatchProgressEvent)
    .innerJoin(
      onboardingBatch,
      eq(onboardingBatchProgressEvent.onboardingBatchId, onboardingBatch.id),
    )
    .where(batchWhere)
  return Number(row?.c ?? 0)
}

async function countBusinessBatchLinks(scope: SupplierDataCleanupScope): Promise<number> {
  const batchWhere = batchScopeWhere(scope, BUSINESS_BATCH_KINDS)
  const [row] = await db
    .select({ c: count() })
    .from(onboardingBatchDeviceLink)
    .where(
      inArray(
        onboardingBatchDeviceLink.businessOnboardingBatchId,
        db
          .select({ id: onboardingBatch.id })
          .from(onboardingBatch)
          .where(batchWhere ?? inArray(onboardingBatch.batchKind, [...BUSINESS_BATCH_KINDS])),
      ),
    )
  return Number(row?.c ?? 0)
}

async function countFaultIncidentsToUnlink(scope: SupplierDataCleanupScope): Promise<number> {
  const deviceWhere = deviceScopeWhere(scope)
  if (!deviceWhere) {
    return countTable(
      faultIncident,
      or(isNotNull(faultIncident.supplierDeviceId), isNotNull(faultIncident.computeNodeId)),
    )
  }
  const [row] = await db
    .select({ c: count() })
    .from(faultIncident)
    .innerJoin(supplierDevice, eq(faultIncident.supplierDeviceId, supplierDevice.id))
    .where(deviceWhere)
  return Number(row?.c ?? 0)
}

function affectedRows(result: unknown): number {
  if (result && typeof result === 'object' && 'rowCount' in result) {
    return Number((result as { rowCount: number | null }).rowCount ?? 0)
  }
  return 0
}

async function acquireCleanupLock(): Promise<void> {
  const result = await db.execute<{ acquired: boolean }>(
    sql`SELECT pg_try_advisory_lock(${CLEANUP_LOCK_KEY}) AS acquired`,
  )
  if (!result.rows[0]?.acquired) {
    throw new Error('另有数据清理任务正在执行，请稍后再试')
  }
}

async function releaseCleanupLock(): Promise<void> {
  await db.execute(sql`SELECT pg_advisory_unlock(${CLEANUP_LOCK_KEY})`)
}

function getAppEnvLabel(): string {
  if (process.env.VERCEL_ENV === 'production') return 'production'
  if (process.env.NODE_ENV === 'production') return 'production'
  if (process.env.VERCEL_ENV === 'preview') return 'preview'
  return process.env.NODE_ENV === 'test' ? 'test' : 'development'
}

export const supplierDataCleanupDataAccess = {
  getCapabilities() {
    const appEnv = getAppEnvLabel()
    const isProduction = appEnv === 'production'
    return {
      appEnv,
      isProduction,
      requiresApprovalTicket: isProduction,
    }
  },

  async preview(input: SupplierDataCleanupPreviewInput) {
    const scope = resolveScope(input)
    const rows: SupplierDataCleanupPreviewRow[] = []

    if (isFullLikeScope(scope)) {
      const deviceWhere = deviceScopeWhere(scope)
      const invWhere = inventoryScopeWhere(scope)
      const batchWhere = batchScopeWhere(scope)

      const deviceCount = await countTable(supplierDevice, deviceWhere)
      const invCount = await countTable(supplierGpuInventory, invWhere)
      const batchCount = await countTable(onboardingBatch, batchWhere)

      rows.push(
        { key: 'supplier_device', label: '物理机台账', currentCount: deviceCount, willDeleteCount: deviceCount },
        { key: 'supplier_gpu_inventory', label: 'GPU L1 库存', currentCount: invCount, willDeleteCount: invCount },
        { key: 'onboarding_batch', label: '接入批次（全部种类）', currentCount: batchCount, willDeleteCount: batchCount },
        {
          key: 'onboarding_batch_progress_event',
          label: '批次进度事件',
          currentCount: await countProgressEventsForBatches(batchWhere),
          willDeleteCount: await countProgressEventsForBatches(batchWhere),
        },
        {
          key: 'fault_incident_unlink',
          label: '故障单（将解绑设备）',
          currentCount: await countFaultIncidentsToUnlink(scope),
          willDeleteCount: await countFaultIncidentsToUnlink(scope),
        },
      )

      if (scope.includeOpsUploadBatch && (!scope.dataCenterId || scope.supplierId)) {
        const opsWhere = scope.supplierId
          ? eq(supplierOpsUploadBatch.supplierId, scope.supplierId)
          : undefined
        const opsCount = await countTable(supplierOpsUploadBatch, opsWhere)
        rows.push({
          key: 'supplier_ops_upload_batch',
          label: '运维上传批次',
          currentCount: opsCount,
          willDeleteCount: opsCount,
        })
      }
    } else {
      const onlineWhere = and(eq(onboardingBatch.batchKind, 'online'), batchScopeWhere(scope) ?? sql`true`)
      const orderWhere = and(
        eq(onboardingBatch.batchKind, 'order_access'),
        batchScopeWhere(scope) ?? sql`true`,
      )
      const onlineCount = await countTable(onboardingBatch, onlineWhere)
      const orderCount = await countTable(onboardingBatch, orderWhere)
      const linkCount = await countBusinessBatchLinks(scope)
      const deviceCount = await countTable(supplierDevice, deviceScopeWhere(scope))

      rows.push(
        { key: 'supplier_device', label: '物理机台账（保留）', currentCount: deviceCount, willDeleteCount: 0 },
        { key: 'onboarding_batch_online', label: '上架批次 (online)', currentCount: onlineCount, willDeleteCount: onlineCount },
        {
          key: 'onboarding_batch_order_access',
          label: '订单接入批次 (order_access)',
          currentCount: orderCount,
          willDeleteCount: orderCount,
        },
        {
          key: 'onboarding_batch_device_link',
          label: '批次设备关联',
          currentCount: linkCount,
          willDeleteCount: linkCount,
        },
      )
    }

    const totalWillDelete = rows.reduce((sum, r) => sum + r.willDeleteCount, 0)
    return { scope, rows, totalWillDelete, previewedAt: new Date().toISOString() }
  },

  async execute(input: SupplierDataCleanupExecuteInput, operatorUserId: string) {
    const scope = resolveScope(input)
    const caps = this.getCapabilities()
    if (caps.isProduction && !input.approvalTicketNo?.trim()) {
      throw new Error('生产环境须填写变更审批单号')
    }

    await acquireCleanupLock()
    const startedAt = Date.now()
    const steps: SupplierDataCleanupStepResult[] = []

    try {
      await db.transaction(async (tx) => {
        if (scope.mode === 'business_batches_only') {
          steps.push(...(await executeBusinessBatchesOnly(tx, scope)))
        } else {
          steps.push(...(await executeFullDomainCleanup(tx, scope)))
        }
      })

      const validation = await this.getPostCleanupValidation(scope)
      supplierLog('data-cleanup', 'completed', {
        operatorUserId,
        mode: scope.mode,
        supplierId: scope.supplierId,
        dataCenterId: scope.dataCenterId,
        durationMs: Date.now() - startedAt,
        approvalTicketNo: input.approvalTicketNo,
      })

      return {
        steps,
        validation,
        durationMs: Date.now() - startedAt,
        completedAt: new Date().toISOString(),
      }
    } catch (error) {
      supplierWarn('data-cleanup', 'failed', {
        operatorUserId,
        mode: scope.mode,
        err: error instanceof Error ? error.message : String(error),
      })
      throw error
    } finally {
      await releaseCleanupLock()
    }
  },

  async getPostCleanupValidation(scope: SupplierDataCleanupScope) {
    const deviceWhere = deviceScopeWhere(scope)
    const fullBatchWhere = batchScopeWhere(scope)
    const businessBatchWhere = batchScopeWhere(scope, BUSINESS_BATCH_KINDS)

    const [devices, batches, inventory, deviceLinks] = await Promise.all([
      isFullLikeScope(scope) ? countTable(supplierDevice, deviceWhere) : 0,
      isFullLikeScope(scope)
        ? countTable(onboardingBatch, fullBatchWhere)
        : countTable(
            onboardingBatch,
            businessBatchWhere ?? inArray(onboardingBatch.batchKind, [...BUSINESS_BATCH_KINDS]),
          ),
      isFullLikeScope(scope) ? countTable(supplierGpuInventory, inventoryScopeWhere(scope)) : 0,
      isFullLikeScope(scope)
        ? countTable(
            onboardingBatchDeviceLink,
            deviceWhere
              ? sql`${onboardingBatchDeviceLink.supplierDeviceId} IN (SELECT id FROM supplier_device WHERE ${deviceWhere})`
              : undefined,
          )
        : countBusinessBatchLinks(scope),
    ])

    const [suppliers, datacenters, contracts] = await Promise.all([
      countTable(supplier),
      countTable(dataCenter),
      countTable(supplierContract),
    ])

    return {
      devices: isFullLikeScope(scope) ? devices : 0,
      batches,
      inventory: isFullLikeScope(scope) ? inventory : 0,
      changeLogs: isFullLikeScope(scope)
        ? await countTable(
            supplierDeviceChangeLog,
            deviceWhere
              ? sql`${supplierDeviceChangeLog.supplierDeviceId} IN (SELECT id FROM supplier_device WHERE ${deviceWhere})`
              : undefined,
          )
        : 0,
      deviceLinks,
      progressEvents: isFullLikeScope(scope)
        ? await countProgressEventsForBatches(fullBatchWhere)
        : 0,
      preserved: { suppliers, datacenters, contracts },
    }
  },
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

async function executeFullDomainCleanup(tx: Tx, scope: SupplierDataCleanupScope) {
  const steps: SupplierDataCleanupStepResult[] = []
  const deviceWhere = deviceScopeWhere(scope)
  const invWhere = inventoryScopeWhere(scope)
  const batchWhere = batchScopeWhere(scope)

  if (deviceWhere) {
    const r = await tx.execute(sql`
      UPDATE fault_incident fi
      SET supplier_device_id = NULL, compute_node_id = NULL
      FROM supplier_device sd
      WHERE fi.supplier_device_id = sd.id AND ${deviceWhere}
    `)
    steps.push({ step: 'fault_incident', label: '解绑故障单设备', affected: affectedRows(r) })
  } else {
    const r = await tx
      .update(faultIncident)
      .set({ supplierDeviceId: null, computeNodeId: null })
      .where(or(isNotNull(faultIncident.supplierDeviceId), isNotNull(faultIncident.computeNodeId)))
    steps.push({ step: 'fault_incident', label: '解绑故障单设备', affected: affectedRows(r) })
  }

  steps.push(await deleteScopedActivities(tx, scope, true))
  steps.push(await deleteScopedTransitionLogs(tx, scope, true))

  const holdParts: SQL[] = [
    isNull(internalTestHold.supplierDeviceId),
    isNull(internalTestHold.supplierGpuInventoryId),
  ]
  if (scope.supplierId) holdParts.push(eq(internalTestHold.supplierId, scope.supplierId))
  if (scope.dataCenterId) holdParts.push(eq(internalTestHold.dataCenterId, scope.dataCenterId))
  const holdRes = await tx.delete(internalTestHold).where(and(...holdParts))
  steps.push({ step: 'internal_test_hold', label: '清理无绑定测试占用', affected: affectedRows(holdRes) })

  const devRes = deviceWhere
    ? await tx.delete(supplierDevice).where(deviceWhere)
    : await tx.delete(supplierDevice)
  steps.push({ step: 'supplier_device', label: '删除物理机', affected: affectedRows(devRes) })

  const invRes = invWhere
    ? await tx.delete(supplierGpuInventory).where(invWhere)
    : await tx.delete(supplierGpuInventory)
  steps.push({ step: 'supplier_gpu_inventory', label: '删除 GPU 库存', affected: affectedRows(invRes) })

  if (batchWhere) {
    await tx.update(onboardingBatch).set({ parentBatchId: null }).where(batchWhere)
    const batchRes = await tx.delete(onboardingBatch).where(batchWhere)
    steps.push({ step: 'onboarding_batch', label: '删除接入批次', affected: affectedRows(batchRes) })
  } else {
    await tx.update(onboardingBatch).set({ parentBatchId: null })
    const batchRes = await tx.delete(onboardingBatch)
    steps.push({ step: 'onboarding_batch', label: '删除接入批次', affected: affectedRows(batchRes) })
  }

  if (scope.includeOpsUploadBatch && (!scope.dataCenterId || scope.supplierId)) {
    const opsWhere = scope.supplierId ? eq(supplierOpsUploadBatch.supplierId, scope.supplierId) : undefined
    const opsRes = opsWhere
      ? await tx.delete(supplierOpsUploadBatch).where(opsWhere)
      : await tx.delete(supplierOpsUploadBatch)
    steps.push({
      step: 'supplier_ops_upload_batch',
      label: '删除运维上传批次',
      affected: affectedRows(opsRes),
    })
  }

  return steps
}

async function executeBusinessBatchesOnly(tx: Tx, scope: SupplierDataCleanupScope) {
  const steps: SupplierDataCleanupStepResult[] = []
  const businessWhere = batchScopeWhere(scope, BUSINESS_BATCH_KINDS) ?? inArray(onboardingBatch.batchKind, [...BUSINESS_BATCH_KINDS])

  const batchIdRows = await tx.select({ id: onboardingBatch.id }).from(onboardingBatch).where(businessWhere)
  const batchIds = batchIdRows.map((r) => r.id)

  if (batchIds.length === 0) {
    return [{ step: 'noop', label: '无匹配商务批次', affected: 0 }]
  }

  const linkRes = await tx
    .delete(onboardingBatchDeviceLink)
    .where(inArray(onboardingBatchDeviceLink.businessOnboardingBatchId, batchIds))
  steps.push({ step: 'device_links', label: '删除批次设备关联', affected: affectedRows(linkRes) })

  const logRes = await tx
    .update(supplierDeviceChangeLog)
    .set({ businessOnboardingBatchId: null })
    .where(inArray(supplierDeviceChangeLog.businessOnboardingBatchId, batchIds))
  steps.push({ step: 'change_log', label: '清空变更日志业务批次引用', affected: affectedRows(logRes) })

  steps.push(await deleteScopedTransitionLogs(tx, scope, false, batchIds))
  steps.push(await deleteScopedActivities(tx, scope, false, batchIds))

  const batchRes = await tx.delete(onboardingBatch).where(inArray(onboardingBatch.id, batchIds))
  steps.push({ step: 'onboarding_batch', label: '删除商务批次', affected: affectedRows(batchRes) })

  return steps
}

async function deleteScopedActivities(
  tx: Tx,
  scope: SupplierDataCleanupScope,
  fullDomain: boolean,
  businessBatchIds?: string[],
): Promise<SupplierDataCleanupStepResult> {
  let affected = 0

  if (fullDomain) {
    if (scope.supplierId || scope.dataCenterId) {
      const dWhere = deviceScopeWhere(scope)!
      const bWhere = batchScopeWhere(scope)!
      const r1 = await tx.execute(sql`
        DELETE FROM supplier_activity_attachment
        WHERE activity_id IN (
          SELECT sa.id FROM supplier_activity sa
          INNER JOIN supplier_device sd ON sa.ref_domain = 'device' AND sa.ref_id = sd.id
          WHERE ${dWhere}
          UNION
          SELECT sa.id FROM supplier_activity sa
          INNER JOIN onboarding_batch ob ON sa.ref_domain = 'batch' AND sa.ref_id = ob.id
          WHERE ${bWhere}
        )
      `)
      affected += affectedRows(r1)
      const r2 = await tx.execute(sql`
        DELETE FROM supplier_activity sa
        USING supplier_device sd
        WHERE sa.ref_domain = 'device' AND sa.ref_id = sd.id AND ${dWhere}
      `)
      affected += affectedRows(r2)
      const r3 = await tx.execute(sql`
        DELETE FROM supplier_activity sa
        USING onboarding_batch ob
        WHERE sa.ref_domain = 'batch' AND sa.ref_id = ob.id AND ${bWhere}
      `)
      affected += affectedRows(r3)
      if (scope.includeOpsUploadBatch && scope.supplierId) {
        const r4 = await tx.execute(sql`
          DELETE FROM supplier_activity_attachment
          WHERE activity_id IN (
            SELECT id FROM supplier_activity
            WHERE ref_domain = 'ops_upload_batch' AND supplier_id = ${scope.supplierId}
          )
        `)
        affected += affectedRows(r4)
        const r5 = await tx
          .delete(supplierActivity)
          .where(
            and(
              eq(supplierActivity.refDomain, 'ops_upload_batch'),
              eq(supplierActivity.supplierId, scope.supplierId),
            ),
          )
        affected += affectedRows(r5)
      }
    } else {
      const att = await tx.execute(sql`
        DELETE FROM supplier_activity_attachment
        WHERE activity_id IN (
          SELECT id FROM supplier_activity
          WHERE ref_domain IN ('device', 'batch', 'ops_upload_batch')
        )
      `)
      affected += affectedRows(att)
      const act = await tx
        .delete(supplierActivity)
        .where(inArray(supplierActivity.refDomain, ['device', 'batch', 'ops_upload_batch']))
      affected += affectedRows(act)
    }
  } else if (businessBatchIds?.length) {
    const refIds = businessBatchIds
    const att = await tx.execute(sql`
      DELETE FROM supplier_activity_attachment
      WHERE activity_id IN (
        SELECT id FROM supplier_activity
        WHERE ref_domain = 'batch' AND ref_id IN (${sql.join(
          refIds.map((id) => sql`${id}`),
          sql`, `,
        )})
      )
    `)
    affected += affectedRows(att)
    const act = await tx
      .delete(supplierActivity)
      .where(
        and(eq(supplierActivity.refDomain, 'batch'), inArray(supplierActivity.refId, refIds)),
      )
    affected += affectedRows(act)
  }

  return { step: 'supplier_activity', label: '清理活动时间线', affected }
}

async function deleteScopedTransitionLogs(
  tx: Tx,
  scope: SupplierDataCleanupScope,
  fullDomain: boolean,
  businessBatchIds?: string[],
): Promise<SupplierDataCleanupStepResult> {
  let affected = 0

  if (fullDomain) {
    if (scope.supplierId || scope.dataCenterId) {
      const deviceWhere = deviceScopeWhere(scope)!
      const batchWhere = batchScopeWhere(scope)!
      const r = await tx.execute(sql`
        DELETE FROM entity_state_transition_log est
        WHERE (
          est.entity_type = 'device'
          AND est.entity_id IN (SELECT id FROM supplier_device WHERE ${deviceWhere})
        ) OR (
          est.entity_type = 'compute_node'
          AND est.entity_id IN (
            SELECT cn.id FROM compute_node cn
            INNER JOIN supplier_device sd ON cn.supplier_device_id = sd.id
            WHERE ${deviceWhere}
          )
        ) OR (
          est.entity_type = 'batch'
          AND est.entity_id IN (SELECT id::text FROM onboarding_batch WHERE ${batchWhere})
        )
      `)
      affected = affectedRows(r)
    } else {
      const r = await tx
        .delete(entityStateTransitionLog)
        .where(inArray(entityStateTransitionLog.entityType, ['device', 'compute_node', 'batch']))
      affected = affectedRows(r)
    }
  } else if (businessBatchIds?.length) {
    const r = await tx
      .delete(entityStateTransitionLog)
      .where(
        and(
          eq(entityStateTransitionLog.entityType, 'batch'),
          inArray(entityStateTransitionLog.entityId, businessBatchIds),
        ),
      )
    affected = affectedRows(r)
  }

  return { step: 'entity_state_transition_log', label: '清理状态审计日志', affected }
}
