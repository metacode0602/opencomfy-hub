/**
 * 全局运营监控大盘 — 时间段分析域表结构（Drizzle ORM / PostgreSQL）
 *
 * 设计依据：
 * - apps/web/content/design/global-dashboard-period-analytics.md（v2.1）
 * - apps/web/content/design/global-dashboard-implementation-plan.md（Snapshot 口径对齐 overview）
 *
 * 分层：
 * - DWD 明细：设备/池事件与快照（由 supplier_device_change_log、resource_pool_binding 清洗）
 * - DWS 汇总：KPI / 生命周期 / 资源池 日桶与小时桶（支撑 getPeriod + sparkline）
 *
 * 计量约定（§3.4）：
 * - Snapshot API 可读 supplier_device 当前态或最近 hour 快照；本 schema 快照表供 Period 回放
 * - machine_hours：按台累计在线时长，不乘 gpu_count
 * - card_hours：在线时长 × gpu_count（供应侧 GPU·小时，非财务消费卡时）
 * - pool_code 与 resolveDevicePoolMemberships / overview 一致；双池设备可重叠计入多池
 *
 * 约定：
 * - 主键 text；计数 integer；时长/卡时 numeric(15,4)；时间桶 timestamptz / date（业务时区 Asia/Shanghai）
 * - pool_codes、filters 等扩展 jsonb
 */

import { relations } from "drizzle-orm"
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core"

import {
  dataCenter,
  gpuCardType,
  onboardingBatch,
  resourcePoolBinding,
  supplier,
  supplierDevice,
  supplierDeviceChangeLog,
} from "./supply-schema"

/** 时长 / 台时 / 卡时 decimal(15,4) */
const durationHours = (name: string) => numeric(name, { precision: 15, scale: 4 })

/** 平均停留等秒数 decimal(15,2) */
const durationSeconds = (name: string) => numeric(name, { precision: 15, scale: 2 })

const dashboardTimestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}

/**
 * 大盘资源池 code（六池）
 *
 * 写入 `pool_binding_history.pool_code`、`resource_pool_* .pool_code`、
 * `device_*_snapshot.pool_codes[]` 等字段；与 overview `resolveDevicePoolMemberships` 一致。
 *
 * | code | 大盘展示 | 前端 Mock key | 说明 |
 * |------|----------|---------------|------|
 * | elastic_service | 弹性服务 | platform | 闲时弹性调度主力池；Snapshot 饼图按期末在线 GPU 卡数 |
 * | bare_metal | 裸金属 | dedicated | 裸金属/独占池；可与 elastic_service 双池重叠 |
 * | pending_shelving | 待上架 | inference | 待接入/待上架设备聚合（非 IDC 部署链 pending_shelving） |
 * | offline_delivery | 线下交付 | training | 线下裸金属交付 ops 池 |
 * | internal_standby | 内部占用 | standby | 内部测试、hold 等占用池 |
 * | maintenance | 维护中 | maintenance | Snapshot 计卡数；Period 台时/卡时展示 —（§3.4.5） |
 */
export const DASHBOARD_POOL_CODES = [
  "elastic_service",
  "bare_metal",
  "pending_shelving",
  "offline_delivery",
  "internal_standby",
  "maintenance",
] as const

export type DashboardPoolCode = (typeof DASHBOARD_POOL_CODES)[number]

/** 资源池 code → 中文名 / Mock key / 口径说明 */
export const DASHBOARD_POOL_CODE_META: Record<
  DashboardPoolCode,
  { label: string; mockKey: string; description: string }
> = {
  elastic_service: {
    label: "弹性服务",
    mockKey: "platform",
    description: "闲时弹性调度主力资源池；Period 主值为区间累计卡时",
  },
  bare_metal: {
    label: "裸金属",
    mockKey: "dedicated",
    description: "裸金属/网关代理池；允许与弹性池双池重叠计入",
  },
  pending_shelving: {
    label: "待上架",
    mockKey: "inference",
    description: "待接入/待上架聚合；CRM 域对应 lifecycle_status=待接入",
  },
  offline_delivery: {
    label: "线下交付",
    mockKey: "training",
    description: "线下裸金属交付中的设备归属池",
  },
  internal_standby: {
    label: "内部占用",
    mockKey: "standby",
    description: "内部测试、internal_test_hold 等占用资源",
  },
  maintenance: {
    label: "维护中",
    mockKey: "maintenance",
    description: "维护中设备；Snapshot 计 GPU 卡数，Period 不计供应台时/卡时",
  },
}

/**
 * 全局 KPI 指标 key（8 项）
 *
 * 写入 `global_kpi_daily.metric_key` / `global_kpi_hourly.metric_key`；
 * 与前端 `GlobalKpiSection` 卡片一一对应，口径对齐 `/supplier/overview`。
 *
 * | metric_key | 大盘标题 | 单位 | Snapshot | Period |
 * |------------|----------|------|----------|--------|
 * | gpu_total | GPU 总卡数 | 卡 | L1 库存 GPU 总和 | 期末存量 + 净增 |
 * | device_online | 在线设备 | 台/卡 | lifecycle_status=在线 | 期末在线 |
 * | pool_elastic | 弹性资源池 | 卡 | memberships 含 elastic_service | 期末 + 划入/划出 |
 * | pool_bare_metal | 裸金属池 | 卡 | memberships 含 bare_metal | 期末 + 划入/划出 |
 * | internal_test | 内部占用 | 卡 | 测试标记 + internal_test_hold | 期末占用 |
 * | device_abnormal | 异常设备 | 台 | 未关闭 fault_incident 去重 | 期内暴露数 |
 * | device_pending_access | 待接入设备 | 台/卡 | 实体 lifecycle=待接入 + 进行中批次计划缺口（§2.1 supplier-overview-scenarios） | 期末实体积压 + 本期进入（**不含**计划缺口） |
 * | idc_pending_access | 待接入机房 | 个 | 实体待接入机房 ∪ new_idc 进行中批次机房（严格 online_reason） | 期末实体待接入机房数（**不含**计划） |
 */
export const DASHBOARD_KPI_METRIC_KEYS = [
  "gpu_total",
  "device_online",
  "pool_elastic",
  "pool_bare_metal",
  "internal_test",
  "device_abnormal",
  "device_pending_access",
  "idc_pending_access",
] as const

export type DashboardKpiMetricKey = (typeof DASHBOARD_KPI_METRIC_KEYS)[number]

/** KPI metric_key → 中文标题 / 默认单位 / 口径说明 */
export const DASHBOARD_KPI_METRIC_META: Record<
  DashboardKpiMetricKey,
  { label: string; unit: string; description: string }
> = {
  gpu_total: {
    label: "GPU 总卡数",
    unit: "卡",
    description: "SUM(supplier_gpu_inventory.quantity)；Snapshot 为 as_of 截面",
  },
  device_online: {
    label: "在线设备",
    unit: "台",
    description: "lifecycle_status=在线 且 ops 不排除在线（R-OV2）",
  },
  pool_elastic: {
    label: "弹性资源池",
    unit: "卡",
    description: "resolveDevicePoolMemberships 含 elastic_service 的 GPU 汇总",
  },
  pool_bare_metal: {
    label: "裸金属池",
    unit: "卡",
    description: "memberships 含 bare_metal；可与弹性池重叠，KPI 层不去重",
  },
  internal_test: {
    label: "内部占用",
    unit: "卡",
    description: "L1 测试标记 + internal_test_hold 叠加占用",
  },
  device_abnormal: {
    label: "异常设备",
    unit: "台",
    description: "关联未关闭 fault_incident 的设备去重台数",
  },
  device_pending_access: {
    label: "待接入设备",
    unit: "台",
    description:
      "Snapshot：COUNT(lifecycle=待接入) + SUM(max(0, planned_device_count−touched))；GPU 含 planned_gpu_count 缺口。Period 暂不叠加计划。",
  },
  idc_pending_access: {
    label: "待接入机房",
    unit: "个",
    description:
      "DISTINCT data_center：有机房实体待接入设备，或进行中 online 批次且 online_reason=new_idc。Period 暂不叠加计划。",
  },
}

/**
 * CRM 生命周期阶段 code（五段漏斗）
 *
 * 写入 `lifecycle_stage_daily.stage_code` / `lifecycle_stage_hourly.stage_code`；
 * 与前端 `LifecycleFlowCard`、`supplier.overview.getStats.lifecycleFunnel` 一致
 * （非 IDC 九段部署链路）。
 *
 * | stage_code | 中文阶段 | lifecycle_status | Snapshot 副指标 | Period 副指标 |
 * |------------|----------|------------------|-----------------|---------------|
 * | pending_access | 待接入 | 待接入 | 实体 + 计划缺口（Snapshot） | 本期吞吐（仅实体）+ 期末 |
 * | onboarding | 接入中 | 接入中 | 平均停留 | 本期吞吐 + 期末 |
 * | online | 在线 | 在线 | 平均停留 | 本期吞吐 + 期末 |
 * | maintenance | 维护中 | 维护中 / in_maintenance | 平均停留 | 本期吞吐 + 期末 |
 * | decommissioning | 下线中 | 下线中 | 平均停留 | 本期吞吐 + 期末 |
 */
export const DASHBOARD_LIFECYCLE_STAGE_CODES = [
  "pending_access",
  "onboarding",
  "online",
  "maintenance",
  "decommissioning",
] as const

export type DashboardLifecycleStageCode = (typeof DASHBOARD_LIFECYCLE_STAGE_CODES)[number]

/** 生命周期 stage_code → 中文名 / 对应 CRM 状态 / 指标说明 */
export const DASHBOARD_LIFECYCLE_STAGE_META: Record<
  DashboardLifecycleStageCode,
  { label: string; lifecycleStatus: string; description: string }
> = {
  pending_access: {
    label: "待接入",
    lifecycleStatus: "待接入",
    description: "已建接入批次、尚未设备接收；throughput=期内首次进入该阶段设备数",
  },
  onboarding: {
    label: "接入中",
    lifecycleStatus: "接入中",
    description: "接入流程进行中；wip_end=期末仍停在该阶段的数量",
  },
  online: {
    label: "在线",
    lifecycleStatus: "在线",
    description: "已上线可运营；avg_dwell_seconds=离开该阶段的停留均值",
  },
  maintenance: {
    label: "维护中",
    lifecycleStatus: "维护中",
    description: "含 in_maintenance=true 的设备；与 ops 维护态一致",
  },
  decommissioning: {
    label: "下线中",
    lifecycleStatus: "下线中",
    description: "下线流程中；warn 条件通常为 wip_end>0 且停留过长",
  },
}

/** device_lifecycle_event.event_kind — 方案 A ETL 分类 */
export const DEVICE_LIFECYCLE_EVENT_KINDS = ["state_transition", "batch_boundary"] as const

export type DeviceLifecycleEventKind = (typeof DEVICE_LIFECYCLE_EVENT_KINDS)[number]

/**
 * 批次边界 change_action（仅更新 batch_status，不直接改 lifecycle）
 * 见 global-dashboard-period-analytics.md §2.5、supplier-device-management-ops-panorama.md §7.3
 */
export const DASHBOARD_BATCH_BOUNDARY_CHANGE_ACTIONS = [
  "开始执行工单",
  "工单执行结束",
] as const

export type DashboardBatchBoundaryChangeAction =
  (typeof DASHBOARD_BATCH_BOUNDARY_CHANGE_ACTIONS)[number]

// ---------------------------------------------------------------------------
// DWD — 事件与快照
// ---------------------------------------------------------------------------

/**
 * 设备生命周期变更事件（由 supplier_device_change_log / entity_state_transition_log 清洗）
 * 用于区间内 stage_throughput、avg_dwell_time 回放。
 * event_kind=batch_boundary 的行不参与 lifecycle 聚合（§2.5 方案 A）。
 */
export const deviceLifecycleEvent = pgTable(
  "device_lifecycle_event",
  {
    id: text("id").primaryKey(),
    /** state_transition | batch_boundary */
    eventKind: varchar("event_kind", { length: 32 }).notNull().default("state_transition"),
    supplierDeviceId: text("supplier_device_id")
      .notNull()
      .references(() => supplierDevice.id, { onDelete: "cascade" }),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => supplier.id, { onDelete: "restrict" }),
    dataCenterId: text("data_center_id").references(() => dataCenter.id, {
      onDelete: "set null",
    }),
    gpuCardTypeId: text("gpu_card_type_id")
      .notNull()
      .references(() => gpuCardType.id, { onDelete: "restrict" }),
    gpuCount: integer("gpu_count").notNull(),
    fromLifecycleStatus: varchar("from_lifecycle_status", { length: 32 }).notNull(),
    toLifecycleStatus: varchar("to_lifecycle_status", { length: 32 }).notNull(),
    fromOpsStatus: varchar("from_ops_status", { length: 64 }),
    toOpsStatus: varchar("to_ops_status", { length: 64 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    sourceChangeLogId: text("source_change_log_id").references(() => supplierDeviceChangeLog.id, {
      onDelete: "set null",
    }),
    businessOnboardingBatchId: text("business_onboarding_batch_id").references(
      () => onboardingBatch.id,
      { onDelete: "set null" },
    ),
    /** 冗余追溯：entity_state_transition_log.id */
    sourceTransitionLogId: text("source_transition_log_id"),
    payload: jsonb("payload"),
    ...dashboardTimestamps,
  },
  (table) => [
    index("device_lifecycle_event_device_occurred_idx").on(
      table.supplierDeviceId,
      table.occurredAt,
    ),
    index("device_lifecycle_event_occurred_idx").on(table.occurredAt),
    index("device_lifecycle_event_to_status_idx").on(table.toLifecycleStatus, table.occurredAt),
    index("device_lifecycle_event_supplier_id_idx").on(table.supplierId),
    index("device_lifecycle_event_data_center_id_idx").on(table.dataCenterId),
    index("device_lifecycle_event_event_kind_idx").on(table.eventKind, table.occurredAt),
    index("device_lifecycle_event_business_batch_id_idx").on(table.businessOnboardingBatchId),
  ],
)

/**
 * 设备池归属历史（SCD Type 2）
 * 支撑池净增、台时/卡时按池回放；effective_to IS NULL 表示当前有效。
 */
export const poolBindingHistory = pgTable(
  "pool_binding_history",
  {
    id: text("id").primaryKey(),
    supplierDeviceId: text("supplier_device_id")
      .notNull()
      .references(() => supplierDevice.id, { onDelete: "cascade" }),
    poolCode: varchar("pool_code", { length: 64 }).notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    sourceBindingId: text("source_binding_id").references(() => resourcePoolBinding.id, {
      onDelete: "set null",
    }),
    /** 划入/划出/重绑等业务原因 */
    changeReason: varchar("change_reason", { length: 64 }),
    payload: jsonb("payload"),
    ...dashboardTimestamps,
  },
  (table) => [
    index("pool_binding_history_device_pool_from_idx").on(
      table.supplierDeviceId,
      table.poolCode,
      table.effectiveFrom,
    ),
    index("pool_binding_history_pool_effective_idx").on(
      table.poolCode,
      table.effectiveFrom,
      table.effectiveTo,
    ),
    index("pool_binding_history_effective_from_idx").on(table.effectiveFrom),
  ],
)

/**
 * 设备日快照（自然日桶，Asia/Shanghai 日界）
 * 一行 = 某自然日结束截面 + 该日在线时长（供日粒度台时/卡时聚合）。
 */
export const deviceDailySnapshot = pgTable(
  "device_daily_snapshot",
  {
    id: text("id").primaryKey(),
    snapshotDate: date("snapshot_date").notNull(),
    supplierDeviceId: text("supplier_device_id")
      .notNull()
      .references(() => supplierDevice.id, { onDelete: "cascade" }),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => supplier.id, { onDelete: "restrict" }),
    dataCenterId: text("data_center_id").references(() => dataCenter.id, {
      onDelete: "set null",
    }),
    gpuCardTypeId: text("gpu_card_type_id")
      .notNull()
      .references(() => gpuCardType.id, { onDelete: "restrict" }),
    gpuCount: integer("gpu_count").notNull(),
    lifecycleStatus: varchar("lifecycle_status", { length: 32 }).notNull(),
    opsStatus: varchar("ops_status", { length: 64 }).notNull(),
    inMaintenance: boolean("in_maintenance").notNull().default(false),
    /** 日末是否满足在线判定（§3.4.5） */
    isOnlineAtEnd: boolean("is_online_at_end").notNull().default(false),
    /** 该自然日内在线时长，0~24，用于 machine_hours / card_hours 聚合 */
    onlineHours: durationHours("online_hours").notNull().default("0"),
    /** 日末池归属；双池设备可含多个 pool_code */
    poolCodes: jsonb("pool_codes").$type<string[]>().notNull().default([]),
    idcCode: varchar("idc_code", { length: 64 }),
    idcRegion: varchar("idc_region", { length: 64 }),
    cooperationType: varchar("cooperation_type", { length: 32 }),
    etlBatchId: text("etl_batch_id"),
    ...dashboardTimestamps,
  },
  (table) => [
    uniqueIndex("device_daily_snapshot_uk").on(table.snapshotDate, table.supplierDeviceId),
    index("device_daily_snapshot_date_idx").on(table.snapshotDate),
    index("device_daily_snapshot_device_date_idx").on(table.supplierDeviceId, table.snapshotDate),
    index("device_daily_snapshot_lifecycle_date_idx").on(
      table.lifecycleStatus,
      table.snapshotDate,
    ),
    index("device_daily_snapshot_gpu_card_type_date_idx").on(
      table.gpuCardTypeId,
      table.snapshotDate,
    ),
    index("device_daily_snapshot_data_center_date_idx").on(
      table.dataCenterId,
      table.snapshotDate,
    ),
  ],
)

/**
 * 设备小时快照（整点小时桶 [h:00, h+1:00)）
 * Snapshot API 可读最近一条 hour 快照作为 as_of 近似截面。
 */
export const deviceHourlySnapshot = pgTable(
  "device_hourly_snapshot",
  {
    id: text("id").primaryKey(),
    /** 桶起始时刻（整点，业务时区对齐后存 timestamptz） */
    snapshotHour: timestamp("snapshot_hour", { withTimezone: true }).notNull(),
    supplierDeviceId: text("supplier_device_id")
      .notNull()
      .references(() => supplierDevice.id, { onDelete: "cascade" }),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => supplier.id, { onDelete: "restrict" }),
    dataCenterId: text("data_center_id").references(() => dataCenter.id, {
      onDelete: "set null",
    }),
    gpuCardTypeId: text("gpu_card_type_id")
      .notNull()
      .references(() => gpuCardType.id, { onDelete: "restrict" }),
    gpuCount: integer("gpu_count").notNull(),
    lifecycleStatus: varchar("lifecycle_status", { length: 32 }).notNull(),
    opsStatus: varchar("ops_status", { length: 64 }).notNull(),
    inMaintenance: boolean("in_maintenance").notNull().default(false),
    isOnlineAtEnd: boolean("is_online_at_end").notNull().default(false),
    /** 该小时内在线时长，0~1 */
    onlineHours: durationHours("online_hours").notNull().default("0"),
    poolCodes: jsonb("pool_codes").$type<string[]>().notNull().default([]),
    idcCode: varchar("idc_code", { length: 64 }),
    idcRegion: varchar("idc_region", { length: 64 }),
    cooperationType: varchar("cooperation_type", { length: 32 }),
    etlBatchId: text("etl_batch_id"),
    ...dashboardTimestamps,
  },
  (table) => [
    uniqueIndex("device_hourly_snapshot_uk").on(table.snapshotHour, table.supplierDeviceId),
    index("device_hourly_snapshot_hour_idx").on(table.snapshotHour),
    index("device_hourly_snapshot_device_hour_idx").on(
      table.supplierDeviceId,
      table.snapshotHour,
    ),
    index("device_hourly_snapshot_lifecycle_hour_idx").on(
      table.lifecycleStatus,
      table.snapshotHour,
    ),
    index("device_hourly_snapshot_gpu_card_type_hour_idx").on(
      table.gpuCardTypeId,
      table.snapshotHour,
    ),
  ],
)

/**
 * 设备 × 池 × 日 明细（可选加速表）
 * 双池重叠时同一设备可有多行；供 resource_pool_daily 精确聚合台时/卡时。
 */
export const devicePoolDailySnapshot = pgTable(
  "device_pool_daily_snapshot",
  {
    id: text("id").primaryKey(),
    snapshotDate: date("snapshot_date").notNull(),
    supplierDeviceId: text("supplier_device_id")
      .notNull()
      .references(() => supplierDevice.id, { onDelete: "cascade" }),
    poolCode: varchar("pool_code", { length: 64 }).notNull(),
    gpuCardTypeId: text("gpu_card_type_id")
      .notNull()
      .references(() => gpuCardType.id, { onDelete: "restrict" }),
    gpuCount: integer("gpu_count").notNull(),
    onlineHours: durationHours("online_hours").notNull().default("0"),
    machineHours: durationHours("machine_hours").notNull().default("0"),
    cardHours: durationHours("card_hours").notNull().default("0"),
    etlBatchId: text("etl_batch_id"),
    ...dashboardTimestamps,
  },
  (table) => [
    uniqueIndex("device_pool_daily_snapshot_uk").on(
      table.snapshotDate,
      table.supplierDeviceId,
      table.poolCode,
    ),
    index("device_pool_daily_snapshot_date_pool_idx").on(
      table.snapshotDate,
      table.poolCode,
    ),
    index("device_pool_daily_snapshot_pool_card_type_date_idx").on(
      table.poolCode,
      table.gpuCardTypeId,
      table.snapshotDate,
    ),
  ],
)

/**
 * 设备 × 池 × 小时 明细（可选加速表）
 */
export const devicePoolHourlySnapshot = pgTable(
  "device_pool_hourly_snapshot",
  {
    id: text("id").primaryKey(),
    snapshotHour: timestamp("snapshot_hour", { withTimezone: true }).notNull(),
    supplierDeviceId: text("supplier_device_id")
      .notNull()
      .references(() => supplierDevice.id, { onDelete: "cascade" }),
    poolCode: varchar("pool_code", { length: 64 }).notNull(),
    gpuCardTypeId: text("gpu_card_type_id")
      .notNull()
      .references(() => gpuCardType.id, { onDelete: "restrict" }),
    gpuCount: integer("gpu_count").notNull(),
    onlineHours: durationHours("online_hours").notNull().default("0"),
    machineHours: durationHours("machine_hours").notNull().default("0"),
    cardHours: durationHours("card_hours").notNull().default("0"),
    etlBatchId: text("etl_batch_id"),
    ...dashboardTimestamps,
  },
  (table) => [
    uniqueIndex("device_pool_hourly_snapshot_uk").on(
      table.snapshotHour,
      table.supplierDeviceId,
      table.poolCode,
    ),
    index("device_pool_hourly_snapshot_hour_pool_idx").on(
      table.snapshotHour,
      table.poolCode,
    ),
    index("device_pool_hourly_snapshot_pool_card_type_hour_idx").on(
      table.poolCode,
      table.gpuCardTypeId,
      table.snapshotHour,
    ),
  ],
)

// ---------------------------------------------------------------------------
// DWS — 汇总（API 读模型）
// ---------------------------------------------------------------------------

/**
 * 全局 KPI 日桶
 * 每 metric_key 每日一行；sparkline 与 Period 期末/净增读此表。
 */
export const globalKpiDaily = pgTable(
  "global_kpi_daily",
  {
    id: text("id").primaryKey(),
    snapshotDate: date("snapshot_date").notNull(),
    metricKey: varchar("metric_key", { length: 64 }).notNull(),
    /** 主展示值（卡数/台数/个数，依 metric_key 语义） */
    valueNumeric: durationHours("value_numeric").notNull().default("0"),
    deviceCount: integer("device_count"),
    gpuCount: integer("gpu_count"),
    /** Period 模式：较上一日桶净增（绝对值） */
    netChange: durationHours("net_change"),
    deltaPercent: durationHours("delta_percent"),
    unit: varchar("unit", { length: 16 }),
    etlBatchId: text("etl_batch_id"),
    ...dashboardTimestamps,
  },
  (table) => [
    uniqueIndex("global_kpi_daily_uk").on(table.snapshotDate, table.metricKey),
    index("global_kpi_daily_date_idx").on(table.snapshotDate),
    index("global_kpi_daily_metric_date_idx").on(table.metricKey, table.snapshotDate),
  ],
)

/** 全局 KPI 小时桶 */
export const globalKpiHourly = pgTable(
  "global_kpi_hourly",
  {
    id: text("id").primaryKey(),
    snapshotHour: timestamp("snapshot_hour", { withTimezone: true }).notNull(),
    metricKey: varchar("metric_key", { length: 64 }).notNull(),
    valueNumeric: durationHours("value_numeric").notNull().default("0"),
    deviceCount: integer("device_count"),
    gpuCount: integer("gpu_count"),
    netChange: durationHours("net_change"),
    deltaPercent: durationHours("delta_percent"),
    unit: varchar("unit", { length: 16 }),
    etlBatchId: text("etl_batch_id"),
    ...dashboardTimestamps,
  },
  (table) => [
    uniqueIndex("global_kpi_hourly_uk").on(table.snapshotHour, table.metricKey),
    index("global_kpi_hourly_hour_idx").on(table.snapshotHour),
    index("global_kpi_hourly_metric_hour_idx").on(table.metricKey, table.snapshotHour),
  ],
)

/**
 * 生命周期阶段日桶（CRM 五段）
 * wip_end = 日末在制；throughput = 当日内首次进入该阶段设备数。
 */
export const lifecycleStageDaily = pgTable(
  "lifecycle_stage_daily",
  {
    id: text("id").primaryKey(),
    snapshotDate: date("snapshot_date").notNull(),
    stageCode: varchar("stage_code", { length: 32 }).notNull(),
    wipEndDeviceCount: integer("wip_end_device_count").notNull().default(0),
    wipEndGpuCount: integer("wip_end_gpu_count").notNull().default(0),
    throughputDeviceCount: integer("throughput_device_count").notNull().default(0),
    avgDwellSeconds: durationSeconds("avg_dwell_seconds"),
    etlBatchId: text("etl_batch_id"),
    ...dashboardTimestamps,
  },
  (table) => [
    uniqueIndex("lifecycle_stage_daily_uk").on(table.snapshotDate, table.stageCode),
    index("lifecycle_stage_daily_date_idx").on(table.snapshotDate),
    index("lifecycle_stage_daily_stage_date_idx").on(table.stageCode, table.snapshotDate),
  ],
)

/** 生命周期阶段小时桶 */
export const lifecycleStageHourly = pgTable(
  "lifecycle_stage_hourly",
  {
    id: text("id").primaryKey(),
    snapshotHour: timestamp("snapshot_hour", { withTimezone: true }).notNull(),
    stageCode: varchar("stage_code", { length: 32 }).notNull(),
    wipEndDeviceCount: integer("wip_end_device_count").notNull().default(0),
    wipEndGpuCount: integer("wip_end_gpu_count").notNull().default(0),
    throughputDeviceCount: integer("throughput_device_count").notNull().default(0),
    avgDwellSeconds: durationSeconds("avg_dwell_seconds"),
    etlBatchId: text("etl_batch_id"),
    ...dashboardTimestamps,
  },
  (table) => [
    uniqueIndex("lifecycle_stage_hourly_uk").on(table.snapshotHour, table.stageCode),
    index("lifecycle_stage_hourly_hour_idx").on(table.snapshotHour),
    index("lifecycle_stage_hourly_stage_hour_idx").on(table.stageCode, table.snapshotHour),
  ],
)

/**
 * 资源池日汇总
 * 粒度：snapshot_date × pool_code × gpu_card_type_id
 * Period 饼图/外围主值 = SUM(card_hours)；Snapshot 读 online_gpu_cards_end。
 */
export const resourcePoolDaily = pgTable(
  "resource_pool_daily",
  {
    id: text("id").primaryKey(),
    snapshotDate: date("snapshot_date").notNull(),
    poolCode: varchar("pool_code", { length: 64 }).notNull(),
    gpuCardTypeId: text("gpu_card_type_id")
      .notNull()
      .references(() => gpuCardType.id, { onDelete: "restrict" }),
    /** 日末在线 GPU 卡数（Snapshot §3.4.3） */
    onlineGpuCardsEnd: integer("online_gpu_cards_end").notNull().default(0),
    /** 日末归属该池的设备台数 */
    deviceCountEnd: integer("device_count_end").notNull().default(0),
    /** 当日内累计台时（§3.4.4）；维护中池为 0 */
    machineHours: durationHours("machine_hours").notNull().default("0"),
    /** 当日内累计卡时（§3.4.4）；维护中池为 0 */
    cardHours: durationHours("card_hours").notNull().default("0"),
    onlineGpuCardsNetChange: integer("online_gpu_cards_net_change"),
    cardHoursNetChange: durationHours("card_hours_net_change"),
    etlBatchId: text("etl_batch_id"),
    ...dashboardTimestamps,
  },
  (table) => [
    uniqueIndex("resource_pool_daily_uk").on(
      table.snapshotDate,
      table.poolCode,
      table.gpuCardTypeId,
    ),
    index("resource_pool_daily_date_pool_idx").on(table.snapshotDate, table.poolCode),
    index("resource_pool_daily_pool_date_idx").on(table.poolCode, table.snapshotDate),
    index("resource_pool_daily_card_type_date_idx").on(
      table.gpuCardTypeId,
      table.snapshotDate,
    ),
  ],
)

/** 资源池小时汇总 */
export const resourcePoolHourly = pgTable(
  "resource_pool_hourly",
  {
    id: text("id").primaryKey(),
    snapshotHour: timestamp("snapshot_hour", { withTimezone: true }).notNull(),
    poolCode: varchar("pool_code", { length: 64 }).notNull(),
    gpuCardTypeId: text("gpu_card_type_id")
      .notNull()
      .references(() => gpuCardType.id, { onDelete: "restrict" }),
    onlineGpuCardsEnd: integer("online_gpu_cards_end").notNull().default(0),
    deviceCountEnd: integer("device_count_end").notNull().default(0),
    machineHours: durationHours("machine_hours").notNull().default("0"),
    cardHours: durationHours("card_hours").notNull().default("0"),
    onlineGpuCardsNetChange: integer("online_gpu_cards_net_change"),
    cardHoursNetChange: durationHours("card_hours_net_change"),
    etlBatchId: text("etl_batch_id"),
    ...dashboardTimestamps,
  },
  (table) => [
    uniqueIndex("resource_pool_hourly_uk").on(
      table.snapshotHour,
      table.poolCode,
      table.gpuCardTypeId,
    ),
    index("resource_pool_hourly_hour_pool_idx").on(table.snapshotHour, table.poolCode),
    index("resource_pool_hourly_pool_hour_idx").on(table.poolCode, table.snapshotHour),
  ],
)

// ---------------------------------------------------------------------------
// ETL 批次（跑批审计）
// ---------------------------------------------------------------------------

/**
 * 大盘 ETL 跑批记录
 * granularity: day | hour；status: running | succeeded | failed
 */
export const dashboardEtlBatch = pgTable(
  "dashboard_etl_batch",
  {
    id: text("id").primaryKey(),
    jobCode: varchar("job_code", { length: 64 }).notNull(),
    granularity: varchar("granularity", { length: 16 }).notNull(),
    bucketStart: timestamp("bucket_start", { withTimezone: true }).notNull(),
    bucketEnd: timestamp("bucket_end", { withTimezone: true }),
    status: varchar("status", { length: 32 }).notNull().default("running"),
    rowsAffected: integer("rows_affected").notNull().default(0),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    payload: jsonb("payload"),
    ...dashboardTimestamps,
  },
  (table) => [
    index("dashboard_etl_batch_job_bucket_idx").on(
      table.jobCode,
      table.granularity,
      table.bucketStart,
    ),
    index("dashboard_etl_batch_status_idx").on(table.status),
  ],
)

// ---------------------------------------------------------------------------
// Relations（供 Drizzle 查询 join）
// ---------------------------------------------------------------------------

export const deviceLifecycleEventRelations = relations(deviceLifecycleEvent, ({ one }) => ({
  supplierDevice: one(supplierDevice, {
    fields: [deviceLifecycleEvent.supplierDeviceId],
    references: [supplierDevice.id],
  }),
  supplier: one(supplier, {
    fields: [deviceLifecycleEvent.supplierId],
    references: [supplier.id],
  }),
  dataCenter: one(dataCenter, {
    fields: [deviceLifecycleEvent.dataCenterId],
    references: [dataCenter.id],
  }),
  gpuCardType: one(gpuCardType, {
    fields: [deviceLifecycleEvent.gpuCardTypeId],
    references: [gpuCardType.id],
  }),
  sourceChangeLog: one(supplierDeviceChangeLog, {
    fields: [deviceLifecycleEvent.sourceChangeLogId],
    references: [supplierDeviceChangeLog.id],
  }),
}))

export const poolBindingHistoryRelations = relations(poolBindingHistory, ({ one }) => ({
  supplierDevice: one(supplierDevice, {
    fields: [poolBindingHistory.supplierDeviceId],
    references: [supplierDevice.id],
  }),
  sourceBinding: one(resourcePoolBinding, {
    fields: [poolBindingHistory.sourceBindingId],
    references: [resourcePoolBinding.id],
  }),
}))

export const deviceDailySnapshotRelations = relations(deviceDailySnapshot, ({ one }) => ({
  supplierDevice: one(supplierDevice, {
    fields: [deviceDailySnapshot.supplierDeviceId],
    references: [supplierDevice.id],
  }),
  supplier: one(supplier, {
    fields: [deviceDailySnapshot.supplierId],
    references: [supplier.id],
  }),
  dataCenter: one(dataCenter, {
    fields: [deviceDailySnapshot.dataCenterId],
    references: [dataCenter.id],
  }),
  gpuCardType: one(gpuCardType, {
    fields: [deviceDailySnapshot.gpuCardTypeId],
    references: [gpuCardType.id],
  }),
}))

export const deviceHourlySnapshotRelations = relations(deviceHourlySnapshot, ({ one }) => ({
  supplierDevice: one(supplierDevice, {
    fields: [deviceHourlySnapshot.supplierDeviceId],
    references: [supplierDevice.id],
  }),
  supplier: one(supplier, {
    fields: [deviceHourlySnapshot.supplierId],
    references: [supplier.id],
  }),
  dataCenter: one(dataCenter, {
    fields: [deviceHourlySnapshot.dataCenterId],
    references: [dataCenter.id],
  }),
  gpuCardType: one(gpuCardType, {
    fields: [deviceHourlySnapshot.gpuCardTypeId],
    references: [gpuCardType.id],
  }),
}))

export const resourcePoolDailyRelations = relations(resourcePoolDaily, ({ one }) => ({
  gpuCardType: one(gpuCardType, {
    fields: [resourcePoolDaily.gpuCardTypeId],
    references: [gpuCardType.id],
  }),
}))

export const resourcePoolHourlyRelations = relations(resourcePoolHourly, ({ one }) => ({
  gpuCardType: one(gpuCardType, {
    fields: [resourcePoolHourly.gpuCardTypeId],
    references: [gpuCardType.id],
  }),
}))
