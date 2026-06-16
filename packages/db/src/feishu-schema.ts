/**
 * 飞书集成表结构
 * @see apps/web/content/design/feishu-integration-design.md §4
 */

import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core"

const feishuTimestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}

/** 租户级飞书集成配置（单行或按环境） */
export const feishuIntegrationConfig = pgTable("feishu_integration_config", {
  id: text("id").primaryKey(),
  appId: varchar("app_id", { length: 64 }).notNull(),
  appSecretEnc: text("app_secret_enc").notNull(),
  encryptKey: varchar("encrypt_key", { length: 255 }),
  verificationToken: varchar("verification_token", { length: 255 }),
  webhookSecret: varchar("webhook_secret", { length: 128 }),
  defaultApprovalCodes: jsonb("default_approval_codes").notNull().default({}),
  webhookPolicyJson: jsonb("webhook_policy_json")
    .notNull()
    .default({ auto_complete_on_approval: true, auto_create_enabled: true }),
  enabled: boolean("enabled").notNull().default(true),
  ...feishuTimestamps,
})

/** CRM ↔ 飞书实体关联 */
export const feishuExternalLink = pgTable(
  "feishu_external_link",
  {
    id: text("id").primaryKey(),
    domain: varchar("domain", { length: 64 }).notNull(),
    refId: text("ref_id").notNull(),
    externalType: varchar("external_type", { length: 64 }).notNull(),
    externalId: varchar("external_id", { length: 128 }).notNull(),
    externalCode: varchar("external_code", { length: 128 }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("feishu_external_link_domain_ref_type_uk").on(
      table.domain,
      table.refId,
      table.externalType,
    ),
    uniqueIndex("feishu_external_link_type_id_uk").on(table.externalType, table.externalId),
    index("feishu_external_link_ref_idx").on(table.domain, table.refId),
  ],
)

/** 集成任务日志 */
export const feishuIntegrationJobRun = pgTable(
  "feishu_integration_job_run",
  {
    id: text("id").primaryKey(),
    jobKind: varchar("job_kind", { length: 32 }).notNull(),
    status: varchar("status", { length: 16 }).notNull(),
    supplierId: text("supplier_id"),
    refDomain: varchar("ref_domain", { length: 64 }),
    refId: text("ref_id"),
    requestSummary: jsonb("request_summary"),
    responseSummary: jsonb("response_summary"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [
    index("feishu_integration_job_run_kind_started_idx").on(table.jobKind, table.startedAt),
    index("feishu_integration_job_run_ref_idx").on(table.refDomain, table.refId),
  ],
)

/** 飞书多维表格同步配置（按供应商 + 机房 + sync_kind） */
export const feishuBitableSyncConfig = pgTable(
  "feishu_bitable_sync_config",
  {
    id: text("id").primaryKey(),
    supplierId: text("supplier_id").notNull(),
    dataCenterId: text("data_center_id").notNull(),
    syncKind: varchar("sync_kind", { length: 32 }).notNull(),
    appToken: varchar("app_token", { length: 128 }).notNull(),
    tableId: varchar("table_id", { length: 128 }).notNull(),
    viewId: varchar("view_id", { length: 128 }),
    fieldMappingJson: jsonb("field_mapping_json").notNull().default({}),
    filterFormula: text("filter_formula"),
    cronExpr: varchar("cron_expr", { length: 64 }).notNull().default("15 * * * *"),
    autoCommit: boolean("auto_commit").notNull().default(false),
    cursorJson: jsonb("cursor_json").notNull().default({}),
    enabled: boolean("enabled").notNull().default(true),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    ...feishuTimestamps,
  },
  (table) => [
    uniqueIndex("feishu_bitable_sync_config_uk").on(
      table.supplierId,
      table.dataCenterId,
      table.syncKind,
    ),
    index("feishu_bitable_sync_config_dc_idx").on(table.dataCenterId),
    index("feishu_bitable_sync_config_enabled_idx").on(table.enabled),
  ],
)

/** Webhook 幂等去重 */
export const feishuWebhookEvent = pgTable(
  "feishu_webhook_event",
  {
    id: text("id").primaryKey(),
    idempotencyKey: varchar("idempotency_key", { length: 256 }).notNull(),
    instanceId: varchar("instance_id", { length: 128 }),
    eventType: varchar("event_type", { length: 64 }),
    processedAt: timestamp("processed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("feishu_webhook_event_idempotency_uk").on(table.idempotencyKey)],
)
