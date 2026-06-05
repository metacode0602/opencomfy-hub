/**
 * 财务账期与经营月结域表结构（Drizzle ORM / PostgreSQL）
 *
 * 设计依据：apps/web/content/design/billing-period-import-design.md（v1.4）
 *
 * 领域模型：
 * - 原始层（Raw）：账期内可替换；每账期每 file_type 仅一组 batch（DB 唯一约束）
 * - 个人收入：personal_tenant_bill / personal_baremetal_order + billing_period_personal_income_summary
 * - 派生层：platform_income_monthly / platform_cost_monthly，计算前 DELETE 再 INSERT
 * - 重新生成：应用层 purge 后物理删除子表行；不保留历史 batch / calc 快照
 * - 主数据衔接：CRM tenant / project / user_staff；供应商 supplier_unit_cost
 *
 * 约定：
 * - 主键 text；金额 numeric(15,4)；卡时 numeric(15,4)；分成比例 numeric(7,4)
 * - 扩展与追溯字段 jsonb
 */

import { relations, sql } from "drizzle-orm"
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

import { billingTenant, crmProject, customer, userStaff } from "./crm-schema"
import {
  dataCenter,
  gpuCardType,
  supplierPricingRecord,
  supplierUnitCost,
} from "./supply-schema"

/** 金额 decimal(15,4) */
const money = (name: string) => numeric(name, { precision: 15, scale: 4 })

/** 卡时 decimal(15,4) */
const cardHours = (name: string) => numeric(name, { precision: 15, scale: 4 })

/** 成本分成比例 0~100，decimal(7,4) */
const allocationPercent = (name: string) =>
  numeric(name, { precision: 7, scale: 4 })

/** 成交/刊例比例 decimal(9,6) */
const dealToListRatio = (name: string) => numeric(name, { precision: 9, scale: 6 })

const financeTimestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}

// ---------------------------------------------------------------------------
// §4.2 派生层 — 账期主表
// ---------------------------------------------------------------------------

/**
 * 账期 billing_period
 * status: draft | imported | pending_allocation | computed | published | void
 */
export const billingPeriod = pgTable(
  "billing_period",
  {
    id: text("id").primaryKey(),
    periodCode: varchar("period_code", { length: 32 }).notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("draft"),
    /** purge / 重新生成后置 NULL，计算完成后写入 */
    totalIncome: money("total_income"),
    /** 企业收入：platform_income_monthly 总消费合计 */
    enterpriseIncome: money("enterprise_income"),
    /** 个人收入：billing_period_personal_income_summary.non_project 总消费 */
    personalIncome: money("personal_income"),
    /** 收入合计：企业收入 + 个人收入 */
    incomeTotal: money("income_total"),
    totalCost: money("total_cost"),
    /** 项目成本：外部租户（有项目绑定）成本合计 */
    projectCost: money("project_cost"),
    /** 内部用户成本：内部租户成本合计 */
    internalUserCost: money("internal_user_cost"),
    totalGrossProfit: money("total_gross_profit"),
    supplementary: money("supplementary"),
    balanceIncome: money("balance_income"),
    baremetalIncome: money("baremetal_income"),
    lastComputedAt: timestamp("last_computed_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    /** 为 true 时整月单窗口上传客户账单，成本按账期结束日刊例价计算 */
    ignoreListPriceWindows: boolean("ignore_list_price_windows")
      .notNull()
      .default(false),
    ...financeTimestamps,
  },
  (table) => [
    uniqueIndex("billing_period_period_code_uk").on(table.periodCode),
    index("billing_period_status_idx").on(table.status),
    index("billing_period_period_start_idx").on(table.periodStart),
  ],
)

/** 平台月度收入明细 platform_income_monthly */
export const platformIncomeMonthly = pgTable(
  "platform_income_monthly",
  {
    id: text("id").primaryKey(),
    billingPeriodId: text("billing_period_id")
      .notNull()
      .references(() => billingPeriod.id, { onDelete: "cascade" }),
    /** B | C */
    customerType: varchar("customer_type", { length: 8 }).notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => billingTenant.id, { onDelete: "restrict" }),
    tenantPlatformId: varchar("tenant_platform_id", { length: 128 }).notNull(),
    tenantName: varchar("tenant_name", { length: 255 }).notNull(),
    customerId: text("customer_id").references(() => customer.id, {
      onDelete: "restrict",
    }),
    customerFullName: varchar("customer_full_name", { length: 255 }),
    projectId: text("project_id").references(() => crmProject.id, {
      onDelete: "set null",
    }),
    projectName: varchar("project_name", { length: 255 }),
    supplementaryConsumption: money("supplementary_consumption"),
    balanceConsumption: money("balance_consumption"),
    bareMetalConsumption: money("bare_metal_consumption"),
    totalConsumption: money("total_consumption").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("platform_income_monthly_period_tenant_project_uk").on(
      table.billingPeriodId,
      table.tenantId,
      table.projectId,
    ),
    index("platform_income_monthly_billing_period_id_idx").on(table.billingPeriodId),
    index("platform_income_monthly_tenant_platform_id_idx").on(table.tenantPlatformId),
  ],
)

/**
 * 平台月度成本 platform_cost_monthly
 * type: record | sum
 */
export const platformCostMonthly = pgTable(
  "platform_cost_monthly",
  {
    id: text("id").primaryKey(),
    billingPeriodId: text("billing_period_id")
      .notNull()
      .references(() => billingPeriod.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 16 }).notNull(), // record | sum
    staffId: text("staff_id").references(() => userStaff.id, {
      onDelete: "restrict",
    }),
    accountManager: varchar("account_manager", { length: 128 }),
    supplierUnitCostId: text("supplier_unit_cost_id").references(
      () => supplierUnitCost.id,
      { onDelete: "set null" },
    ),
    dataCenterId: text("data_center_id").references(() => dataCenter.id, {
      onDelete: "set null",
    }),
    gpuCardTypeId: text("gpu_card_type_id").references(() => gpuCardType.id, {
      onDelete: "set null",
    }),
    idcName: varchar("idc_name", { length: 255 }),
    idcCode: varchar("idc_code", { length: 64 }),
    cardType: varchar("card_type", { length: 128 }),
    totalConsumption: money("total_consumption"),
    voucherConsumption: money("voucher_consumption"),
    balanceConsumption: money("balance_consumption"),
    totalCardHours: cardHours("total_card_hours"),
    balanceCardHours: cardHours("balance_card_hours"),
    voucherCardHours: cardHours("voucher_card_hours"),
    confirmedRevenueExclTax: money("confirmed_revenue_excl_tax"),
    soldDurationCostExclTax: money("sold_duration_cost_excl_tax"),
    giftedDurationCostExclTax: money("gifted_duration_cost_excl_tax"),
    grossProfit: money("gross_profit"),
    /** v3 成本汇总：客户经理姓名快照（读路径不联 staff 表） */
    staffName: varchar("staff_name", { length: 128 }),
    pricingSnapshotId: text("pricing_snapshot_id").references(
      () => billingPeriodCostPricingSnapshot.id,
      { onDelete: "set null" },
    ),
    sourceLineIds: jsonb("source_line_ids").$type<string[]>(),
    /** 阶梯分成落档审计 */
    listPricePerHour: money("list_price_per_hour"),
    dealUnitPricePerHour: money("deal_unit_price_per_hour"),
    dealToListRatio: dealToListRatio("deal_to_list_ratio"),
    matchedTierOrder: integer("matched_tier_order"),
    revenueSharePercentApplied: numeric("revenue_share_percent_applied", {
      precision: 7,
      scale: 4,
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("platform_cost_monthly_billing_period_id_idx").on(table.billingPeriodId),
    index("platform_cost_monthly_staff_id_idx").on(table.staffId),
    index("platform_cost_monthly_billing_period_type_idx").on(
      table.billingPeriodId,
      table.type,
    ),
    index("platform_cost_monthly_supplier_unit_cost_id_idx").on(
      table.supplierUnitCostId,
    ),
    index("platform_cost_monthly_data_center_id_idx").on(table.dataCenterId),
    index("platform_cost_monthly_gpu_card_type_id_idx").on(table.gpuCardTypeId),
    uniqueIndex("platform_cost_monthly_record_uk")
      .on(table.billingPeriodId, table.staffId, table.dataCenterId, table.gpuCardTypeId)
      .where(sql`${table.type} = 'record'`),
    uniqueIndex("platform_cost_monthly_period_sum_uk")
      .on(table.billingPeriodId)
      .where(sql`${table.type} = 'sum' AND ${table.staffId} IS NULL`),
    uniqueIndex("platform_cost_monthly_staff_sum_uk")
      .on(table.billingPeriodId, table.staffId)
      .where(sql`${table.type} = 'sum' AND ${table.staffId} IS NOT NULL`),
  ],
)

// ---------------------------------------------------------------------------
// §4.6 成本派生中间层（v3 — source_line + pricing_snapshot）
// ---------------------------------------------------------------------------

export const billingPeriodCostSourceLine = pgTable(
  "billing_period_cost_source_line",
  {
    id: text("id").primaryKey(),
    billingPeriodId: text("billing_period_id")
      .notNull()
      .references(() => billingPeriod.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 16 }).notNull(), // flex | baremetal
    sourceRawId: text("source_raw_id").notNull(),
    tenantId: text("tenant_id").references(() => billingTenant.id, {
      onDelete: "set null",
    }),
    tenantPlatformId: varchar("tenant_platform_id", { length: 128 }).notNull(),
    projectId: text("project_id").references(() => crmProject.id, {
      onDelete: "set null",
    }),
    staffId: text("staff_id").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    staffName: varchar("staff_name", { length: 128 }),
    dataCenterId: text("data_center_id")
      .notNull()
      .references(() => dataCenter.id, { onDelete: "restrict" }),
    dataCenterName: varchar("data_center_name", { length: 255 }),
    gpuCardTypeId: text("gpu_card_type_id")
      .notNull()
      .references(() => gpuCardType.id, { onDelete: "restrict" }),
    gpuCardTypeName: varchar("gpu_card_type_name", { length: 128 }),
    totalConsumption: money("total_consumption").notNull().default("0"),
    voucherConsumption: money("voucher_consumption").notNull().default("0"),
    balanceConsumption: money("balance_consumption").notNull().default("0"),
    totalCardHours: cardHours("total_card_hours").notNull().default("0"),
    voucherCardHours: cardHours("voucher_card_hours").notNull().default("0"),
    balanceCardHours: cardHours("balance_card_hours").notNull().default("0"),
    supplierUnitCostId: text("supplier_unit_cost_id").references(
      () => supplierUnitCost.id,
      { onDelete: "set null" },
    ),
    supplierPricingRecordId: text("supplier_pricing_record_id").references(
      () => supplierPricingRecord.id,
      { onDelete: "set null" },
    ),
    windowId: text("window_id").references(() => billingPeriodTenantBillWindow.id, {
      onDelete: "set null",
    }),
    sourceMeta: jsonb("source_meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("billing_period_cost_source_line_uk").on(
      table.billingPeriodId,
      table.kind,
      table.sourceRawId,
      table.staffId,
    ),
    index("billing_period_cost_source_line_period_id_idx").on(table.billingPeriodId),
  ],
)

export const billingPeriodCostPricingSnapshot = pgTable(
  "billing_period_cost_pricing_snapshot",
  {
    id: text("id").primaryKey(),
    billingPeriodId: text("billing_period_id")
      .notNull()
      .references(() => billingPeriod.id, { onDelete: "cascade" }),
    windowId: text("window_id")
      .notNull()
      .references(() => billingPeriodTenantBillWindow.id, { onDelete: "cascade" }),
    gpuCardTypeId: text("gpu_card_type_id")
      .notNull()
      .references(() => gpuCardType.id, { onDelete: "restrict" }),
    gpuCardTypeName: varchar("gpu_card_type_name", { length: 128 }),
    dataCenterId: text("data_center_id")
      .notNull()
      .references(() => dataCenter.id, { onDelete: "restrict" }),
    dataCenterName: varchar("data_center_name", { length: 255 }),
    supplierUnitCostId: text("supplier_unit_cost_id").references(() => supplierUnitCost.id, {
      onDelete: "set null",
    }),
    supplierPricingRecordId: text("supplier_pricing_record_id").references(
      () => supplierPricingRecord.id,
      { onDelete: "set null" },
    ),
    pricingMode: varchar("pricing_mode", { length: 32 }).notNull(),
    billingUnit: varchar("billing_unit", { length: 16 }),
    monthlyRentPerMachine: money("monthly_rent_per_machine"),
    cardsPerMachine: integer("cards_per_machine"),
    listPricePerHour: money("list_price_per_hour"),
    dealUnitPricePerHour: money("deal_unit_price_per_hour"),
    revenueSharePercent: numeric("revenue_share_percent", { precision: 7, scale: 4 }),
    pricingTiers: jsonb("pricing_tiers"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("billing_period_cost_pricing_snapshot_uk").on(
      table.billingPeriodId,
      table.windowId,
      table.dataCenterId,
      table.gpuCardTypeId,
    ),
    index("billing_period_cost_pricing_snapshot_period_id_idx").on(
      table.billingPeriodId,
    ),
  ],
)

// ---------------------------------------------------------------------------
// §4.1 原始层 — 导入批次与 Raw 行
// ---------------------------------------------------------------------------

/**
 * 账期租户账单子窗口（平台刊例价变动时按时间段拆分上传 tenant_bill）
 */
export const billingPeriodTenantBillWindow = pgTable(
  "billing_period_tenant_bill_window",
  {
    id: text("id").primaryKey(),
    billingPeriodId: text("billing_period_id")
      .notNull()
      .references(() => billingPeriod.id, { onDelete: "cascade" }),
    windowStart: date("window_start").notNull(),
    windowEnd: date("window_end").notNull(),
    sortOrder: integer("sort_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("billing_period_tenant_bill_window_uk").on(
      table.billingPeriodId,
      table.windowStart,
      table.windowEnd,
    ),
    index("billing_period_tenant_bill_window_period_id_idx").on(table.billingPeriodId),
  ],
)

/**
 * 导入批次 billing_period_import_batch
 * file_type: customer_consumption | baremetal_order | tenant_bill |
 *   personal_tenant_bill | personal_baremetal_order
 *
 * customer / baremetal：每账期至多一条；tenant_bill：每 window 至多一条；
 * personal_*：每账期各至多一条（个人收入页独立批次）。
 */
export const billingPeriodImportBatch = pgTable(
  "billing_period_import_batch",
  {
    id: text("id").primaryKey(),
    billingPeriodId: text("billing_period_id")
      .notNull()
      .references(() => billingPeriod.id, { onDelete: "cascade" }),
    /** tenant_bill 必填；其他 file_type 为 null */
    windowId: text("window_id").references(() => billingPeriodTenantBillWindow.id, {
      onDelete: "cascade",
    }),
    fileType: varchar("file_type", { length: 32 }).notNull(),
    fileName: varchar("file_name", { length: 512 }).notNull(),
    /** 相对 DATA_DIR/finance-imports 的路径 */
    storagePath: varchar("storage_path", { length: 1024 }).notNull().default(""),
    /** 标注错误单元格后的 xlsx 路径 */
    errorReportPath: varchar("error_report_path", { length: 1024 }),
    fileSha256: varchar("file_sha256", { length: 64 }).notNull(),
    fileSizeBytes: integer("file_size_bytes"),
    /** ok | error */
    parseStatus: varchar("parse_status", { length: 16 }).notNull().default("ok"),
    parseErrorCount: integer("parse_error_count").notNull().default(0),
    rowCount: integer("row_count").notNull().default(0),
    uploadedBy: text("uploaded_by").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("billing_period_import_batch_period_customer_uk")
      .on(table.billingPeriodId)
      .where(sql`${table.fileType} = 'customer_consumption'`),
    uniqueIndex("billing_period_import_batch_period_baremetal_uk")
      .on(table.billingPeriodId)
      .where(sql`${table.fileType} = 'baremetal_order'`),
    uniqueIndex("billing_period_import_batch_period_tenant_window_uk")
      .on(table.billingPeriodId, table.windowId)
      .where(sql`${table.fileType} = 'tenant_bill'`),
    uniqueIndex("billing_period_import_batch_period_personal_tenant_bill_uk")
      .on(table.billingPeriodId)
      .where(sql`${table.fileType} = 'personal_tenant_bill'`),
    uniqueIndex("billing_period_import_batch_period_personal_baremetal_uk")
      .on(table.billingPeriodId)
      .where(sql`${table.fileType} = 'personal_baremetal_order'`),
    index("billing_period_import_batch_period_id_idx").on(table.billingPeriodId),
    index("billing_period_import_batch_window_id_idx").on(table.windowId),
  ],
)

/**
 * 个人收入汇总（非项目租户 + 黑名单子集）
 * summary_kind: non_project | blacklist
 */
export const billingPeriodPersonalIncomeSummary = pgTable(
  "billing_period_personal_income_summary",
  {
    id: text("id").primaryKey(),
    billingPeriodId: text("billing_period_id")
      .notNull()
      .references(() => billingPeriod.id, { onDelete: "cascade" }),
    summaryKind: varchar("summary_kind", { length: 32 }).notNull(),
    balanceConsumption: money("balance_consumption").notNull().default("0"),
    bareMetalConsumption: money("bare_metal_consumption").notNull().default("0"),
    totalConsumption: money("total_consumption").notNull(),
    matchedTenantCount: integer("matched_tenant_count").notNull().default(0),
    tenantBillBatchId: text("tenant_bill_batch_id").references(
      () => billingPeriodImportBatch.id,
      { onDelete: "set null" },
    ),
    baremetalBatchId: text("baremetal_batch_id").references(
      () => billingPeriodImportBatch.id,
      { onDelete: "set null" },
    ),
    ruleVersion: varchar("rule_version", { length: 32 }),
    lastComputedAt: timestamp("last_computed_at", { withTimezone: true }),
    ...financeTimestamps,
  },
  (table) => [
    uniqueIndex("billing_period_personal_income_summary_period_kind_uk").on(
      table.billingPeriodId,
      table.summaryKind,
    ),
    index("billing_period_personal_income_summary_period_id_idx").on(
      table.billingPeriodId,
    ),
  ],
)

/** Raw：客户消费明细 */
export const billingPeriodRawCustomerConsumption = pgTable(
  "billing_period_raw_customer_consumption",
  {
    id: text("id").primaryKey(),
    batchId: text("batch_id")
      .notNull()
      .references(() => billingPeriodImportBatch.id, { onDelete: "cascade" }),
    rowNo: integer("row_no").notNull(),
    tenantPlatformId: varchar("tenant_platform_id", { length: 128 }).notNull(),
    productType: varchar("product_type", { length: 128 }),
    tenantType: varchar("tenant_type", { length: 32 }),
    customerType: varchar("customer_type", { length: 8 }).notNull(),
    projectNameExcel: varchar("project_name_excel", { length: 255 }),
    totalConsumption: money("total_consumption").notNull(),
    voucherConsumption: money("voucher_consumption").notNull().default("0"),
    balanceConsumption: money("balance_consumption").notNull(),
    rawJson: jsonb("raw_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("billing_period_raw_customer_consumption_batch_id_idx").on(table.batchId),
    index("billing_period_raw_customer_consumption_tenant_idx").on(
      table.tenantPlatformId,
    ),
  ],
)

/** Step I0：客户消费按租户×客户类型预汇总 */
export const billingPeriodAggCustomerConsumption = pgTable(
  "billing_period_agg_customer_consumption",
  {
    id: text("id").primaryKey(),
    billingPeriodId: text("billing_period_id")
      .notNull()
      .references(() => billingPeriod.id, { onDelete: "cascade" }),
    tenantPlatformId: varchar("tenant_platform_id", { length: 128 }).notNull(),
    customerType: varchar("customer_type", { length: 8 }).notNull(),
    tenantId: text("tenant_id").references(() => billingTenant.id, {
      onDelete: "restrict",
    }),
    customerId: text("customer_id").references(() => customer.id, {
      onDelete: "restrict",
    }),
    customerFullName: varchar("customer_full_name", { length: 255 }),
    projectId: text("project_id").references(() => crmProject.id, {
      onDelete: "set null",
    }),
    projectName: varchar("project_name", { length: 255 }),
    allocationPercent: allocationPercent("allocation_percent"),
    totalConsumption: money("total_consumption").notNull(),
    voucherConsumption: money("voucher_consumption").notNull().default("0"),
    balanceConsumption: money("balance_consumption").notNull(),
    sourceRawIds: jsonb("source_raw_ids").$type<string[]>().notNull(),
    rowCountByType: integer("row_count_by_type").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("billing_period_agg_customer_consumption_uk").on(
      table.billingPeriodId,
      table.tenantPlatformId,
      table.projectId,
    ),
    index("billing_period_agg_customer_consumption_period_id_idx").on(
      table.billingPeriodId,
    ),
  ],
)

/** Raw：裸金属消费订单 */
export const billingPeriodRawBaremetalOrder = pgTable(
  "billing_period_raw_baremetal_order",
  {
    id: text("id").primaryKey(),
    batchId: text("batch_id")
      .notNull()
      .references(() => billingPeriodImportBatch.id, { onDelete: "cascade" }),
    rowNo: integer("row_no").notNull(),
    orderId: varchar("order_id", { length: 128 }).notNull(),
    orderNo: varchar("order_no", { length: 128 }),
    tenantPlatformId: varchar("tenant_platform_id", { length: 128 }).notNull(),
    idcName: varchar("idc_name", { length: 128 }),
    deviceModel: varchar("device_model", { length: 128 }),
    payStatus: varchar("pay_status", { length: 32 }).notNull(),
    deviceStatus: varchar("device_status", { length: 32 }),
    purchaseQtyText: varchar("purchase_qty_text", { length: 128 }),
    deviceQty: integer("device_qty"),
    orderAmount: money("order_amount"),
    refundAmount: money("refund_amount").default("0"),
    finalAmount: money("final_amount").notNull(),
    orderedAt: timestamp("ordered_at", { withTimezone: true }).notNull(),
    rawJson: jsonb("raw_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("billing_period_raw_baremetal_order_batch_id_idx").on(table.batchId),
    index("billing_period_raw_baremetal_order_tenant_idx").on(table.tenantPlatformId),
    index("billing_period_raw_baremetal_order_ordered_at_idx").on(table.orderedAt),
  ],
)

/** Raw：客户账单详情（除 CPU 任务外） */
export const billingPeriodRawTenantBill = pgTable(
  "billing_period_raw_tenant_bill",
  {
    id: text("id").primaryKey(),
    batchId: text("batch_id")
      .notNull()
      .references(() => billingPeriodImportBatch.id, { onDelete: "cascade" }),
    rowNo: integer("row_no").notNull(),
    tenantPlatformId: varchar("tenant_platform_id", { length: 128 }).notNull(),
    totalConsumption: money("total_consumption").notNull(),
    voucherConsumption: money("voucher_consumption").notNull().default("0"),
    balanceConsumption: money("balance_consumption").notNull(),
    totalCardHours: cardHours("total_card_hours"),
    voucherCardHours: cardHours("voucher_card_hours").default("0"),
    balanceCardHours: cardHours("balance_card_hours").notNull(),
    gpuModel: varchar("gpu_model", { length: 128 }).notNull(),
    regionCode: varchar("region_code", { length: 64 }).notNull(),
    rawJson: jsonb("raw_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("billing_period_raw_tenant_bill_batch_id_idx").on(table.batchId),
    index("billing_period_raw_tenant_bill_tenant_idx").on(table.tenantPlatformId),
    index("billing_period_raw_tenant_bill_region_gpu_idx").on(
      table.regionCode,
      table.gpuModel,
    ),
  ],
)

// ---------------------------------------------------------------------------
// §4.4 / §4.5 租户项目补全与成本分成
// ---------------------------------------------------------------------------

/**
 * 账期内租户→项目→AM 补全结果
 * source: auto_single | auto_preset | manual_period
 */
export const billingPeriodTenantProjectEnrichment = pgTable(
  "billing_period_tenant_project_enrichment",
  {
    id: text("id").primaryKey(),
    billingPeriodId: text("billing_period_id")
      .notNull()
      .references(() => billingPeriod.id, { onDelete: "cascade" }),
    tenantPlatformId: varchar("tenant_platform_id", { length: 128 }).notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => billingTenant.id, { onDelete: "restrict" }),
    projectId: text("project_id")
      .notNull()
      .references(() => crmProject.id, { onDelete: "restrict" }),
    projectName: varchar("project_name", { length: 255 }).notNull(),
    staffId: text("staff_id").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    accountManagerName: varchar("account_manager_name", { length: 128 }),
    source: varchar("source", { length: 32 }).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("billing_period_tenant_project_enrichment_uk").on(
      table.billingPeriodId,
      table.tenantPlatformId,
      table.projectId,
    ),
    index("billing_period_tenant_project_enrichment_period_id_idx").on(
      table.billingPeriodId,
    ),
    index("billing_period_tenant_project_enrichment_tenant_id_idx").on(table.tenantId),
  ],
)

/**
 * 预置：同一租户多项目默认成本分成 tenant_project_cost
 * effective_to NULL = 当前生效
 */
export const tenantProjectCost = pgTable(
  "tenant_project_cost",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => billingTenant.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => crmProject.id, { onDelete: "cascade" }),
    allocationPercent: allocationPercent("allocation_percent").notNull(),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    remark: text("remark"),
    createdBy: text("created_by").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("tenant_project_cost_current_uk")
      .on(table.tenantId, table.projectId)
      .where(sql`${table.effectiveTo} IS NULL`),
    index("tenant_project_cost_tenant_id_idx").on(table.tenantId),
    index("tenant_project_cost_project_id_idx").on(table.projectId),
  ],
)

/** 本账期租户多项目成本分成 billing_tenant_cost_allocation */
export const billingTenantCostAllocation = pgTable(
  "billing_tenant_cost_allocation",
  {
    id: text("id").primaryKey(),
    billingPeriodId: text("billing_period_id")
      .notNull()
      .references(() => billingPeriod.id, { onDelete: "cascade" }),
    tenantPlatformId: varchar("tenant_platform_id", { length: 128 }).notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => billingTenant.id, { onDelete: "restrict" }),
    projectId: text("project_id")
      .notNull()
      .references(() => crmProject.id, { onDelete: "restrict" }),
    allocationPercent: allocationPercent("allocation_percent").notNull(),
    presetId: text("preset_id").references(() => tenantProjectCost.id, {
      onDelete: "set null",
    }),
    createdBy: text("created_by").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("billing_tenant_cost_allocation_uk").on(
      table.billingPeriodId,
      table.tenantId,
      table.projectId,
    ),
    index("billing_tenant_cost_allocation_period_id_idx").on(table.billingPeriodId),
    index("billing_tenant_cost_allocation_tenant_id_idx").on(table.tenantId),
  ],
)

// ---------------------------------------------------------------------------
// 对账报告与操作审计（v1.4：不保留被 purge 的业务行副本）
// ---------------------------------------------------------------------------

/** 对账报告 §7.2；每账期仅保留当前一份，purge(derived|full) 时删除 */
export const billingPeriodReconciliationReport = pgTable(
  "billing_period_reconciliation_report",
  {
    id: text("id").primaryKey(),
    billingPeriodId: text("billing_period_id")
      .notNull()
      .references(() => billingPeriod.id, { onDelete: "cascade" }),
    /** 检查项列表、diff、警告等，结构见设计 §7.2 */
    reportJson: jsonb("report_json").notNull(),
    ruleVersion: varchar("rule_version", { length: 32 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("billing_period_reconciliation_report_period_uk").on(
      table.billingPeriodId,
    ),
  ],
)

/**
 * 账期操作审计 billing_period_operation_log
 * operation: import_batch | purge | regenerate | compute | publish | unpublish | override
 */
export const billingPeriodOperationLog = pgTable(
  "billing_period_operation_log",
  {
    id: text("id").primaryKey(),
    billingPeriodId: text("billing_period_id")
      .notNull()
      .references(() => billingPeriod.id, { onDelete: "cascade" }),
    operation: varchar("operation", { length: 32 }).notNull(),
    /** purge 时：file_type | derived | full */
    purgeScope: varchar("purge_scope", { length: 32 }),
    actorId: text("actor_id").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("billing_period_operation_log_period_id_idx").on(table.billingPeriodId),
    index("billing_period_operation_log_operation_idx").on(table.operation),
    index("billing_period_operation_log_created_at_idx").on(table.createdAt),
  ],
)

// ---------------------------------------------------------------------------
// 调账与审计历史（应用层 override，不回写 Raw；purge(derived) 时随派生行 cascade 删除）
// ---------------------------------------------------------------------------

/** 补充消费修改历史 */
export const supplementaryConsumptionHistory = pgTable(
  "supplementary_consumption_history",
  {
    id: text("id").primaryKey(),
    incomeId: text("income_id")
      .notNull()
      .references(() => platformIncomeMonthly.id, { onDelete: "cascade" }),
    previousValue: money("previous_value"),
    newValue: money("new_value").notNull(),
    /** offline_order | manual_correction | promotion | compensation | other */
    type: varchar("type", { length: 32 }).notNull(),
    remark: text("remark").notNull(),
    createdBy: text("created_by").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("supplementary_consumption_history_income_id_idx").on(table.incomeId),
  ],
)

/** 收入调账历史（余额消费、裸金属消费） */
export const incomeAdjustmentHistory = pgTable(
  "income_adjustment_history",
  {
    id: text("id").primaryKey(),
    incomeId: text("income_id")
      .notNull()
      .references(() => platformIncomeMonthly.id, { onDelete: "cascade" }),
    balanceConsumptionBefore: money("balance_consumption_before"),
    balanceConsumptionAfter: money("balance_consumption_after"),
    bareMetalConsumptionBefore: money("bare_metal_consumption_before"),
    bareMetalConsumptionAfter: money("bare_metal_consumption_after"),
    reason: text("reason").notNull(),
    createdBy: text("created_by").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("income_adjustment_history_income_id_idx").on(table.incomeId)],
)

/** 券卡时调账历史 */
export const voucherCardHoursAdjustmentHistory = pgTable(
  "voucher_card_hours_adjustment_history",
  {
    id: text("id").primaryKey(),
    costId: text("cost_id")
      .notNull()
      .references(() => platformCostMonthly.id, { onDelete: "cascade" }),
    voucherCardHoursBefore: cardHours("voucher_card_hours_before"),
    voucherCardHoursAfter: cardHours("voucher_card_hours_after"),
    adjustmentHours: cardHours("adjustment_hours").notNull(),
    giftedDurationCostExclTaxBefore: money("gifted_duration_cost_excl_tax_before"),
    giftedDurationCostExclTaxAfter: money("gifted_duration_cost_excl_tax_after"),
    grossProfitBefore: money("gross_profit_before"),
    grossProfitAfter: money("gross_profit_after"),
    unitPricePerHour: money("unit_price_per_hour").notNull(),
    reason: text("reason").notNull(),
    createdBy: text("created_by").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("voucher_card_hours_adjustment_history_cost_id_idx").on(table.costId),
  ],
)

// ---------------------------------------------------------------------------
// 弹性算力提成派生（独立于 platform_cost_monthly）
// ---------------------------------------------------------------------------

export const platformCostCommissionDeriveRun = pgTable(
  "platform_cost_commission_derive_run",
  {
    id: text("id").primaryKey(),
    billingPeriodId: text("billing_period_id")
      .notNull()
      .references(() => billingPeriod.id, { onDelete: "cascade" }),
    policyCode: varchar("policy_code", { length: 64 }).notNull(),
    runVersion: integer("run_version").notNull().default(1),
    status: varchar("status", { length: 32 }).notNull(), // running | calculated | failed
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    errorSummary: text("error_summary"),
    ...financeTimestamps,
  },
  (table) => [
    index("platform_cost_commission_derive_run_period_idx").on(table.billingPeriodId),
    uniqueIndex("platform_cost_commission_derive_run_period_policy_ver_uk").on(
      table.billingPeriodId,
      table.policyCode,
      table.runVersion,
    ),
  ],
)

export const platformCostCommissionDeriveProject = pgTable(
  "platform_cost_commission_derive_project",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => platformCostCommissionDeriveRun.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => crmProject.id, { onDelete: "cascade" }),
    settlementMonth: varchar("settlement_month", { length: 7 }).notNull(),
    flexConsumption: money("flex_consumption").notNull().default("0"),
    grossProfitBase: money("gross_profit_base").notNull().default("0"),
    grossProfitRateDisplay: money("gross_profit_rate_display"),
    opportunitySource: varchar("opportunity_source", { length: 32 }),
    dealClosedMonth: varchar("deal_closed_month", { length: 7 }),
    monthPhase: varchar("month_phase", { length: 32 }),
    monthsSinceDeal: integer("months_since_deal"),
    accountManagerStaffId: text("account_manager_staff_id").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    revenueDepartment: varchar("revenue_department", { length: 32 }),
    skippedCommission: boolean("skipped_commission").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("platform_cost_commission_derive_project_run_project_uk").on(
      table.runId,
      table.projectId,
    ),
    index("platform_cost_commission_derive_project_run_idx").on(table.runId),
  ],
)

export const platformCostCommissionDeriveLine = pgTable(
  "platform_cost_commission_derive_line",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => platformCostCommissionDeriveRun.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => crmProject.id, { onDelete: "cascade" }),
    recipientRole: varchar("recipient_role", { length: 32 }).notNull(),
    recipientStaffId: text("recipient_staff_id").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    recipientDept: varchar("recipient_dept", { length: 32 }),
    monthPhase: varchar("month_phase", { length: 32 }).notNull(),
    rate: money("rate").notNull().default("0"),
    platformRatio: money("platform_ratio").notNull().default("1"),
    grossProfitBase: money("gross_profit_base").notNull().default("0"),
    commissionAmount: money("commission_amount").notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("platform_cost_commission_derive_line_run_project_role_uk").on(
      table.runId,
      table.projectId,
      table.recipientRole,
    ),
    index("platform_cost_commission_derive_line_run_idx").on(table.runId),
  ],
)

export const platformCostCommissionDeriveAmPhase = pgTable(
  "platform_cost_commission_derive_am_phase",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => platformCostCommissionDeriveRun.id, { onDelete: "cascade" }),
    accountManagerStaffId: text("account_manager_staff_id")
      .notNull()
      .references(() => userStaff.id, { onDelete: "cascade" }),
    monthPhase: varchar("month_phase", { length: 32 }).notNull(),
    projectCount: integer("project_count").notNull().default(0),
    grossProfitBaseSum: money("gross_profit_base_sum").notNull().default("0"),
    salesCommissionSum: money("sales_commission_sum").notNull().default("0"),
    flexConsumptionSum: money("flex_consumption_sum"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("platform_cost_commission_derive_am_phase_run_am_phase_uk").on(
      table.runId,
      table.accountManagerStaffId,
      table.monthPhase,
    ),
  ],
)

export const platformCostCommissionDeriveDeptPhase = pgTable(
  "platform_cost_commission_derive_dept_phase",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => platformCostCommissionDeriveRun.id, { onDelete: "cascade" }),
    recipientDept: varchar("recipient_dept", { length: 32 }).notNull(),
    monthPhase: varchar("month_phase", { length: 32 }).notNull(),
    grossProfitBaseSum: money("gross_profit_base_sum").notNull().default("0"),
    commissionPoolSum: money("commission_pool_sum").notNull().default("0"),
    projectCount: integer("project_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("platform_cost_commission_derive_dept_phase_run_dept_phase_uk").on(
      table.runId,
      table.recipientDept,
      table.monthPhase,
    ),
  ],
)

export const platformCostCommissionDeriveIssue = pgTable(
  "platform_cost_commission_derive_issue",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => platformCostCommissionDeriveRun.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => crmProject.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 64 }).notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("platform_cost_commission_derive_issue_run_project_code_uk").on(
      table.runId,
      table.projectId,
      table.code,
    ),
    index("platform_cost_commission_derive_issue_run_idx").on(table.runId),
  ],
)

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const billingPeriodRelations = relations(billingPeriod, ({ one, many }) => ({
  importBatches: many(billingPeriodImportBatch),
  tenantBillWindows: many(billingPeriodTenantBillWindow),
  aggCustomerConsumptions: many(billingPeriodAggCustomerConsumption),
  tenantProjectEnrichments: many(billingPeriodTenantProjectEnrichment),
  tenantCostAllocations: many(billingTenantCostAllocation),
  incomeRows: many(platformIncomeMonthly),
  costRows: many(platformCostMonthly),
  costSourceLines: many(billingPeriodCostSourceLine),
  costPricingSnapshots: many(billingPeriodCostPricingSnapshot),
  reconciliationReport: one(billingPeriodReconciliationReport),
  operationLogs: many(billingPeriodOperationLog),
  personalIncomeSummaries: many(billingPeriodPersonalIncomeSummary),
  commissionDeriveRuns: many(platformCostCommissionDeriveRun),
}))

export const billingPeriodPersonalIncomeSummaryRelations = relations(
  billingPeriodPersonalIncomeSummary,
  ({ one }) => ({
    billingPeriod: one(billingPeriod, {
      fields: [billingPeriodPersonalIncomeSummary.billingPeriodId],
      references: [billingPeriod.id],
    }),
    tenantBillBatch: one(billingPeriodImportBatch, {
      fields: [billingPeriodPersonalIncomeSummary.tenantBillBatchId],
      references: [billingPeriodImportBatch.id],
      relationName: "personalSummaryTenantBillBatch",
    }),
    baremetalBatch: one(billingPeriodImportBatch, {
      fields: [billingPeriodPersonalIncomeSummary.baremetalBatchId],
      references: [billingPeriodImportBatch.id],
      relationName: "personalSummaryBaremetalBatch",
    }),
  }),
)

export const billingPeriodTenantBillWindowRelations = relations(
  billingPeriodTenantBillWindow,
  ({ one, many }) => ({
    billingPeriod: one(billingPeriod, {
      fields: [billingPeriodTenantBillWindow.billingPeriodId],
      references: [billingPeriod.id],
    }),
    importBatches: many(billingPeriodImportBatch),
  }),
)

export const billingPeriodImportBatchRelations = relations(
  billingPeriodImportBatch,
  ({ one, many }) => ({
    billingPeriod: one(billingPeriod, {
      fields: [billingPeriodImportBatch.billingPeriodId],
      references: [billingPeriod.id],
    }),
    tenantBillWindow: one(billingPeriodTenantBillWindow, {
      fields: [billingPeriodImportBatch.windowId],
      references: [billingPeriodTenantBillWindow.id],
    }),
    customerConsumptionRows: many(billingPeriodRawCustomerConsumption),
    baremetalOrderRows: many(billingPeriodRawBaremetalOrder),
    tenantBillRows: many(billingPeriodRawTenantBill),
  }),
)

export const platformIncomeMonthlyRelations = relations(
  platformIncomeMonthly,
  ({ one, many }) => ({
    billingPeriod: one(billingPeriod, {
      fields: [platformIncomeMonthly.billingPeriodId],
      references: [billingPeriod.id],
    }),
    tenant: one(billingTenant, {
      fields: [platformIncomeMonthly.tenantId],
      references: [billingTenant.id],
    }),
    supplementaryHistories: many(supplementaryConsumptionHistory),
    adjustmentHistories: many(incomeAdjustmentHistory),
  }),
)

export const platformCostMonthlyRelations = relations(platformCostMonthly, ({ one, many }) => ({
  billingPeriod: one(billingPeriod, {
    fields: [platformCostMonthly.billingPeriodId],
    references: [billingPeriod.id],
  }),
  staff: one(userStaff, {
    fields: [platformCostMonthly.staffId],
    references: [userStaff.id],
  }),
  dataCenter: one(dataCenter, {
    fields: [platformCostMonthly.dataCenterId],
    references: [dataCenter.id],
  }),
  gpuCardType: one(gpuCardType, {
    fields: [platformCostMonthly.gpuCardTypeId],
    references: [gpuCardType.id],
  }),
  supplierUnitCost: one(supplierUnitCost, {
    fields: [platformCostMonthly.supplierUnitCostId],
    references: [supplierUnitCost.id],
  }),
  pricingSnapshot: one(billingPeriodCostPricingSnapshot, {
    fields: [platformCostMonthly.pricingSnapshotId],
    references: [billingPeriodCostPricingSnapshot.id],
  }),
  voucherCardHoursHistories: many(voucherCardHoursAdjustmentHistory),
}))

export const billingPeriodCostSourceLineRelations = relations(
  billingPeriodCostSourceLine,
  ({ one }) => ({
    billingPeriod: one(billingPeriod, {
      fields: [billingPeriodCostSourceLine.billingPeriodId],
      references: [billingPeriod.id],
    }),
    tenant: one(billingTenant, {
      fields: [billingPeriodCostSourceLine.tenantId],
      references: [billingTenant.id],
    }),
    staff: one(userStaff, {
      fields: [billingPeriodCostSourceLine.staffId],
      references: [userStaff.id],
    }),
    dataCenter: one(dataCenter, {
      fields: [billingPeriodCostSourceLine.dataCenterId],
      references: [dataCenter.id],
    }),
    gpuCardType: one(gpuCardType, {
      fields: [billingPeriodCostSourceLine.gpuCardTypeId],
      references: [gpuCardType.id],
    }),
    supplierUnitCost: one(supplierUnitCost, {
      fields: [billingPeriodCostSourceLine.supplierUnitCostId],
      references: [supplierUnitCost.id],
    }),
    supplierPricingRecord: one(supplierPricingRecord, {
      fields: [billingPeriodCostSourceLine.supplierPricingRecordId],
      references: [supplierPricingRecord.id],
    }),
    window: one(billingPeriodTenantBillWindow, {
      fields: [billingPeriodCostSourceLine.windowId],
      references: [billingPeriodTenantBillWindow.id],
    }),
  }),
)

export const billingPeriodCostPricingSnapshotRelations = relations(
  billingPeriodCostPricingSnapshot,
  ({ one }) => ({
    billingPeriod: one(billingPeriod, {
      fields: [billingPeriodCostPricingSnapshot.billingPeriodId],
      references: [billingPeriod.id],
    }),
    window: one(billingPeriodTenantBillWindow, {
      fields: [billingPeriodCostPricingSnapshot.windowId],
      references: [billingPeriodTenantBillWindow.id],
    }),
    dataCenter: one(dataCenter, {
      fields: [billingPeriodCostPricingSnapshot.dataCenterId],
      references: [dataCenter.id],
    }),
    gpuCardType: one(gpuCardType, {
      fields: [billingPeriodCostPricingSnapshot.gpuCardTypeId],
      references: [gpuCardType.id],
    }),
    supplierUnitCost: one(supplierUnitCost, {
      fields: [billingPeriodCostPricingSnapshot.supplierUnitCostId],
      references: [supplierUnitCost.id],
    }),
    supplierPricingRecord: one(supplierPricingRecord, {
      fields: [billingPeriodCostPricingSnapshot.supplierPricingRecordId],
      references: [supplierPricingRecord.id],
    }),
  }),
)

export const billingTenantCostAllocationRelations = relations(
  billingTenantCostAllocation,
  ({ one }) => ({
    billingPeriod: one(billingPeriod, {
      fields: [billingTenantCostAllocation.billingPeriodId],
      references: [billingPeriod.id],
    }),
    tenant: one(billingTenant, {
      fields: [billingTenantCostAllocation.tenantId],
      references: [billingTenant.id],
    }),
    project: one(crmProject, {
      fields: [billingTenantCostAllocation.projectId],
      references: [crmProject.id],
    }),
    preset: one(tenantProjectCost, {
      fields: [billingTenantCostAllocation.presetId],
      references: [tenantProjectCost.id],
    }),
  }),
)

export const billingPeriodReconciliationReportRelations = relations(
  billingPeriodReconciliationReport,
  ({ one }) => ({
    billingPeriod: one(billingPeriod, {
      fields: [billingPeriodReconciliationReport.billingPeriodId],
      references: [billingPeriod.id],
    }),
  }),
)

export const billingPeriodOperationLogRelations = relations(
  billingPeriodOperationLog,
  ({ one }) => ({
    billingPeriod: one(billingPeriod, {
      fields: [billingPeriodOperationLog.billingPeriodId],
      references: [billingPeriod.id],
    }),
    actor: one(userStaff, {
      fields: [billingPeriodOperationLog.actorId],
      references: [userStaff.id],
    }),
  }),
)

export const tenantProjectCostRelations = relations(tenantProjectCost, ({ one }) => ({
  tenant: one(billingTenant, {
    fields: [tenantProjectCost.tenantId],
    references: [billingTenant.id],
  }),
  project: one(crmProject, {
    fields: [tenantProjectCost.projectId],
    references: [crmProject.id],
  }),
}))

// ---------------------------------------------------------------------------
// 类型导出
// ---------------------------------------------------------------------------

export type BillingPeriodRow = typeof billingPeriod.$inferSelect
export type NewBillingPeriodRow = typeof billingPeriod.$inferInsert
export type PlatformIncomeMonthlyRow = typeof platformIncomeMonthly.$inferSelect
export type PlatformCostMonthlyRow = typeof platformCostMonthly.$inferSelect
export type BillingPeriodCostSourceLineRow = typeof billingPeriodCostSourceLine.$inferSelect
export type BillingPeriodCostPricingSnapshotRow =
  typeof billingPeriodCostPricingSnapshot.$inferSelect
export type BillingPeriodImportBatchRow = typeof billingPeriodImportBatch.$inferSelect
export type BillingPeriodTenantBillWindowRow = typeof billingPeriodTenantBillWindow.$inferSelect
export type BillingPeriodRawCustomerConsumptionRow =
  typeof billingPeriodRawCustomerConsumption.$inferSelect
export type BillingPeriodAggCustomerConsumptionRow =
  typeof billingPeriodAggCustomerConsumption.$inferSelect
export type BillingPeriodRawBaremetalOrderRow =
  typeof billingPeriodRawBaremetalOrder.$inferSelect
export type BillingPeriodRawTenantBillRow = typeof billingPeriodRawTenantBill.$inferSelect
export type BillingPeriodTenantProjectEnrichmentRow =
  typeof billingPeriodTenantProjectEnrichment.$inferSelect
export type BillingTenantCostAllocationRow = typeof billingTenantCostAllocation.$inferSelect
export type TenantProjectCostRow = typeof tenantProjectCost.$inferSelect
export type BillingPeriodReconciliationReportRow =
  typeof billingPeriodReconciliationReport.$inferSelect
export type BillingPeriodOperationLogRow = typeof billingPeriodOperationLog.$inferSelect
export type BillingPeriodPersonalIncomeSummaryRow =
  typeof billingPeriodPersonalIncomeSummary.$inferSelect
export type PlatformCostCommissionDeriveRunRow =
  typeof platformCostCommissionDeriveRun.$inferSelect
export type PlatformCostCommissionDeriveProjectRow =
  typeof platformCostCommissionDeriveProject.$inferSelect
export type PlatformCostCommissionDeriveLineRow =
  typeof platformCostCommissionDeriveLine.$inferSelect
export type PersonalIncomeSummaryKind = "non_project" | "blacklist"
