import 'server-only'

import { db } from '@/lib/db'
import { autoMatchWorkOrderFields } from '@/lib/server/integrations/feishu/work-order-bitable-mapper'
import { listFeishuBitableFields } from '@/lib/server/integrations/feishu/bitable-client'
import { loadFeishuRuntimeConfig } from '@/lib/server/integrations/feishu/config'
import {
  DEFAULT_FEISHU_WORK_ORDER_DEFAULTS,
  DEFAULT_FEISHU_WORK_ORDER_INBOUND_POLICY,
  DEFAULT_FEISHU_WORK_ORDER_STATUS_MAPPING,
  FEISHU_WORK_ORDER_BITABLE_COLUMN_SUGGESTIONS,
  type FeishuWorkOrderBitableConfigDto,
  type FeishuWorkOrderDefaults,
  type FeishuWorkOrderFieldKey,
  type FeishuWorkOrderFieldMapping,
  type FeishuWorkOrderInboundChannel,
  type FeishuWorkOrderInboundPolicy,
  type FeishuWorkOrderStatusMapping,
  type FeishuWorkOrderBackend,
} from '@/lib/types/feishu-work-order'
import { feishuWorkOrderBitableConfig } from '@workspace/db/schema'
import { eq } from 'drizzle-orm'

const CONFIG_ID = 'default'

function parseMapping(raw: unknown): FeishuWorkOrderFieldMapping {
  if (!raw || typeof raw !== 'object') return {}
  const out: FeishuWorkOrderFieldMapping = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string' && v.trim()) {
      out[k as FeishuWorkOrderFieldKey] = v.trim()
    }
  }
  return out
}

function parseDefaults(raw: unknown): FeishuWorkOrderDefaults {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_FEISHU_WORK_ORDER_DEFAULTS }
  const obj = raw as Record<string, unknown>
  return {
    ...DEFAULT_FEISHU_WORK_ORDER_DEFAULTS,
    module: typeof obj.module === 'string' ? obj.module : DEFAULT_FEISHU_WORK_ORDER_DEFAULTS.module,
    priority:
      typeof obj.priority === 'string' ? obj.priority : DEFAULT_FEISHU_WORK_ORDER_DEFAULTS.priority,
    category:
      typeof obj.category === 'string' ? obj.category : DEFAULT_FEISHU_WORK_ORDER_DEFAULTS.category,
    initial_status:
      typeof obj.initial_status === 'string'
        ? obj.initial_status
        : DEFAULT_FEISHU_WORK_ORDER_DEFAULTS.initial_status,
    assignee_open_ids: Array.isArray(obj.assignee_open_ids)
      ? obj.assignee_open_ids.filter((x): x is string => typeof x === 'string')
      : DEFAULT_FEISHU_WORK_ORDER_DEFAULTS.assignee_open_ids,
  }
}

function parseStatusMapping(raw: unknown): FeishuWorkOrderStatusMapping {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_FEISHU_WORK_ORDER_STATUS_MAPPING }
  return { ...DEFAULT_FEISHU_WORK_ORDER_STATUS_MAPPING, ...(raw as FeishuWorkOrderStatusMapping) }
}

function parseInboundPolicy(raw: unknown): FeishuWorkOrderInboundPolicy {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_FEISHU_WORK_ORDER_INBOUND_POLICY }
  return { ...DEFAULT_FEISHU_WORK_ORDER_INBOUND_POLICY, ...(raw as FeishuWorkOrderInboundPolicy) }
}

function parseInboundChannel(raw: unknown): FeishuWorkOrderInboundChannel {
  if (raw === 'event_subscription' || raw === 'bitable_automation' || raw === 'dual') {
    return raw
  }
  return 'bitable_automation'
}

function mapRow(row: typeof feishuWorkOrderBitableConfig.$inferSelect): FeishuWorkOrderBitableConfigDto {
  return {
    id: row.id,
    appToken: row.appToken,
    tableId: row.tableId,
    viewId: row.viewId,
    workOrderBackend: row.workOrderBackend as FeishuWorkOrderBackend,
    fieldMappingJson: parseMapping(row.fieldMappingJson),
    defaultsJson: parseDefaults(row.defaultsJson),
    statusMappingJson: parseStatusMapping(row.statusMappingJson),
    inboundChannel: parseInboundChannel(row.inboundChannel),
    automationWebhookSecret: row.automationWebhookSecret?.trim() || null,
    automationToken: row.automationToken?.trim() || null,
    inboundPolicyJson: parseInboundPolicy(row.inboundPolicyJson),
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function suggestFieldKey(fieldName: string): FeishuWorkOrderFieldKey | null {
  return FEISHU_WORK_ORDER_BITABLE_COLUMN_SUGGESTIONS[fieldName.trim()] ?? null
}

export const feishuWorkOrderConfigDataAccess = {
  async getConfig(): Promise<FeishuWorkOrderBitableConfigDto | null> {
    const [row] = await db
      .select()
      .from(feishuWorkOrderBitableConfig)
      .where(eq(feishuWorkOrderBitableConfig.id, CONFIG_ID))
      .limit(1)
    return row ? mapRow(row) : null
  },

  async upsertConfig(input: {
    appToken: string
    tableId: string
    viewId?: string | null
    workOrderBackend?: FeishuWorkOrderBackend
    fieldMappingJson: FeishuWorkOrderFieldMapping
    defaultsJson: FeishuWorkOrderDefaults
    statusMappingJson?: FeishuWorkOrderStatusMapping
    inboundChannel?: FeishuWorkOrderInboundChannel
    automationWebhookSecret?: string | null
    automationToken?: string | null
    inboundPolicyJson?: FeishuWorkOrderInboundPolicy
    enabled?: boolean
  }): Promise<FeishuWorkOrderBitableConfigDto> {
    const now = new Date()
    const payload = {
      appToken: input.appToken.trim(),
      tableId: input.tableId.trim(),
      viewId: input.viewId?.trim() || null,
      workOrderBackend: input.workOrderBackend ?? 'bitable',
      fieldMappingJson: input.fieldMappingJson,
      defaultsJson: input.defaultsJson,
      statusMappingJson: input.statusMappingJson ?? DEFAULT_FEISHU_WORK_ORDER_STATUS_MAPPING,
      inboundChannel: input.inboundChannel ?? 'bitable_automation',
      automationWebhookSecret: input.automationWebhookSecret?.trim() || null,
      automationToken: input.automationToken?.trim() || null,
      inboundPolicyJson: input.inboundPolicyJson ?? DEFAULT_FEISHU_WORK_ORDER_INBOUND_POLICY,
      enabled: input.enabled ?? true,
      updatedAt: now,
    }

    const existing = await this.getConfig()
    if (existing) {
      await db
        .update(feishuWorkOrderBitableConfig)
        .set(payload)
        .where(eq(feishuWorkOrderBitableConfig.id, CONFIG_ID))
    } else {
      await db.insert(feishuWorkOrderBitableConfig).values({
        id: CONFIG_ID,
        ...payload,
        createdAt: now,
      })
    }

    const saved = await this.getConfig()
    if (!saved) throw new Error('保存工单配置失败')
    return saved
  },

  async listTableFields(input: { appToken: string; tableId: string }) {
    const runtime = loadFeishuRuntimeConfig()
    if (!runtime?.enabled) {
      throw new Error('飞书集成未配置')
    }
    const fields = await listFeishuBitableFields(runtime, input.appToken, input.tableId)
    const suggestedMapping = autoMatchWorkOrderFields(
      fields.map((f) => ({ fieldId: f.field_id, fieldName: f.field_name })),
    )
    return {
      fields: fields.map((f) => ({
        fieldId: f.field_id,
        fieldName: f.field_name,
        uiType: f.ui_type ?? String(f.type),
        suggestedFieldKey: suggestFieldKey(f.field_name),
      })),
      suggestedMapping,
    }
  },
}
