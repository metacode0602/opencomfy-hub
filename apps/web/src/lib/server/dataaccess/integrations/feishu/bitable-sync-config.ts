import 'server-only'

import { db } from '@/lib/db'
import {
  autoMatchFeishuBitableFields,
  getCanonicalHeadersForSyncKind,
  type FeishuBitableFieldMapping,
  type FeishuBitableSyncKind,
} from '@/lib/server/integrations/feishu/bitable-field-mapper'
import { listFeishuBitableFields } from '@/lib/server/integrations/feishu/bitable-client'
import { loadFeishuRuntimeConfig } from '@/lib/server/integrations/feishu/config'
import type {
  FeishuBitableFieldMatchSuggestion,
  FeishuBitableSyncConfigDto,
  FeishuBitableSyncJobRunDto,
} from '@/lib/types/feishu-bitable-sync'
import { dataCenter, feishuBitableSyncConfig, feishuIntegrationJobRun, supplier } from '@workspace/db/schema'
import { and, desc, eq, sql } from 'drizzle-orm'

function newId() {
  return crypto.randomUUID()
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

function mapConfigRow(
  row: typeof feishuBitableSyncConfig.$inferSelect,
  supplierName: string,
  dataCenterName: string,
  dataCenterCode: string,
): FeishuBitableSyncConfigDto {
  return {
    id: row.id,
    supplierId: row.supplierId,
    supplierName,
    dataCenterId: row.dataCenterId,
    dataCenterName,
    dataCenterCode,
    syncKind: row.syncKind as FeishuBitableSyncKind,
    appToken: row.appToken,
    tableId: row.tableId,
    viewId: row.viewId,
    fieldMappingJson: parseFieldMapping(row.fieldMappingJson),
    filterFormula: row.filterFormula,
    cronExpr: row.cronExpr,
    autoCommit: row.autoCommit,
    cursorJson: (row.cursorJson as FeishuBitableSyncConfigDto['cursorJson']) ?? {},
    enabled: row.enabled,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function loadConfigDto(configId: string): Promise<FeishuBitableSyncConfigDto | null> {
  const rows = await db
    .select({
      config: feishuBitableSyncConfig,
      supplierName: supplier.name,
      dataCenterName: dataCenter.name,
      dataCenterCode: dataCenter.code,
    })
    .from(feishuBitableSyncConfig)
    .innerJoin(supplier, eq(feishuBitableSyncConfig.supplierId, supplier.id))
    .innerJoin(dataCenter, eq(feishuBitableSyncConfig.dataCenterId, dataCenter.id))
    .where(eq(feishuBitableSyncConfig.id, configId))
    .limit(1)

  const row = rows[0]
  if (!row) return null
  return mapConfigRow(row.config, row.supplierName, row.dataCenterName, row.dataCenterCode)
}

export const feishuBitableSyncDataAccess = {
  async listConfigs(input?: {
    supplierId?: string
    dataCenterId?: string
  }): Promise<FeishuBitableSyncConfigDto[]> {
    const conditions = []
    if (input?.supplierId) {
      conditions.push(eq(feishuBitableSyncConfig.supplierId, input.supplierId))
    }
    if (input?.dataCenterId) {
      conditions.push(eq(feishuBitableSyncConfig.dataCenterId, input.dataCenterId))
    }

    const rows = await db
      .select({
        config: feishuBitableSyncConfig,
        supplierName: supplier.name,
        dataCenterName: dataCenter.name,
        dataCenterCode: dataCenter.code,
      })
      .from(feishuBitableSyncConfig)
      .innerJoin(supplier, eq(feishuBitableSyncConfig.supplierId, supplier.id))
      .innerJoin(dataCenter, eq(feishuBitableSyncConfig.dataCenterId, dataCenter.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(feishuBitableSyncConfig.updatedAt))

    return rows.map((row) =>
      mapConfigRow(row.config, row.supplierName, row.dataCenterName, row.dataCenterCode),
    )
  },

  async getConfig(configId: string): Promise<FeishuBitableSyncConfigDto | null> {
    return loadConfigDto(configId)
  },

  async upsertConfig(input: {
    id?: string
    supplierId: string
    dataCenterId: string
    syncKind: FeishuBitableSyncKind
    appToken: string
    tableId: string
    viewId?: string | null
    fieldMappingJson: FeishuBitableFieldMapping
    filterFormula?: string | null
    cronExpr?: string
    autoCommit?: boolean
    enabled?: boolean
  }): Promise<FeishuBitableSyncConfigDto> {
    const [dc] = await db
      .select({ id: dataCenter.id })
      .from(dataCenter)
      .where(
        and(eq(dataCenter.id, input.dataCenterId), eq(dataCenter.supplierId, input.supplierId)),
      )
      .limit(1)
    if (!dc) throw new Error('机房不存在或不属于该供应商')

    const id = input.id ?? newId()
    const existing = input.id
      ? await db.query.feishuBitableSyncConfig.findFirst({
          where: eq(feishuBitableSyncConfig.id, input.id),
        })
      : null

    const values = {
      supplierId: input.supplierId,
      dataCenterId: input.dataCenterId,
      syncKind: input.syncKind,
      appToken: input.appToken.trim(),
      tableId: input.tableId.trim(),
      viewId: input.viewId?.trim() || null,
      fieldMappingJson: input.fieldMappingJson,
      filterFormula: input.filterFormula?.trim() || null,
      cronExpr: input.cronExpr?.trim() || '15 * * * *',
      autoCommit: input.autoCommit ?? false,
      enabled: input.enabled ?? true,
    }

    if (existing) {
      await db
        .update(feishuBitableSyncConfig)
        .set(values)
        .where(eq(feishuBitableSyncConfig.id, id))
    } else {
      await db.insert(feishuBitableSyncConfig).values({ id, ...values })
    }

    const dto = await loadConfigDto(id)
    if (!dto) throw new Error('保存后读取配置失败')
    return dto
  },

  async deleteConfig(configId: string): Promise<void> {
    await db.delete(feishuBitableSyncConfig).where(eq(feishuBitableSyncConfig.id, configId))
  },

  async listBitableTableFields(input: {
    appToken: string
    tableId: string
    syncKind: FeishuBitableSyncKind
  }): Promise<{
    fields: FeishuBitableFieldMatchSuggestion[]
    suggestedMapping: FeishuBitableFieldMapping
    excelHeaders: string[]
  }> {
    const runtimeConfig = loadFeishuRuntimeConfig()
    if (!runtimeConfig?.enabled) throw new Error('飞书集成未配置或未启用')

    const bitableFields = await listFeishuBitableFields(
      runtimeConfig,
      input.appToken.trim(),
      input.tableId.trim(),
    )
    const suggestedMapping = autoMatchFeishuBitableFields(bitableFields, input.syncKind)
    const excelHeaders = getCanonicalHeadersForSyncKind(input.syncKind)

    const reverseSuggested = new Map<string, string>()
    for (const [excelHeader, fieldId] of Object.entries(suggestedMapping)) {
      reverseSuggested.set(fieldId, excelHeader)
    }

    const fields: FeishuBitableFieldMatchSuggestion[] = bitableFields.map((field) => ({
      fieldId: field.field_id,
      fieldName: field.field_name,
      type: field.type,
      suggestedExcelHeader: reverseSuggested.get(field.field_id) ?? null,
    }))

    return { fields, suggestedMapping, excelHeaders }
  },

  async listJobRuns(input?: {
    configId?: string
    limit?: number
    offset?: number
  }): Promise<{ items: FeishuBitableSyncJobRunDto[]; total: number }> {
    const limit = input?.limit ?? 20
    const offset = input?.offset ?? 0
    const conditions = [eq(feishuIntegrationJobRun.jobKind, 'bitable_sync')]
    if (input?.configId) {
      conditions.push(eq(feishuIntegrationJobRun.refId, input.configId))
    }

    const [countRow] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(feishuIntegrationJobRun)
      .where(and(...conditions))

    const rows = await db
      .select()
      .from(feishuIntegrationJobRun)
      .where(and(...conditions))
      .orderBy(desc(feishuIntegrationJobRun.startedAt))
      .limit(limit)
      .offset(offset)

    return {
      total: Number(countRow?.value ?? 0),
      items: rows.map(
        (row): FeishuBitableSyncJobRunDto => ({
          id: row.id,
          status: row.status,
          supplierId: row.supplierId,
          refId: row.refId,
          requestSummary: (row.requestSummary as Record<string, unknown> | null) ?? null,
          responseSummary: (row.responseSummary as Record<string, unknown> | null) ?? null,
          errorMessage: row.errorMessage,
          startedAt: row.startedAt.toISOString(),
          finishedAt: row.finishedAt?.toISOString() ?? null,
        }),
      ),
    }
  },
}
