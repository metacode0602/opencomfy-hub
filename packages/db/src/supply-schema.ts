/**
 * 供应商与算力资源域表结构（Drizzle ORM / PostgreSQL）
 *
 * 设计依据：apps/web/content/design/supplier-database.md（v1.2）、
 *   supplier-onboarding-plan-changelog-tracking-design.md（v2.2）、
 *   supplier-device-import-schema.md（v1.1）
 * 领域模型：Supplier → DataCenter → Device / GPU Inventory；合同与刊例价/成交价；接入批次
 *
 * 约定：
 * - 主键 text；金额 numeric(15,4)；比例 numeric(9,6)；扩展 jsonb
 * - 聚合字段（机房数、设备总数、月结算额等）不入库
 * - 员工 FK 复用 CRM `user_staff`
 */

import { relations, sql } from "drizzle-orm"
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core"

import { userStaff } from "./crm-schema"

/** 金额 decimal(15,4) */
const money = (name: string) => numeric(name, { precision: 15, scale: 4 })

/** 成交/刊例比例 decimal(9,6) */
const priceRatio = (name: string) => numeric(name, { precision: 9, scale: 6 })

const supplyTimestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}

// ---------------------------------------------------------------------------
// §3.1 主数据
// ---------------------------------------------------------------------------

export const supplier = pgTable(
  "supplier",
  {
    id: text("id").primaryKey(),
    externalTenantId: text("external_tenant_id").notNull(), // 租户ID，对应外部平台的租户ID
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    shortName: varchar("short_name", { length: 64 }).notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    defaultCooperationMode: varchar("default_cooperation_mode", { length: 32 }),
    defaultRevenueSharePercent: numeric("default_revenue_share_percent", {
      precision: 7,
      scale: 4,
    }),
    businessManagerStaffId: text("business_manager_staff_id").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    contactPerson: varchar("contact_person", { length: 128 }),
    contactPhone: varchar("contact_phone", { length: 32 }),
    contactEmail: varchar("contact_email", { length: 255 }),
    address: text("address"),
    bankName: varchar("bank_name", { length: 255 }),
    source: varchar("source", { length: 64 }).notNull().default("import"), // import api导入 / manual 手动
    bankAccount: varchar("bank_account", { length: 64 }),
    externalOnboardingId: varchar("external_onboarding_id", { length: 64 }),
    platformTenantId: varchar("platform_tenant_id", { length: 32 }),
    onboardingType: varchar("onboarding_type", { length: 16 }),
    identityNo: varchar("identity_no", { length: 32 }),
    businessScope: text("business_scope"),
    businessLicenseUri: varchar("business_license_uri", { length: 1024 }),
    idCardFrontUri: varchar("id_card_front_uri", { length: 1024 }),
    idCardBackUri: varchar("id_card_back_uri", { length: 1024 }),
    bankBranchName: varchar("bank_branch_name", { length: 255 }),
    bankBranchAddress: text("bank_branch_address"),
    adminPhone: varchar("admin_phone", { length: 32 }),
    adminEmail: varchar("admin_email", { length: 255 }),
    deviceInfoRaw: text("device_info_raw"),
    auditStatus: varchar("audit_status", { length: 32 }),
    auditConfirmed: boolean("audit_confirmed").notNull().default(false),
    auditRemark: text("audit_remark"),
    ...supplyTimestamps,
  },
  (table) => [
    uniqueIndex("supplier_code_uk").on(table.code),
    uniqueIndex("supplier_external_tenant_id_uk").on(table.externalTenantId),
    uniqueIndex("supplier_external_onboarding_id_uk").on(table.externalOnboardingId),
    uniqueIndex("supplier_platform_tenant_id_uk").on(table.platformTenantId),
    index("supplier_status_idx").on(table.status),
    index("supplier_business_manager_staff_id_idx").on(table.businessManagerStaffId),
    index("supplier_identity_no_idx").on(table.identityNo),
  ],
)

/** 供应商运维工程师通讯录 */
export const supplierOpsEngineer = pgTable(
  "supplier_ops_engineer",
  {
    id: text("id").primaryKey(),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => supplier.id, { onDelete: "cascade" }), // 供应商ID
    dataCenterId: text("data_center_id")
      .notNull()
      .references(() => dataCenter.id, { onDelete: "cascade" }), // 数据中心ID
    name: varchar("name", { length: 128 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    email: varchar("email", { length: 255 }),
    wechatId: varchar("wechat_id", { length: 128 }),
    sortOrder: integer("sort_order").notNull().default(0),
    ...supplyTimestamps,
  },
  (table) => [
    index("supplier_ops_engineer_supplier_id_idx").on(table.supplierId),
    index("supplier_ops_engineer_data_center_id_idx").on(table.dataCenterId),
    index("supplier_ops_engineer_data_center_sort_idx").on(table.dataCenterId, table.sortOrder),
  ],
)

export const gpuCardType = pgTable(
  "gpu_card_type",
  {
    id: text("id").primaryKey(),
    name: varchar("name", { length: 128 }).notNull(), // 卡型名称
    code: varchar("code", { length: 64 }).notNull().unique(), // 卡型编码
    manufacturer: varchar("manufacturer", { length: 32 }).notNull(), // 制造商
    memoryGb: integer("memory_gb"), // 内存容量（GB）
    tdpWatts: integer("tdp_watts"), // 功耗（瓦）
    computeCapability: varchar("compute_capability", { length: 64 }), // 计算能力
    /** compute=算力卡型；infra=管控/存储等无 GPU 卡型 */
    deviceRole: varchar("device_role", { length: 16 }).notNull().default("compute"),
    status: varchar("status", { length: 32 }).notNull(), // 状态
    ...supplyTimestamps,
  },
  (table) => [uniqueIndex("gpu_card_type_name_uk").on(table.name)],
)

export const dataCenter = pgTable(
  "data_center",
  {
    id: text("id").primaryKey(),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => supplier.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    location: varchar("location", { length: 128 }),
    regionTags: text("region_tags").array().notNull().default([]),
    address: text("address"),
    status: varchar("status", { length: 32 }).notNull(),
    networkFeeMonthly: money("network_fee_monthly").notNull().default("0"),
    mgmtNodeFeeMonthly: money("mgmt_node_fee_monthly").notNull().default("0"),
    externalOnboardingId: varchar("external_onboarding_id", { length: 64 }),
    platformTenantId: varchar("platform_tenant_id", { length: 32 }),
    containerInstanceRegion: varchar("container_instance_region", { length: 128 }),
    bareMetalRegion: varchar("bare_metal_region", { length: 128 }),
    description: text("description"),
    scale: varchar("scale", { length: 64 }),
    publicIpCount: integer("public_ip_count"),
    internalNetworkCidr: varchar("internal_network_cidr", { length: 64 }),
    auditStatus: varchar("audit_status", { length: 32 }),
    auditRemark: text("audit_remark"),
    sourceDeleted: boolean("source_deleted").notNull().default(false),
    ...supplyTimestamps,
  },
  (table) => [
    uniqueIndex("data_center_supplier_code_uk").on(table.supplierId, table.code),
    index("data_center_supplier_id_idx").on(table.supplierId),
    index("data_center_status_idx").on(table.status),
    index("data_center_supplier_external_onboarding_id_idx").on(
      table.supplierId,
      table.externalOnboardingId,
    ),
  ],
)

// ---------------------------------------------------------------------------
// §3.2 商务合同与条款
// ---------------------------------------------------------------------------

export const supplierCardListPrice = pgTable(
  "supplier_card_list_price",
  {
    id: text("id").primaryKey(),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => supplier.id, { onDelete: "restrict" }),
    dataCenterId: text("data_center_id")
      .notNull()
      .references(() => dataCenter.id, { onDelete: "restrict" }),
    gpuCardTypeId: text("gpu_card_type_id")
      .notNull()
      .references(() => gpuCardType.id, { onDelete: "restrict" }),
    listPricePerHour: money("list_price_per_hour").notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("CNY"),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    source: varchar("source", { length: 64 }),
    remark: text("remark"),
    ...supplyTimestamps,
  },
  (table) => [
    uniqueIndex("supplier_card_list_price_current_uk")
      .on(table.supplierId, table.dataCenterId, table.gpuCardTypeId)
      .where(sql`${table.effectiveTo} IS NULL`),
    index("supplier_card_list_price_supplier_id_idx").on(table.supplierId),
    index("supplier_card_list_price_dc_card_idx").on(table.dataCenterId, table.gpuCardTypeId),
  ],
)

export const supplierContract = pgTable(
  "supplier_contract",
  {
    id: text("id").primaryKey(),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => supplier.id, { onDelete: "restrict" }),
    contractNo: varchar("contract_no", { length: 64 }).notNull(),
    type: varchar("type", { length: 32 }).notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    pricingMode: varchar("pricing_mode", { length: 32 }).notNull(),
    tierBasis: varchar("tier_basis", { length: 32 }),
    cooperationMode: varchar("cooperation_mode", { length: 32 }).notNull(),
    unitPricePerHour: money("unit_price_per_hour"),
    revenueSharePercent: numeric("revenue_share_percent", { precision: 7, scale: 4 }),
    listPricePerHour: money("list_price_per_hour"),
    dealToListRatio: priceRatio("deal_to_list_ratio"),
    minCommitHours: money("min_commit_hours"),
    settlementCycle: varchar("settlement_cycle", { length: 32 }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    terms: text("terms"),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    signerName: varchar("signer_name", { length: 128 }),
    contractFileUri: varchar("contract_file_uri", { length: 1024 }),
    ...supplyTimestamps,
  },
  (table) => [
    uniqueIndex("supplier_contract_no_uk").on(table.contractNo),
    index("supplier_contract_supplier_id_idx").on(table.supplierId),
    index("supplier_contract_status_idx").on(table.status),
    index("supplier_contract_pricing_mode_idx").on(table.pricingMode),
  ],
)

export const supplierPricingTier = pgTable(
  "supplier_pricing_tier",
  {
    id: text("id").primaryKey(),
    contractId: text("contract_id")
      .notNull()
      .references(() => supplierContract.id, { onDelete: "cascade" }),
    supplierCardListPriceId: text("supplier_card_list_price_id").references(
      () => supplierCardListPrice.id,
      { onDelete: "set null" },
    ),
    tierOrder: integer("tier_order").notNull(),
    listPriceMultiplier: priceRatio("list_price_multiplier"),
    dealToListRatioMin: priceRatio("deal_to_list_ratio_min"),
    dealToListRatioMax: priceRatio("deal_to_list_ratio_max"),
    dealUnitPricePerHour: money("deal_unit_price_per_hour"),
    revenueSharePercent: numeric("revenue_share_percent", { precision: 7, scale: 4 }),
    remark: varchar("remark", { length: 255 }),
  },
  (table) => [
    uniqueIndex("supplier_pricing_tier_uk").on(
      table.contractId,
      table.tierOrder,
      table.supplierCardListPriceId,
    ),
  ],
)

export const supplierTermsVersion = pgTable(
  "supplier_terms_version",
  {
    id: text("id").primaryKey(),
    supplierId: text("supplier_id").references(() => supplier.id, { onDelete: "cascade" }),
    contractId: text("contract_id").references(() => supplierContract.id, { onDelete: "cascade" }),
    dealMode: varchar("deal_mode", { length: 64 }).notNull(),
    termsJson: jsonb("terms_json").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("supplier_terms_version_supplier_id_idx").on(table.supplierId),
    index("supplier_terms_version_contract_id_idx").on(table.contractId),
  ],
)
// 供应商机房×卡型成本
export const supplierUnitCost = pgTable(
  "supplier_unit_cost",
  {
    id: text("id").primaryKey(),
    supplierTermsVersionId: text("supplier_terms_version_id")
      .notNull()
      .references(() => supplierTermsVersion.id, { onDelete: "restrict" }),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => supplier.id, { onDelete: "restrict" }),
    dataCenterId: text("data_center_id")
      .notNull()
      .references(() => dataCenter.id, { onDelete: "restrict" }),
    gpuCardTypeId: text("gpu_card_type_id")
      .notNull()
      .references(() => gpuCardType.id, { onDelete: "restrict" }),
    supplierCardListPriceId: text("supplier_card_list_price_id")
      .notNull()
      .references(() => supplierCardListPrice.id, { onDelete: "restrict" }),
    listPricePerHour: money("list_price_per_hour").notNull(),
    dealUnitPricePerHour: money("deal_unit_price_per_hour"),
    dealToListRatio: priceRatio("deal_to_list_ratio"),
    unitCost: money("unit_cost"),
    revenueSharePercent: numeric("revenue_share_percent", { precision: 7, scale: 4 }),
    tierJson: jsonb("tier_json"),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    ...supplyTimestamps,
  },
  (table) => [
    uniqueIndex("supplier_unit_cost_current_uk")
      .on(table.supplierTermsVersionId, table.dataCenterId, table.gpuCardTypeId)
      .where(sql`${table.effectiveTo} IS NULL`),
  ],
)

// 供应商机房×卡型定价记录
export const supplierPricingRecord = pgTable(
  "supplier_pricing_record",
  {
    id: text("id").primaryKey(),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => supplier.id, { onDelete: "restrict" }),
    dataCenterId: text("data_center_id")
      .notNull()
      .references(() => dataCenter.id, { onDelete: "restrict" }),
    gpuCardTypeId: text("gpu_card_type_id")
      .notNull()
      .references(() => gpuCardType.id, { onDelete: "restrict" }),
    supplierUnitCostId: text("supplier_unit_cost_id").references(() => supplierUnitCost.id, {
      onDelete: "set null",
    }),
    supplierCardListPriceId: text("supplier_card_list_price_id").references(
      () => supplierCardListPrice.id,
      { onDelete: "set null" },
    ),
    pricingMode: varchar("pricing_mode", { length: 32 }).notNull(),
    /** active 可用 / unavailable 不可用（导入占位，单价为 0） */
    configStatus: varchar("config_status", { length: 32 }).notNull().default("active"),
    listPricePerHour: money("list_price_per_hour"),
    unitPricePerHour: money("unit_price_per_hour"),
    /** hour=卡时价 / month=整租月租（元/台/月） */
    billingUnit: varchar("billing_unit", { length: 16 }).notNull().default("hour"),
    unitPrice: money("unit_price"),
    cardsPerMachine: integer("cards_per_machine").default(8),
    dealToListRatio: priceRatio("deal_to_list_ratio"),
    revenueSharePercent: numeric("revenue_share_percent", { precision: 7, scale: 4 }),
    pricingTiers: jsonb("pricing_tiers"),
    effectiveFrom: timestamp("effective_from", { mode: "string", precision: 0 }).notNull(),
    effectiveTo: timestamp("effective_to", { mode: "string", precision: 0 }),
    updatedByStaffId: text("updated_by_staff_id").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("supplier_pricing_record_uk").on(
      table.supplierId,
      table.dataCenterId,
      table.gpuCardTypeId,
    ),
  ],
)

export const supplierPricingHistory = pgTable(
  "supplier_pricing_history",
  {
    id: text("id").primaryKey(),
    pricingRecordId: text("pricing_record_id")
      .notNull()
      .references(() => supplierPricingRecord.id, { onDelete: "cascade" }),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => supplier.id, { onDelete: "restrict" }),
    dataCenterId: text("data_center_id")
      .notNull()
      .references(() => dataCenter.id, { onDelete: "restrict" }),
    gpuCardTypeId: text("gpu_card_type_id")
      .notNull()
      .references(() => gpuCardType.id, { onDelete: "restrict" }),
    pricingMode: varchar("pricing_mode", { length: 32 }).notNull(),
    previousListPricePerHour: money("previous_list_price_per_hour"),
    newListPricePerHour: money("new_list_price_per_hour"),
    previousUnitPricePerHour: money("previous_unit_price_per_hour"),
    newUnitPricePerHour: money("new_unit_price_per_hour"),
    previousBillingUnit: varchar("previous_billing_unit", { length: 16 }),
    newBillingUnit: varchar("new_billing_unit", { length: 16 }),
    previousUnitPrice: money("previous_unit_price"),
    newUnitPrice: money("new_unit_price"),
    previousCardsPerMachine: integer("previous_cards_per_machine"),
    newCardsPerMachine: integer("new_cards_per_machine"),
    previousDealToListRatio: priceRatio("previous_deal_to_list_ratio"),
    newDealToListRatio: priceRatio("new_deal_to_list_ratio"),
    previousRevenueSharePercent: numeric("previous_revenue_share_percent", {
      precision: 7,
      scale: 4,
    }),
    newRevenueSharePercent: numeric("new_revenue_share_percent", { precision: 7, scale: 4 }),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull(),
    changedByStaffId: text("changed_by_staff_id")
      .notNull()
      .references(() => userStaff.id, { onDelete: "restrict" }),
    reason: text("reason"),
  },
  (table) => [
    index("supplier_pricing_history_record_changed_idx").on(
      table.pricingRecordId,
      table.changedAt,
    ),
  ],
)

// ---------------------------------------------------------------------------
// §3.3 接入条件与批次
// ---------------------------------------------------------------------------

export const accessConditionSheet = pgTable(
  "access_condition_sheet",
  {
    id: text("id").primaryKey(),
    contractId: text("contract_id")
      .notNull()
      .references(() => supplierContract.id, { onDelete: "cascade" }),
    versionNo: integer("version_no").notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
    gpuNetworkCpuTerms: jsonb("gpu_network_cpu_terms").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("access_condition_sheet_contract_version_uk").on(
      table.contractId,
      table.versionNo,
    ),
    uniqueIndex("access_condition_sheet_current_uk")
      .on(table.contractId)
      .where(sql`${table.isCurrent} = true`),
  ],
)

export const onboardingBatch = pgTable(
  "onboarding_batch",
  {
    id: text("id").primaryKey(),
    batchKind: varchar("batch_kind", { length: 32 }).notNull(),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => supplier.id, { onDelete: "restrict" }),
    supplierCode: varchar("supplier_code", { length: 64 }).notNull(),
    supplierName: varchar("supplier_name", { length: 255 }).notNull(),
    supplierShortName: varchar("supplier_short_name", { length: 64 }),
    dataCenterId: text("data_center_id")
      .notNull()
      .references(() => dataCenter.id, { onDelete: "restrict" }),
    idcCode: varchar("idc_code", { length: 64 }).notNull(),
    dataCenterName: varchar("data_center_name", { length: 255 }).notNull(),
    idcRegion: varchar("idc_region", { length: 64 }),
    contractId: text("contract_id").references(() => supplierContract.id, {
      onDelete: "restrict",
    }),
    accessConditionSheetId: text("access_condition_sheet_id").references(
      () => accessConditionSheet.id,
      { onDelete: "restrict" },
    ),
    batchCode: varchar("batch_code", { length: 64 }).notNull(),
    batchStatus: varchar("batch_status", { length: 32 }).notNull(),
    plannedReadyAt: timestamp("planned_ready_at", { withTimezone: true }),
    /** 上架计划明细（卡型 + 合作类型 + 数量） */
    plannedLinesJson: jsonb("planned_lines_json").notNull().default([]),
    plannedDeviceCount: integer("planned_device_count").notNull().default(0),
    /** 计划 GPU 卡数（创建/修订批次时按 plan_lines × 默认卡/台 持久化） */
    plannedGpuCount: integer("planned_gpu_count").notNull().default(0),
    listUploadMode: varchar("list_upload_mode", { length: 32 }).notNull().default("none"),
    /** 飞书审批工单号（商务手动录入）；业务批次必填，supplier 内唯一 */
    workOrderNo: varchar("work_order_no", { length: 64 }),
    /** 变更/关联触达去重台数（refreshBatchProgress 刷新） */
    touchedDeviceCount: integer("touched_device_count").notNull().default(0),
    /** 触达且 lifecycle=在线 台数 */
    onlineDeviceCount: integer("online_device_count").notNull().default(0),
    progressSyncedAt: timestamp("progress_synced_at", { withTimezone: true }),
    onlineReason: varchar("online_reason", { length: 64 }), /** 上架原因（`batch_kind=online` 时填写） */
    orderNo: varchar("order_no", { length: 128 }), /** 关联订单编号（`batch_kind=order_access` 时填写） */
    remark: text("remark"),
    /** 导入批次指向业务批次；仅 device_inventory / device_changelog */
    parentBatchId: text("parent_batch_id").references((): AnyPgColumn => onboardingBatch.id, {
      onDelete: "set null",
    }),
    accessMethod: varchar("access_method", { length: 32 }).notNull(), /** 接入方式 */
    importFileName: varchar("import_file_name", { length: 255 }),
    importFileUri: varchar("import_file_uri", { length: 1024 }),
    importFileMimeType: varchar("import_file_mime_type", { length: 128 }),
    importFileSizeBytes: bigint("import_file_size_bytes", { mode: "number" }),
    importStatus: varchar("import_status", { length: 32 }).notNull().default("draft"),
    parseError: text("parse_error"),
    parsedRowCount: integer("parsed_row_count").notNull().default(0),
    parsedSuccessCount: integer("parsed_success_count").notNull().default(0),
    parsedRowsJson: jsonb("parsed_rows_json"),
    parsedAt: timestamp("parsed_at", { withTimezone: true }),
    committedDeviceCount: integer("committed_device_count").notNull().default(0),
    committedAt: timestamp("committed_at", { withTimezone: true }),
    retireReason: varchar("retire_reason", { length: 64 }),
    /** device_unsubscribe | bare_metal_offboard */
    retireActionType: varchar("retire_action_type", { length: 32 }),
    /** line_plan | datacenter_closure */
    retirePlanMode: varchar("retire_plan_mode", { length: 32 }),
    expectedCompletionDate: date("expected_completion_date"),
    retireRemark: text("retire_remark"),
    retiredDeviceCount: integer("retired_device_count").notNull().default(0),
    /** 自动结案 / 动作不一致 / 超额挂接等排查标记 */
    progressFlagsJson: jsonb("progress_flags_json"),
    createdByStaffId: text("created_by_staff_id").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    ...supplyTimestamps,
  },
  (table) => [
    uniqueIndex("onboarding_batch_code_uk").on(table.batchCode),
    index("onboarding_batch_supplier_id_idx").on(table.supplierId),
    index("onboarding_batch_data_center_id_idx").on(table.dataCenterId),
    index("onboarding_batch_idc_code_idx").on(table.idcCode),
    index("onboarding_batch_contract_id_idx").on(table.contractId),
    index("onboarding_batch_status_idx").on(table.batchStatus),
    index("onboarding_batch_import_status_idx").on(table.importStatus),
    index("onboarding_batch_supplier_dc_created_idx").on(
      table.supplierId,
      table.dataCenterId,
      table.createdAt,
    ),
    index("onboarding_batch_work_order_no_idx").on(table.workOrderNo),
    uniqueIndex("onboarding_batch_supplier_work_order_uk")
      .on(table.supplierId, table.workOrderNo)
      .where(sql`${table.workOrderNo} IS NOT NULL`),
    index("onboarding_batch_parent_batch_id_idx").on(table.parentBatchId),
  ],
)

/** 上架计划明细行（卡型 × 合作类型 × 数量）；与 planned_lines_json 二选一或双写 */
export const onboardingBatchPlanLine = pgTable(
  "onboarding_batch_plan_line",
  {
    id: text("id").primaryKey(),
    onboardingBatchId: text("onboarding_batch_id")
      .notNull()
      .references(() => onboardingBatch.id, { onDelete: "cascade" }),
    gpuCardTypeId: text("gpu_card_type_id")
      .notNull()
      .references(() => gpuCardType.id, { onDelete: "restrict" }),
    cooperationType: varchar("cooperation_type", { length: 32 }).notNull(),
    plannedQuantity: integer("planned_quantity").notNull(),
    touchedQuantity: integer("touched_quantity").notNull().default(0),
    onlineQuantity: integer("online_quantity").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("onboarding_batch_plan_line_uk").on(
      table.onboardingBatchId,
      table.gpuCardTypeId,
      table.cooperationType,
    ),
    index("onboarding_batch_plan_line_batch_id_idx").on(table.onboardingBatchId),
  ],
)

/** 批次计划/触达/终态不可变事件日志（Period 计划卡时阶梯积分权威时序） */
export const onboardingBatchProgressEvent = pgTable(
  "onboarding_batch_progress_event",
  {
    id: text("id").primaryKey(),
    onboardingBatchId: text("onboarding_batch_id")
      .notNull()
      .references(() => onboardingBatch.id, { onDelete: "cascade" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    eventType: varchar("event_type", { length: 32 }).notNull(),
    batchKind: varchar("batch_kind", { length: 32 }).notNull(),
    batchStatus: varchar("batch_status", { length: 32 }).notNull(),
    plannedDeviceCount: integer("planned_device_count").notNull(),
    plannedGpuCount: integer("planned_gpu_count").notNull(),
    touchedDeviceCount: integer("touched_device_count").notNull(),
    touchedPipelineGpu: integer("touched_pipeline_gpu").notNull(),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => supplier.id, { onDelete: "restrict" }),
    dataCenterId: text("data_center_id").references(() => dataCenter.id, {
      onDelete: "set null",
    }),
    idcRegion: varchar("idc_region", { length: 64 }),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("onboarding_batch_progress_event_batch_occurred_idx").on(
      table.onboardingBatchId,
      table.occurredAt,
    ),
    index("onboarding_batch_progress_event_occurred_idx").on(table.occurredAt),
    index("onboarding_batch_progress_event_kind_occurred_idx").on(
      table.batchKind,
      table.occurredAt,
    ),
    index("onboarding_batch_progress_event_supplier_dc_occurred_idx").on(
      table.supplierId,
      table.dataCenterId,
      table.occurredAt,
    ),
  ],
)

// ---------------------------------------------------------------------------
// §3.4 物理设备与节点（device 需在 import_row / task 之前声明）
// ---------------------------------------------------------------------------

export const supplierDevice = pgTable(
  "supplier_device",
  {
    id: text("id").primaryKey(),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => supplier.id, { onDelete: "restrict" }),
    contractId: text("contract_id").references(() => supplierContract.id, {
      onDelete: "set null",
    }),
    /** 最近一次 device_inventory 导入批次；禁止指向 online/order_access 业务批次 */
    onboardingBatchId: text("onboarding_batch_id").references(() => onboardingBatch.id, {
      onDelete: "set null",
    }),
    dataCenterId: text("data_center_id").references(() => dataCenter.id, {
      onDelete: "set null",
    }),
    gpuCardTypeId: text("gpu_card_type_id")
      .notNull()
      .references(() => gpuCardType.id, { onDelete: "restrict" }),
    externalDeviceId: varchar("external_device_id", { length: 128 }),
    assetNo: varchar("asset_no", { length: 64 }),
    sn: varchar("sn", { length: 64 }).notNull(),
    idcCode: varchar("idc_code", { length: 64 }).notNull(),
    idcRegion: varchar("idc_region", { length: 64 }),
    gpuCount: integer("gpu_count").notNull(),
    externalIp: varchar("external_ip", { length: 45 }),
    internalIp: varchar("internal_ip", { length: 45 }),
    opsStatus: varchar("ops_status", { length: 64 }).notNull().default("预留闲置中"),
    lifecycleStatus: varchar("lifecycle_status", { length: 32 }).notNull(),
    inMaintenance: boolean("in_maintenance").notNull().default(false),
    onboardingSubstage: varchar("onboarding_substage", { length: 64 }),
    bandwidthGroup: varchar("bandwidth_group", { length: 64 }),
    rateLimit: varchar("rate_limit", { length: 64 }),
    /** 闲时合作 idle_time / 整租合作 whole_rent */
    cooperationType: varchar("cooperation_type", { length: 32 }).notNull().default("idle_time"),
    deviceSpec: text("device_spec"),
    /** Excel「设备用途」 */
    devicePurpose: varchar("device_purpose", { length: 255 }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    remark: text("remark"),
    loginUsername: varchar("login_username", { length: 128 }),
    loginPassword: text("login_password"),
    platformResourceId: varchar("platform_resource_id", { length: 128 }),
    ...supplyTimestamps,
  },
  (table) => [
    uniqueIndex("supplier_device_sn_uk").on(table.sn),
    uniqueIndex("supplier_device_asset_no_uk").on(table.assetNo),
    index("supplier_device_supplier_id_idx").on(table.supplierId),
    index("supplier_device_onboarding_batch_id_idx").on(table.onboardingBatchId),
    index("supplier_device_data_center_id_idx").on(table.dataCenterId),
    index("supplier_device_lifecycle_status_idx").on(table.lifecycleStatus),
    index("supplier_device_idc_code_idx").on(table.idcCode),
    index("supplier_device_ops_status_idx").on(table.opsStatus),
    index("supplier_device_in_maintenance_idx").on(table.inMaintenance),
    index("supplier_device_external_device_id_idx").on(table.externalDeviceId),
    index("supplier_device_cooperation_type_idx").on(table.cooperationType),
  ],
)

/** 设备 ↔ 业务接入批次（多对多）；进度统计与批次详情设备列表 */
export const onboardingBatchDeviceLink = pgTable(
  "onboarding_batch_device_link",
  {
    id: text("id").primaryKey(),
    businessOnboardingBatchId: text("business_onboarding_batch_id")
      .notNull()
      .references(() => onboardingBatch.id, { onDelete: "cascade" }),
    supplierDeviceId: text("supplier_device_id")
      .notNull()
      .references(() => supplierDevice.id, { onDelete: "cascade" }),
    linkKind: varchar("link_kind", { length: 32 }).notNull().default("touched"),
    sourceChangeLogId: text("source_change_log_id"),
    sourceChangelogBatchId: text("source_changelog_batch_id").references(() => onboardingBatch.id, {
      onDelete: "set null",
    }),
    gpuCardTypeId: text("gpu_card_type_id")
      .notNull()
      .references(() => gpuCardType.id, { onDelete: "restrict" }),
    cooperationType: varchar("cooperation_type", { length: 32 }).notNull(),
    linkedAt: timestamp("linked_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("onboarding_batch_device_link_uk").on(
      table.businessOnboardingBatchId,
      table.supplierDeviceId,
    ),
    index("onboarding_batch_device_link_batch_id_idx").on(table.businessOnboardingBatchId),
    index("onboarding_batch_device_link_device_linked_idx").on(
      table.supplierDeviceId,
      table.linkedAt,
    ),
    index("onboarding_batch_device_link_batch_card_coop_idx").on(
      table.businessOnboardingBatchId,
      table.gpuCardTypeId,
      table.cooperationType,
    ),
  ],
)

export const onboardingBatchImportRow = pgTable(
  "onboarding_batch_import_row",
  {
    id: text("id").primaryKey(),
    onboardingBatchId: text("onboarding_batch_id")
      .notNull()
      .references(() => onboardingBatch.id, { onDelete: "cascade" }),
    rowNo: integer("row_no").notNull(),
    publicIp: varchar("public_ip", { length: 45 }).notNull(),
    privateIp: varchar("private_ip", { length: 45 }).notNull(),
    rootAccount: varchar("root_account", { length: 128 }).notNull(),
    rootPasswordEnc: text("root_password_enc").notNull(),
    sn: varchar("sn", { length: 64 }),
    assetNo: varchar("asset_no", { length: 64 }),
    gpuCount: integer("gpu_count"),
    gpuCardTypeId: text("gpu_card_type_id").references(() => gpuCardType.id, {
      onDelete: "set null",
    }),
    parseStatus: varchar("parse_status", { length: 32 }).notNull(),
    parseMessage: text("parse_message"),
    supplierDeviceId: text("supplier_device_id").references(() => supplierDevice.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("onboarding_batch_import_row_uk").on(table.onboardingBatchId, table.rowNo),
    index("onboarding_batch_import_row_batch_id_idx").on(table.onboardingBatchId),
    index("onboarding_batch_import_row_parse_status_idx").on(table.parseStatus),
  ],
)

export const onboardingTask = pgTable(
  "onboarding_task",
  {
    id: text("id").primaryKey(),
    onboardingBatchId: text("onboarding_batch_id")
      .notNull()
      .references(() => onboardingBatch.id, { onDelete: "cascade" }),
    supplierDeviceId: text("supplier_device_id").references(() => supplierDevice.id, {
      onDelete: "set null",
    }),
    taskType: varchar("task_type", { length: 64 }).notNull(),
    assigneeStaffId: text("assignee_staff_id")
      .notNull()
      .references(() => userStaff.id, { onDelete: "restrict" }),
    taskStatus: varchar("task_status", { length: 32 }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("onboarding_task_batch_id_idx").on(table.onboardingBatchId)],
)

export const computeNode = pgTable(
  "compute_node",
  {
    id: text("id").primaryKey(),
    supplierDeviceId: text("supplier_device_id")
      .notNull()
      .references(() => supplierDevice.id, { onDelete: "cascade" }),
    nodeRole: varchar("node_role", { length: 32 }).notNull(),
    mgmtIp: varchar("mgmt_ip", { length: 45 }),
    clusterName: varchar("cluster_name", { length: 128 }),
    nodeName: varchar("node_name", { length: 128 }),
    expectedService: varchar("expected_service", { length: 255 }),
    clusterId: varchar("cluster_id", { length: 64 }),
    lifecycleStatus: varchar("lifecycle_status", { length: 32 }).notNull(),
    ...supplyTimestamps,
  },
  (table) => [
    index("compute_node_supplier_device_id_idx").on(table.supplierDeviceId),
    index("compute_node_cluster_id_idx").on(table.clusterId),
  ],
)

export const supplierDeviceChangeLog = pgTable(
  "supplier_device_change_log",
  {
    id: text("id").primaryKey(),
    supplierDeviceId: text("supplier_device_id")
      .notNull()
      .references(() => supplierDevice.id, { onDelete: "cascade" }),
    /** device_changelog 导入批次 */
    onboardingBatchId: text("onboarding_batch_id")
      .notNull()
      .references(() => onboardingBatch.id, { onDelete: "restrict" }),
    /** 由 ticket_no 解析的业务批次（online/order_access） */
    businessOnboardingBatchId: text("business_onboarding_batch_id").references(
      () => onboardingBatch.id,
      { onDelete: "set null" },
    ),
    internalIp: varchar("internal_ip", { length: 45 }),
    /** Excel「设备ID」原文（常为 IP 或外部 ID） */
    externalDeviceId: varchar("external_device_id", { length: 64 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    changeAction: varchar("change_action", { length: 64 }).notNull(),
    changeContent: text("change_content"),
    description: text("description"),
    ticketNo: varchar("ticket_no", { length: 64 }),
    /** Excel「附件」列：逗号分隔文件名，只读展示 */
    attachmentNames: text("attachment_names"),
    importRowNo: integer("import_row_no"),
    previousOpsStatus: varchar("previous_ops_status", { length: 64 }),
    newOpsStatus: varchar("new_ops_status", { length: 64 }),
    previousLifecycleStatus: varchar("previous_lifecycle_status", { length: 32 }),
    newLifecycleStatus: varchar("new_lifecycle_status", { length: 32 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("supplier_device_change_log_batch_row_uk").on(
      table.onboardingBatchId,
      table.importRowNo,
    ),
    index("supplier_device_change_log_device_occurred_idx").on(
      table.supplierDeviceId,
      table.occurredAt,
    ),
    index("supplier_device_change_log_batch_id_idx").on(table.onboardingBatchId),
    index("supplier_device_change_log_ticket_no_idx").on(table.ticketNo),
    index("supplier_device_change_log_business_batch_id_idx").on(table.businessOnboardingBatchId),
    index("supplier_device_change_log_business_device_idx").on(
      table.businessOnboardingBatchId,
      table.supplierDeviceId,
    ),
  ],
)

export const supplierGpuInventory = pgTable(
  "supplier_gpu_inventory",
  {
    id: text("id").primaryKey(),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => supplier.id, { onDelete: "restrict" }),
    dataCenterId: text("data_center_id")
      .notNull()
      .references(() => dataCenter.id, { onDelete: "restrict" }),
    gpuCardTypeId: text("gpu_card_type_id")
      .notNull()
      .references(() => gpuCardType.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(0),
    onlineQuantity: integer("online_quantity").notNull().default(0),
    status: varchar("status", { length: 32 }).notNull(),
    isInternalTest: boolean("is_internal_test").notNull().default(false),
    internalTestScope: varchar("internal_test_scope", { length: 255 }),
    internalTestUntil: timestamp("internal_test_until", { withTimezone: true }),
    cardTimeCostPerHour: money("card_time_cost_per_hour"),
    revenueShareCostPerHour: money("revenue_share_cost_per_hour"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("supplier_gpu_inventory_uk").on(
      table.supplierId,
      table.dataCenterId,
      table.gpuCardTypeId,
    ),
  ],
)

// ---------------------------------------------------------------------------
// §3.5 运维：故障、测试、资源池
// ---------------------------------------------------------------------------

export const faultIncident = pgTable(
  "fault_incident",
  {
    id: text("id").primaryKey(),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => supplier.id, { onDelete: "restrict" }),
    supplierOpsUploadBatchId: text("supplier_ops_upload_batch_id").references(
      () => supplierOpsUploadBatch.id,
      { onDelete: "set null" },
    ),
    supplierDeviceId: text("supplier_device_id").references(() => supplierDevice.id, {
      onDelete: "set null",
    }),
    computeNodeId: text("compute_node_id").references(() => computeNode.id, {
      onDelete: "set null",
    }),
    faultType: varchar("fault_type", { length: 64 }).notNull(),
    severity: varchar("severity", { length: 8 }).notNull().default("P3"),
    incidentStatus: varchar("incident_status", { length: 32 }).notNull(),
    impactMinutes: integer("impact_minutes"),
    impactScope: varchar("impact_scope", { length: 255 }),
    affectedDeviceCount: integer("affected_device_count"),
    postmortem: text("postmortem"),
    resolutionOutcome: text("resolution_outcome"),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("fault_incident_supplier_id_opened_idx").on(table.supplierId, table.openedAt),
    index("fault_incident_supplier_device_id_idx").on(table.supplierDeviceId),
    index("fault_incident_compute_node_id_idx").on(table.computeNodeId),
    index("fault_incident_ops_upload_batch_id_idx").on(table.supplierOpsUploadBatchId),
    index("fault_incident_fault_type_idx").on(table.faultType),
  ],
)

export const internalTestHold = pgTable(
  "internal_test_hold",
  {
    id: text("id").primaryKey(),
    /** 台账登记：供应商 / 机房 */
    supplierId: text("supplier_id").references(() => supplier.id, { onDelete: "restrict" }),
    dataCenterId: text("data_center_id").references(() => dataCenter.id, { onDelete: "restrict" }),
    workOrderNo: varchar("work_order_no", { length: 64 }),
    userName: varchar("user_name", { length: 128 }),
    department: varchar("department", { length: 32 }),
    settlementMode: varchar("settlement_mode", { length: 32 }),
    gpuCardTypeId: text("gpu_card_type_id").references(() => gpuCardType.id, {
      onDelete: "restrict",
    }),
    unitCount: integer("unit_count"),
    remark: text("remark"),
    supplierDeviceId: text("supplier_device_id").references(() => supplierDevice.id, {
      onDelete: "cascade",
    }),
    supplierGpuInventoryId: text("supplier_gpu_inventory_id").references(
      () => supplierGpuInventory.id,
      { onDelete: "cascade" },
    ),
    scope: varchar("scope", { length: 255 }).notNull().default("planned"),
    holdFrom: timestamp("hold_from", { withTimezone: true }).notNull(),
    holdUntil: timestamp("hold_until", { withTimezone: true }),
    /** 关联 internal_occupancy 计划批次；独立登记时为 NULL */
    onboardingBatchId: text("onboarding_batch_id").references(() => onboardingBatch.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("internal_test_hold_supplier_device_id_idx").on(table.supplierDeviceId),
    index("internal_test_hold_inventory_id_idx").on(table.supplierGpuInventoryId),
    index("internal_test_hold_supplier_id_idx").on(table.supplierId),
    index("internal_test_hold_data_center_id_idx").on(table.dataCenterId),
    index("internal_test_hold_work_order_no_idx").on(table.workOrderNo),
    index("internal_test_hold_onboarding_batch_id_idx").on(table.onboardingBatchId),
  ],
)

/** 内部占用台账 ↔ 已录入物理机 */
export const internalTestHoldDeviceLink = pgTable(
  "internal_test_hold_device_link",
  {
    id: text("id").primaryKey(),
    holdId: text("hold_id")
      .notNull()
      .references(() => internalTestHold.id, { onDelete: "cascade" }),
    supplierDeviceId: text("supplier_device_id")
      .notNull()
      .references(() => supplierDevice.id, { onDelete: "cascade" }),
    port: varchar("port", { length: 16 }).notNull().default("22"),
    loginUsername: varchar("login_username", { length: 128 }).notNull(),
    loginPassword: text("login_password").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("internal_test_hold_device_link_uk").on(table.holdId, table.supplierDeviceId),
    index("internal_test_hold_device_link_hold_id_idx").on(table.holdId),
  ],
)

export const resourcePoolBinding = pgTable(
  "resource_pool_binding",
  {
    id: text("id").primaryKey(),
    supplierDeviceId: text("supplier_device_id")
      .notNull()
      .references(() => supplierDevice.id, { onDelete: "cascade" }),
    resourcePoolId: varchar("resource_pool_id", { length: 128 }),
    poolCode: varchar("pool_code", { length: 64 }),
    workloadProfile: varchar("workload_profile", { length: 32 }).notNull(),
    isExclusivePool: boolean("is_exclusive_pool").notNull().default(false),
    boundAt: timestamp("bound_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("resource_pool_binding_supplier_device_id_idx").on(table.supplierDeviceId)],
)

export const supplierOpsUploadBatch = pgTable(
  "supplier_ops_upload_batch",
  {
    id: text("id").primaryKey(),
    kind: varchar("kind", { length: 32 }).notNull(),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => supplier.id, { onDelete: "restrict" }),
    idcCode: varchar("idc_code", { length: 64 }).notNull(),
    accessMethod: varchar("access_method", { length: 32 }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    rowsJson: jsonb("rows_json").notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    importStatus: varchar("import_status", { length: 32 }).notNull().default("uploaded"),
    parseError: text("parse_error"),
    parsedRowCount: integer("parsed_row_count").notNull().default(0),
    parsedSuccessCount: integer("parsed_success_count").notNull().default(0),
    committedIncidentCount: integer("committed_incident_count").notNull().default(0),
    committedAt: timestamp("committed_at", { withTimezone: true }),
    onboardingBatchId: text("onboarding_batch_id").references(() => onboardingBatch.id, {
      onDelete: "set null",
    }),
    createdByStaffId: text("created_by_staff_id").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("supplier_ops_upload_batch_supplier_id_idx").on(table.supplierId),
    index("supplier_ops_upload_batch_onboarding_batch_id_idx").on(table.onboardingBatchId),
    index("supplier_ops_upload_batch_import_status_idx").on(table.importStatus),
  ],
)

// ---------------------------------------------------------------------------
// §3.6 生命周期字典与审计
// ---------------------------------------------------------------------------

export const lifecycleStateDefinition = pgTable(
  "lifecycle_state_definition",
  {
    id: text("id").primaryKey(),
    /** device_ops_status | device_change_action | … */
    domain: varchar("domain", { length: 32 }).notNull(),
    /** Excel 原文：设备状态或变更动作 */
    stateCode: varchar("state_code", { length: 64 }).notNull(),
    displayName: varchar("display_name", { length: 128 }).notNull(),
    sortOrder: integer("sort_order").notNull(),
    /**
     * device_ops_status: { lifecycle_status, overview_bucket, tags? }
     * device_change_action: { default_ops_status?, updates_compute_node? }
     */
    payload: jsonb("payload"),
  },
  (table) => [
    uniqueIndex("lifecycle_state_definition_uk").on(table.domain, table.stateCode),
    index("lifecycle_state_definition_domain_idx").on(table.domain),
  ],
)

export const entityStateTransitionLog = pgTable(
  "entity_state_transition_log",
  {
    id: text("id").primaryKey(),
    entityType: varchar("entity_type", { length: 32 }).notNull(),
    entityId: text("entity_id").notNull(),
    fromState: varchar("from_state", { length: 64 }).notNull(),
    toState: varchar("to_state", { length: 64 }).notNull(),
    operatorStaffId: text("operator_staff_id").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    reasonCode: varchar("reason_code", { length: 64 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    payload: jsonb("payload"),
  },
  (table) => [
    index("entity_state_transition_log_entity_idx").on(
      table.entityType,
      table.entityId,
      table.occurredAt,
    ),
  ],
)

// ---------------------------------------------------------------------------
// §3.7 供应商结算账单
// ---------------------------------------------------------------------------

export const supplierBill = pgTable(
  "supplier_bill",
  {
    id: text("id").primaryKey(),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => supplier.id, { onDelete: "restrict" }),
    billMonth: varchar("bill_month", { length: 7 }).notNull(),
    cooperationMode: varchar("cooperation_mode", { length: 32 }).notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    totalUsageHours: money("total_usage_hours").notNull(),
    totalAmount: money("total_amount").notNull(),
    networkFee: money("network_fee").notNull(),
    managementFee: money("management_fee").notNull(),
    finalAmount: money("final_amount").notNull(),
    dueDate: date("due_date").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("supplier_bill_supplier_month_uk").on(table.supplierId, table.billMonth),
    index("supplier_bill_supplier_id_idx").on(table.supplierId),
  ],
)

export const supplierBillDetail = pgTable(
  "supplier_bill_detail",
  {
    id: text("id").primaryKey(),
    billId: text("bill_id")
      .notNull()
      .references(() => supplierBill.id, { onDelete: "cascade" }),
    dataCenterId: text("data_center_id")
      .notNull()
      .references(() => dataCenter.id, { onDelete: "restrict" }),
    gpuCardTypeId: text("gpu_card_type_id")
      .notNull()
      .references(() => gpuCardType.id, { onDelete: "restrict" }),
    usageHours: money("usage_hours").notNull(),
    unitCost: money("unit_cost").notNull(),
    amount: money("amount").notNull(),
    tenantConsumption: money("tenant_consumption"),
  },
  (table) => [index("supplier_bill_detail_bill_id_idx").on(table.billId)],
)

// ---------------------------------------------------------------------------
// §3.8 供应商活动时间线
// ---------------------------------------------------------------------------

export const supplierActivityTypeDefinition = pgTable(
  "supplier_activity_type_definition",
  {
    id: text("id").primaryKey(),
    typeCode: varchar("type_code", { length: 64 }).notNull(),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    category: varchar("category", { length: 32 }),
    sortOrder: integer("sort_order"),
  },
  (table) => [uniqueIndex("supplier_activity_type_definition_code_uk").on(table.typeCode)],
)

export const supplierActivity = pgTable(
  "supplier_activity",
  {
    id: text("id").primaryKey(),
    supplierId: text("supplier_id")
      .notNull()
      .references(() => supplier.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 64 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    authorStaffId: text("author_staff_id").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    authorName: varchar("author_name", { length: 128 }),
    authorRole: varchar("author_role", { length: 32 }),
    refDomain: varchar("ref_domain", { length: 64 }),
    refId: text("ref_id"),
    metadata: jsonb("metadata"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("supplier_activity_supplier_occurred_idx").on(table.supplierId, table.occurredAt),
    index("supplier_activity_ref_idx").on(table.refDomain, table.refId),
  ],
)

export const supplierActivityAttachment = pgTable(
  "supplier_activity_attachment",
  {
    id: text("id").primaryKey(),
    activityId: text("activity_id")
      .notNull()
      .references(() => supplierActivity.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileSize: bigint("file_size", { mode: "number" }),
    mimeType: varchar("mime_type", { length: 128 }),
    storageUri: varchar("storage_uri", { length: 1024 }).notNull(),
  },
  (table) => [index("supplier_activity_attachment_activity_id_idx").on(table.activityId)],
)

// ---------------------------------------------------------------------------
// §3.9 供应链线索
// ---------------------------------------------------------------------------

export const supplyChainLead = pgTable(
  "supply_chain_lead",
  {
    id: text("id").primaryKey(),
    type: varchar("type", { length: 16 }).notNull(),
    code: varchar("code", { length: 64 }),
    name: varchar("name", { length: 255 }).notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    priority: varchar("priority", { length: 16 }).notNull().default("medium"),
    description: text("description"),
    source: varchar("source", { length: 128 }),
    province: varchar("province", { length: 64 }),
    city: varchar("city", { length: 64 }),
    address: text("address"),
    supplierNameText: varchar("supplier_name_text", { length: 255 }),
    linkedSupplierId: text("linked_supplier_id").references(() => supplier.id, {
      onDelete: "set null",
    }),
    parentSupplierLeadId: text("parent_supplier_lead_id").references(
      (): AnyPgColumn => supplyChainLead.id,
      { onDelete: "set null" },
    ),
    dockingScope: varchar("docking_scope", { length: 32 }),
    estimatedOnlineDate: date("estimated_online_date"),
    ownerStaffId: text("owner_staff_id").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    convertedSupplierId: text("converted_supplier_id").references(() => supplier.id, {
      onDelete: "set null",
    }),
    convertedDataCenterId: text("converted_data_center_id").references(() => dataCenter.id, {
      onDelete: "set null",
    }),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    convertedBy: text("converted_by").references(() => userStaff.id, { onDelete: "set null" }),
    lostReason: text("lost_reason"),
    lostAt: timestamp("lost_at", { withTimezone: true }),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull(),
    createdBy: text("created_by").references(() => userStaff.id, { onDelete: "set null" }),
    ...supplyTimestamps,
  },
  (table) => [
    index("supply_chain_lead_type_status_idx").on(table.type, table.status),
    index("supply_chain_lead_owner_staff_id_idx").on(table.ownerStaffId),
    index("supply_chain_lead_last_activity_at_idx").on(table.lastActivityAt),
    index("supply_chain_lead_linked_supplier_id_idx").on(table.linkedSupplierId),
    index("supply_chain_lead_converted_supplier_id_idx").on(table.convertedSupplierId),
    index("supply_chain_lead_converted_data_center_id_idx").on(table.convertedDataCenterId),
  ],
)

export const supplyChainLeadContact = pgTable(
  "supply_chain_lead_contact",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => supplyChainLead.id, { onDelete: "cascade" }),
    contactRole: varchar("contact_role", { length: 32 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    title: varchar("title", { length: 64 }),
    phone: varchar("phone", { length: 32 }),
    email: varchar("email", { length: 255 }),
    wechatId: varchar("wechat_id", { length: 128 }),
    isPrimary: boolean("is_primary").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("supply_chain_lead_contact_lead_id_idx").on(table.leadId),
    uniqueIndex("supply_chain_lead_contact_primary_uk")
      .on(table.leadId, table.contactRole)
      .where(sql`${table.isPrimary} = true`),
  ],
)

export const supplyChainLeadGpuSnapshot = pgTable(
  "supply_chain_lead_gpu_snapshot",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => supplyChainLead.id, { onDelete: "cascade" }),
    gpuCardTypeId: text("gpu_card_type_id").references(() => gpuCardType.id, {
      onDelete: "set null",
    }),
    cardTypeName: varchar("card_type_name", { length: 128 }).notNull(),
    totalQuantity: integer("total_quantity").notNull().default(0),
    idleQuantity: integer("idle_quantity").notNull().default(0),
    reservedQuantity: integer("reserved_quantity").notNull().default(0),
    inUseQuantity: integer("in_use_quantity").notNull().default(0),
    unitPricePerHour: money("unit_price_per_hour"),
    availableTime: varchar("available_time", { length: 255 }),
    notes: text("notes"),
    source: varchar("source", { length: 32 }).notNull().default("manual"),
    snapshotAt: timestamp("snapshot_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: text("created_by").references(() => userStaff.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("supply_chain_lead_gpu_snapshot_lead_card_uk").on(table.leadId, table.cardTypeName),
    index("supply_chain_lead_gpu_snapshot_lead_id_idx").on(table.leadId),
    index("supply_chain_lead_gpu_snapshot_card_type_id_idx").on(table.gpuCardTypeId),
  ],
)

export const supplyChainLeadTag = pgTable(
  "supply_chain_lead_tag",
  {
    id: text("id").primaryKey(),
    name: varchar("name", { length: 128 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("supply_chain_lead_tag_name_uk").on(table.name)],
)

export const supplyChainLeadTagAssignment = pgTable(
  "supply_chain_lead_tag_assignment",
  {
    leadId: text("lead_id")
      .notNull()
      .references(() => supplyChainLead.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => supplyChainLeadTag.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.leadId, table.tagId] }),
    index("supply_chain_lead_tag_assignment_tag_id_idx").on(table.tagId),
  ],
)

export const supplyChainLeadActivity = pgTable(
  "supply_chain_lead_activity",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => supplyChainLead.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 32 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    authorStaffId: text("author_staff_id").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    authorName: varchar("author_name", { length: 128 }),
    authorRole: varchar("author_role", { length: 32 }),
    metadata: jsonb("metadata"),
    refDomain: varchar("ref_domain", { length: 64 }),
    refId: text("ref_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("supply_chain_lead_activity_lead_occurred_idx").on(table.leadId, table.occurredAt),
  ],
)

export const supplyChainLeadActivityAttachment = pgTable(
  "supply_chain_lead_activity_attachment",
  {
    id: text("id").primaryKey(),
    activityId: text("activity_id")
      .notNull()
      .references(() => supplyChainLeadActivity.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileSize: bigint("file_size", { mode: "number" }),
    mimeType: varchar("mime_type", { length: 128 }),
    storageUri: varchar("storage_uri", { length: 1024 }).notNull(),
  },
  (table) => [
    index("supply_chain_lead_activity_attachment_activity_id_idx").on(table.activityId),
  ],
)

// ---------------------------------------------------------------------------
// Relations（查询用）
// ---------------------------------------------------------------------------

export const supplierRelations = relations(supplier, ({ many, one }) => ({
  dataCenters: many(dataCenter),
  contracts: many(supplierContract),
  bills: many(supplierBill),
  activities: many(supplierActivity),
  cardListPrices: many(supplierCardListPrice),
  pricingRecords: many(supplierPricingRecord),
  gpuInventories: many(supplierGpuInventory),
  devices: many(supplierDevice),
  onboardingBatches: many(onboardingBatch),
  businessManager: one(userStaff, {
    fields: [supplier.businessManagerStaffId],
    references: [userStaff.id],
  }),
}))

export const dataCenterRelations = relations(dataCenter, ({ one, many }) => ({
  supplier: one(supplier, {
    fields: [dataCenter.supplierId],
    references: [supplier.id],
  }),
  gpuInventories: many(supplierGpuInventory),
  cardListPrices: many(supplierCardListPrice),
  onboardingBatches: many(onboardingBatch),
}))

export const supplierContractRelations = relations(supplierContract, ({ one, many }) => ({
  supplier: one(supplier, {
    fields: [supplierContract.supplierId],
    references: [supplier.id],
  }),
  pricingTiers: many(supplierPricingTier),
  accessConditionSheets: many(accessConditionSheet),
  termsVersions: many(supplierTermsVersion),
  onboardingBatches: many(onboardingBatch),
}))

export const onboardingBatchRelations = relations(onboardingBatch, ({ one, many }) => ({
  supplier: one(supplier, {
    fields: [onboardingBatch.supplierId],
    references: [supplier.id],
  }),
  dataCenter: one(dataCenter, {
    fields: [onboardingBatch.dataCenterId],
    references: [dataCenter.id],
  }),
  contract: one(supplierContract, {
    fields: [onboardingBatch.contractId],
    references: [supplierContract.id],
  }),
  accessConditionSheet: one(accessConditionSheet, {
    fields: [onboardingBatch.accessConditionSheetId],
    references: [accessConditionSheet.id],
  }),
  importRows: many(onboardingBatchImportRow),
  planLines: many(onboardingBatchPlanLine),
  progressEvents: many(onboardingBatchProgressEvent),
  tasks: many(onboardingTask),
  /** supplier_device.onboarding_batch_id（仅 inventory 批次） */
  inventoryDevices: many(supplierDevice, {
    relationName: "inventoryOnboardingBatch",
  }),
  deviceLinks: many(onboardingBatchDeviceLink, {
    relationName: "businessBatchDeviceLinks",
  }),
  parentBatch: one(onboardingBatch, {
    fields: [onboardingBatch.parentBatchId],
    references: [onboardingBatch.id],
    relationName: "parentBatch",
  }),
  childImportBatches: many(onboardingBatch, {
    relationName: "parentBatch",
  }),
  changelogChangeLogs: many(supplierDeviceChangeLog, {
    relationName: "changelogImportBatch",
  }),
  businessChangeLogs: many(supplierDeviceChangeLog, {
    relationName: "businessOnboardingBatch",
  }),
  createdBy: one(userStaff, {
    fields: [onboardingBatch.createdByStaffId],
    references: [userStaff.id],
  }),
}))

export const supplierDeviceRelations = relations(supplierDevice, ({ one, many }) => ({
  supplier: one(supplier, {
    fields: [supplierDevice.supplierId],
    references: [supplier.id],
  }),
  dataCenter: one(dataCenter, {
    fields: [supplierDevice.dataCenterId],
    references: [dataCenter.id],
  }),
  gpuCardType: one(gpuCardType, {
    fields: [supplierDevice.gpuCardTypeId],
    references: [gpuCardType.id],
  }),
  inventoryOnboardingBatch: one(onboardingBatch, {
    fields: [supplierDevice.onboardingBatchId],
    references: [onboardingBatch.id],
    relationName: "inventoryOnboardingBatch",
  }),
  businessBatchLinks: many(onboardingBatchDeviceLink),
  computeNodes: many(computeNode),
  changeLogs: many(supplierDeviceChangeLog),
  poolBindings: many(resourcePoolBinding),
}))

export const onboardingBatchPlanLineRelations = relations(onboardingBatchPlanLine, ({ one }) => ({
  batch: one(onboardingBatch, {
    fields: [onboardingBatchPlanLine.onboardingBatchId],
    references: [onboardingBatch.id],
  }),
  gpuCardType: one(gpuCardType, {
    fields: [onboardingBatchPlanLine.gpuCardTypeId],
    references: [gpuCardType.id],
  }),
}))

export const onboardingBatchProgressEventRelations = relations(
  onboardingBatchProgressEvent,
  ({ one }) => ({
    batch: one(onboardingBatch, {
      fields: [onboardingBatchProgressEvent.onboardingBatchId],
      references: [onboardingBatch.id],
    }),
    supplier: one(supplier, {
      fields: [onboardingBatchProgressEvent.supplierId],
      references: [supplier.id],
    }),
    dataCenter: one(dataCenter, {
      fields: [onboardingBatchProgressEvent.dataCenterId],
      references: [dataCenter.id],
    }),
  }),
)

export const onboardingBatchDeviceLinkRelations = relations(
  onboardingBatchDeviceLink,
  ({ one }) => ({
    businessBatch: one(onboardingBatch, {
      fields: [onboardingBatchDeviceLink.businessOnboardingBatchId],
      references: [onboardingBatch.id],
      relationName: "businessBatchDeviceLinks",
    }),
    supplierDevice: one(supplierDevice, {
      fields: [onboardingBatchDeviceLink.supplierDeviceId],
      references: [supplierDevice.id],
    }),
    gpuCardType: one(gpuCardType, {
      fields: [onboardingBatchDeviceLink.gpuCardTypeId],
      references: [gpuCardType.id],
    }),
    sourceChangelogBatch: one(onboardingBatch, {
      fields: [onboardingBatchDeviceLink.sourceChangelogBatchId],
      references: [onboardingBatch.id],
    }),
  }),
)

export const supplierDeviceChangeLogRelations = relations(supplierDeviceChangeLog, ({ one }) => ({
  supplierDevice: one(supplierDevice, {
    fields: [supplierDeviceChangeLog.supplierDeviceId],
    references: [supplierDevice.id],
  }),
  changelogImportBatch: one(onboardingBatch, {
    fields: [supplierDeviceChangeLog.onboardingBatchId],
    references: [onboardingBatch.id],
    relationName: "changelogImportBatch",
  }),
  businessOnboardingBatch: one(onboardingBatch, {
    fields: [supplierDeviceChangeLog.businessOnboardingBatchId],
    references: [onboardingBatch.id],
    relationName: "businessOnboardingBatch",
  }),
}))

export const supplierBillRelations = relations(supplierBill, ({ one, many }) => ({
  supplier: one(supplier, {
    fields: [supplierBill.supplierId],
    references: [supplier.id],
  }),
  details: many(supplierBillDetail),
}))

export const supplierActivityRelations = relations(supplierActivity, ({ one, many }) => ({
  supplier: one(supplier, {
    fields: [supplierActivity.supplierId],
    references: [supplier.id],
  }),
  author: one(userStaff, {
    fields: [supplierActivity.authorStaffId],
    references: [userStaff.id],
  }),
  attachments: many(supplierActivityAttachment),
}))

// ---------------------------------------------------------------------------
// 类型导出
// ---------------------------------------------------------------------------

export type SupplierRow = typeof supplier.$inferSelect
export type NewSupplierRow = typeof supplier.$inferInsert
export type DataCenterRow = typeof dataCenter.$inferSelect
export type SupplierContractRow = typeof supplierContract.$inferSelect
export type OnboardingBatchRow = typeof onboardingBatch.$inferSelect
export type OnboardingBatchPlanLineRow = typeof onboardingBatchPlanLine.$inferSelect
export type OnboardingBatchProgressEventRow = typeof onboardingBatchProgressEvent.$inferSelect
export type OnboardingBatchDeviceLinkRow = typeof onboardingBatchDeviceLink.$inferSelect
export type SupplierDeviceRow = typeof supplierDevice.$inferSelect
export type SupplierDeviceChangeLogRow = typeof supplierDeviceChangeLog.$inferSelect
export type LifecycleStateDefinitionRow = typeof lifecycleStateDefinition.$inferSelect
export type SupplierOpsUploadBatchRow = typeof supplierOpsUploadBatch.$inferSelect
export type SupplierUnitCostRow = typeof supplierUnitCost.$inferSelect
export type SupplierGpuInventoryRow = typeof supplierGpuInventory.$inferSelect
export type InternalTestHoldRow = typeof internalTestHold.$inferSelect
export type InternalTestHoldDeviceLinkRow = typeof internalTestHoldDeviceLink.$inferSelect
