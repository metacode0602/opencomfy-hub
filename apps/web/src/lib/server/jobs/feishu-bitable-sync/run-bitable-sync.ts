import 'server-only'

import { db } from '@/lib/db'
import { deviceImportDataAccess } from '@/lib/server/dataaccess/supplier/device-import'
import { supplierLog, supplierError, supplierWarn } from '@/lib/server/dataaccess/supplier/logger'
import {
  buildFieldIdToNameMap,
  computeNextCursor,
  filterRecordsByCursor,
  getCanonicalHeadersForSyncKind,
  mapBitableRecordsToImportRows,
  validateFieldMapping,
  type FeishuBitableFieldMapping,
  type FeishuBitableSyncCursor,
  type FeishuBitableSyncKind,
} from '@/lib/server/integrations/feishu/bitable-field-mapper'
import {
  listFeishuBitableFields,
  listFeishuBitableRecords,
} from '@/lib/server/integrations/feishu/bitable-client'
import { loadFeishuRuntimeConfig } from '@/lib/server/integrations/feishu/config'
import { isFeishuBitableSyncEnabled } from '@/lib/server/jobs/feishu-bitable-sync/bitable-sync-config'
import { buildImportTableFromRows } from '@/lib/supplier-ops/parse-device-import-file'
import {
  parseDeviceChangelogTable,
  parseDeviceInventoryTable,
} from '@/lib/supplier-ops/parse-device-import-csv'
import type {
  FeishuBitableSyncPreviewResult,
  FeishuBitableSyncRunResult,
} from '@/lib/types/feishu-bitable-sync'
import type {
  DeviceChangelogParsedRow,
  DeviceInventoryParsedRow,
} from '@/lib/types/supplier-domain'
import { dataCenter, feishuBitableSyncConfig, feishuIntegrationJobRun } from '@workspace/db/schema'
import { and, eq, sql } from 'drizzle-orm'

function newId() {
  return crypto.randomUUID()
}

function bitableSyncLockKey(supplierId: string, dataCenterId: string, syncKind: string): number {
  const str = `feishu-bitable:${supplierId}:${dataCenterId}:${syncKind}`
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

async function tryAcquireLock(key: number): Promise<boolean> {
  const result = await db.execute<{ acquired: boolean }>(
    sql`SELECT pg_try_advisory_lock(${key}) AS acquired`,
  )
  return Boolean(result.rows[0]?.acquired)
}

async function releaseLock(key: number): Promise<void> {
  await db.execute(sql`SELECT pg_advisory_unlock(${key})`)
}

function parseFieldMapping(raw: unknown): FeishuBitableFieldMapping {
  if (!raw || typeof raw !== 'object') return {}
  const mapping: FeishuBitableFieldMapping = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string' && value.trim()) {
      mapping[key] = value.trim()
    }
  }
  return mapping
}

function parseCursor(raw: unknown): FeishuBitableSyncCursor {
  if (!raw || typeof raw !== 'object') return {}
  const cursor = raw as FeishuBitableSyncCursor
  return {
    lastModifiedMs:
      typeof cursor.lastModifiedMs === 'number' ? cursor.lastModifiedMs : undefined,
    lastRecordId:
      typeof cursor.lastRecordId === 'string' ? cursor.lastRecordId : undefined,
  }
}

function summarizeParseResult(
  rows: Array<{ row_no: number; parse_status: string; parse_message?: string | null }>,
  parseError: string | null,
  missingRequiredHeaders: string[],
  recordCount: number,
): FeishuBitableSyncPreviewResult {
  const okCount = rows.filter((r) => r.parse_status === 'ok').length
  const warningCount = rows.filter((r) => r.parse_status === 'warning').length
  const errorCount = rows.filter((r) => r.parse_status === 'error').length
  const sampleErrors = rows
    .filter((r) => r.parse_status === 'error')
    .slice(0, 20)
    .map((r) => ({ rowNo: r.row_no, message: r.parse_message ?? null }))

  return {
    recordCount,
    parsedRowCount: rows.length,
    okCount,
    warningCount,
    errorCount,
    parseError,
    sampleErrors,
    missingRequiredHeaders,
  }
}

async function parseBitableRows(input: {
  syncKind: FeishuBitableSyncKind
  fieldMapping: FeishuBitableFieldMapping
  records: Awaited<ReturnType<typeof listFeishuBitableRecords>>
  bitableFields: Awaited<ReturnType<typeof listFeishuBitableFields>>
}): Promise<
  | { ok: false; preview: FeishuBitableSyncPreviewResult }
  | {
      ok: true
      preview: FeishuBitableSyncPreviewResult
      rows: DeviceInventoryParsedRow[] | DeviceChangelogParsedRow[]
    }
> {
  const missingRequiredHeaders = validateFieldMapping(input.fieldMapping, input.syncKind)
  if (missingRequiredHeaders.length > 0) {
    return {
      ok: false,
      preview: summarizeParseResult([], null, missingRequiredHeaders, input.records.length),
    }
  }

  const fieldIdToName = buildFieldIdToNameMap(input.bitableFields)
  const importRows = mapBitableRecordsToImportRows({
    records: input.records,
    fieldMapping: input.fieldMapping,
    fieldIdToName,
    syncKind: input.syncKind,
  })

  const headers = getCanonicalHeadersForSyncKind(input.syncKind).filter(
    (header) => input.fieldMapping[header],
  )
  const table = buildImportTableFromRows(headers, importRows)

  if (input.syncKind === 'device_inventory') {
    const parsed = parseDeviceInventoryTable(table)
    if (!parsed.ok) {
      return {
        ok: false,
        preview: summarizeParseResult([], parsed.error, [], input.records.length),
      }
    }
    return {
      ok: true,
      preview: summarizeParseResult(parsed.rows, null, [], input.records.length),
      rows: parsed.rows,
    }
  }

  const parsed = parseDeviceChangelogTable(table)
  if (!parsed.ok) {
    return {
      ok: false,
      preview: summarizeParseResult([], parsed.error, [], input.records.length),
    }
  }
  return {
    ok: true,
    preview: summarizeParseResult(parsed.rows, null, [], input.records.length),
    rows: parsed.rows,
  }
}

export async function runFeishuBitableSync(input: {
  configId: string
  trigger: 'scheduled' | 'manual'
  forceFullSync?: boolean
}): Promise<FeishuBitableSyncRunResult> {
  const configRow = await db.query.feishuBitableSyncConfig.findFirst({
    where: eq(feishuBitableSyncConfig.id, input.configId),
  })
  if (!configRow) {
    throw new Error('同步配置不存在')
  }

  const runtimeConfig = loadFeishuRuntimeConfig()
  const jobRunId = newId()
  const now = new Date()
  const fieldMapping = parseFieldMapping(configRow.fieldMappingJson)
  const cursor = input.forceFullSync ? {} : parseCursor(configRow.cursorJson)
  const lockKey = bitableSyncLockKey(
    configRow.supplierId,
    configRow.dataCenterId,
    configRow.syncKind,
  )

  await db.insert(feishuIntegrationJobRun).values({
    id: jobRunId,
    jobKind: 'bitable_sync',
    status: 'running',
    supplierId: configRow.supplierId,
    refDomain: 'feishu_bitable_sync_config',
    refId: configRow.id,
    requestSummary: {
      trigger: input.trigger,
      syncKind: configRow.syncKind,
      dataCenterId: configRow.dataCenterId,
      forceFullSync: Boolean(input.forceFullSync),
    },
    startedAt: now,
  })

  await db
    .update(feishuBitableSyncConfig)
    .set({ lastRunAt: now })
    .where(eq(feishuBitableSyncConfig.id, configRow.id))

  if (!isFeishuBitableSyncEnabled() || !runtimeConfig?.enabled) {
    await db
      .update(feishuIntegrationJobRun)
      .set({
        status: 'skipped',
        finishedAt: new Date(),
        errorMessage: '飞书集成或 Bitable 同步未启用',
      })
      .where(eq(feishuIntegrationJobRun.id, jobRunId))
    return { jobRunId, status: 'skipped', message: '飞书集成或 Bitable 同步未启用' }
  }

  if (!configRow.enabled) {
    await db
      .update(feishuIntegrationJobRun)
      .set({
        status: 'skipped',
        finishedAt: new Date(),
        errorMessage: '同步配置已禁用',
      })
      .where(eq(feishuIntegrationJobRun.id, jobRunId))
    return { jobRunId, status: 'skipped', message: '同步配置已禁用' }
  }

  const acquired = await tryAcquireLock(lockKey)
  if (!acquired) {
    await db
      .update(feishuIntegrationJobRun)
      .set({
        status: 'skipped',
        finishedAt: new Date(),
        errorMessage: '其他实例正在同步该配置',
      })
      .where(eq(feishuIntegrationJobRun.id, jobRunId))
    return { jobRunId, status: 'skipped', message: '其他实例正在同步该配置' }
  }

  try {
    const [dc] = await db
      .select({ code: dataCenter.code, name: dataCenter.name })
      .from(dataCenter)
      .where(
        and(
          eq(dataCenter.id, configRow.dataCenterId),
          eq(dataCenter.supplierId, configRow.supplierId),
        ),
      )
      .limit(1)
    if (!dc) {
      throw new Error('机房不存在或不属于该供应商')
    }

    const bitableFields = await listFeishuBitableFields(
      runtimeConfig,
      configRow.appToken,
      configRow.tableId,
    )
    const allRecords = await listFeishuBitableRecords({
      config: runtimeConfig,
      appToken: configRow.appToken,
      tableId: configRow.tableId,
      viewId: configRow.viewId,
      filterFormula: configRow.filterFormula,
    })
    const records = filterRecordsByCursor(allRecords, cursor)

    if (records.length === 0) {
      const preview: FeishuBitableSyncPreviewResult = {
        recordCount: 0,
        parsedRowCount: 0,
        okCount: 0,
        warningCount: 0,
        errorCount: 0,
        parseError: null,
        sampleErrors: [],
        missingRequiredHeaders: [],
      }
      await db
        .update(feishuIntegrationJobRun)
        .set({
          status: 'success',
          finishedAt: new Date(),
          responseSummary: { preview, message: '无增量记录' },
        })
        .where(eq(feishuIntegrationJobRun.id, jobRunId))
      await db
        .update(feishuBitableSyncConfig)
        .set({ lastSuccessAt: new Date() })
        .where(eq(feishuBitableSyncConfig.id, configRow.id))
      return { jobRunId, status: 'success', message: '无增量记录', preview }
    }

    const parsedResult = await parseBitableRows({
      syncKind: configRow.syncKind as FeishuBitableSyncKind,
      fieldMapping,
      records,
      bitableFields,
    })

    if (!parsedResult.ok) {
      await db
        .update(feishuIntegrationJobRun)
        .set({
          status: 'failed',
          finishedAt: new Date(),
          responseSummary: { preview: parsedResult.preview },
          errorMessage:
            parsedResult.preview.parseError ??
            (parsedResult.preview.missingRequiredHeaders.length
              ? `缺少必需列映射：${parsedResult.preview.missingRequiredHeaders.join('、')}`
              : '解析失败'),
        })
        .where(eq(feishuIntegrationJobRun.id, jobRunId))
      return { jobRunId, status: 'failed', preview: parsedResult.preview }
    }

    const { preview, rows } = parsedResult
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `feishu-bitable/${dc.code}/${configRow.syncKind}/${timestamp}`

    if (!configRow.autoCommit) {
      await db
        .update(feishuIntegrationJobRun)
        .set({
          status: 'success',
          finishedAt: new Date(),
          responseSummary: { preview, autoCommit: false },
        })
        .where(eq(feishuIntegrationJobRun.id, jobRunId))
      await db
        .update(feishuBitableSyncConfig)
        .set({ lastSuccessAt: new Date() })
        .where(eq(feishuBitableSyncConfig.id, configRow.id))
      supplierLog('feishu-bitable-sync', 'parsed only (auto_commit=false)', {
        configId: configRow.id,
        rows: preview.parsedRowCount,
      })
      return { jobRunId, status: 'success', preview, message: '已解析，未自动入库（auto_commit=false）' }
    }

    if (preview.errorCount > 0) {
      await db
        .update(feishuIntegrationJobRun)
        .set({
          status: 'failed',
          finishedAt: new Date(),
          responseSummary: { preview },
          errorMessage: `存在 ${preview.errorCount} 行解析错误，已阻断 commit`,
        })
        .where(eq(feishuIntegrationJobRun.id, jobRunId))
      return { jobRunId, status: 'failed', preview }
    }

    try {
      const commitResult =
        configRow.syncKind === 'device_inventory'
          ? await deviceImportDataAccess.commitInventory({
              supplierId: configRow.supplierId,
              dataCenterId: configRow.dataCenterId,
              fileName,
              rows: rows as DeviceInventoryParsedRow[],
              operatorName: '飞书多维表格同步',
            })
          : await deviceImportDataAccess.commitChangelog({
              supplierId: configRow.supplierId,
              dataCenterId: configRow.dataCenterId,
              fileName,
              rows: rows as DeviceChangelogParsedRow[],
              operatorName: '飞书多维表格同步',
            })

      await db
        .update(feishuIntegrationJobRun)
        .set({
          status: 'success',
          finishedAt: new Date(),
          responseSummary: {
            preview,
            commit: {
              batchId: commitResult.batchId,
              batchCode: commitResult.batchCode,
              committedCount: commitResult.committedCount,
            },
          },
        })
        .where(eq(feishuIntegrationJobRun.id, jobRunId))

      await db
        .update(feishuBitableSyncConfig)
        .set({
          lastSuccessAt: new Date(),
          cursorJson: computeNextCursor(records),
        })
        .where(eq(feishuBitableSyncConfig.id, configRow.id))

      supplierLog('feishu-bitable-sync', 'commit success', {
        configId: configRow.id,
        batchId: commitResult.batchId,
        committedCount: commitResult.committedCount,
      })

      return {
        jobRunId,
        status: 'success',
        preview,
        commit: {
          batchId: commitResult.batchId,
          batchCode: commitResult.batchCode,
          committedCount: commitResult.committedCount,
        },
      }
    } catch (commitError) {
      const message = commitError instanceof Error ? commitError.message : 'commit 失败'
      supplierError('feishu-bitable-sync', 'commit failed', commitError, {
        configId: configRow.id,
      })
      await db
        .update(feishuIntegrationJobRun)
        .set({
          status: 'failed',
          finishedAt: new Date(),
          responseSummary: { preview },
          errorMessage: message,
        })
        .where(eq(feishuIntegrationJobRun.id, jobRunId))
      return { jobRunId, status: 'failed', preview, message }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '同步失败'
    supplierError('feishu-bitable-sync', 'run failed', error, { configId: configRow.id })
    await db
      .update(feishuIntegrationJobRun)
      .set({
        status: 'failed',
        finishedAt: new Date(),
        errorMessage: message,
      })
      .where(eq(feishuIntegrationJobRun.id, jobRunId))
    return { jobRunId, status: 'failed', message }
  } finally {
    await releaseLock(lockKey)
  }
}

export async function runAllEnabledFeishuBitableSyncs(input: {
  trigger: 'scheduled' | 'manual'
}): Promise<{ runs: FeishuBitableSyncRunResult[] }> {
  const configs = await db.query.feishuBitableSyncConfig.findMany({
    where: eq(feishuBitableSyncConfig.enabled, true),
  })

  const runs: FeishuBitableSyncRunResult[] = []
  for (const config of configs) {
    try {
      const result = await runFeishuBitableSync({
        configId: config.id,
        trigger: input.trigger,
      })
      runs.push(result)
    } catch (error) {
      supplierWarn('feishu-bitable-sync', 'config run failed', {
        configId: config.id,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return { runs }
}

export async function previewFeishuBitableSync(configId: string): Promise<FeishuBitableSyncPreviewResult> {
  const configRow = await db.query.feishuBitableSyncConfig.findFirst({
    where: eq(feishuBitableSyncConfig.id, configId),
  })
  if (!configRow) throw new Error('同步配置不存在')

  const runtimeConfig = loadFeishuRuntimeConfig()
  if (!runtimeConfig?.enabled) throw new Error('飞书集成未配置或未启用')

  const fieldMapping = parseFieldMapping(configRow.fieldMappingJson)
  const bitableFields = await listFeishuBitableFields(
    runtimeConfig,
    configRow.appToken,
    configRow.tableId,
  )
  const allRecords = await listFeishuBitableRecords({
    config: runtimeConfig,
    appToken: configRow.appToken,
    tableId: configRow.tableId,
    viewId: configRow.viewId,
    filterFormula: configRow.filterFormula,
  })
  const cursor = parseCursor(configRow.cursorJson)
  const records = filterRecordsByCursor(allRecords, cursor)

  const parsedResult = await parseBitableRows({
    syncKind: configRow.syncKind as FeishuBitableSyncKind,
    fieldMapping,
    records,
    bitableFields,
  })
  return parsedResult.preview
}
