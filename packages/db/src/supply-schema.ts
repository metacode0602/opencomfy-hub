/**
 * 供应商与算力资源域表结构（Drizzle ORM / PostgreSQL）
 *
 * 设计依据：apps/web/content/design/supplier-database.md（v1.2）
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
  text,
  timestamp,
  uniqueIndex,
  varchar,
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
    accessMethod: varchar("access_method", { length: 32 }).notNull(),
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
    expectedCompletionDate: date("expected_completion_date"),
    retireRemark: text("retire_remark"),
    retiredDeviceCount: integer("retired_device_count").notNull().default(0),
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
    onboardingBatchId: text("onboarding_batch_id")
      .notNull()
      .references(() => onboardingBatch.id, { onDelete: "restrict" }),
    internalIp: varchar("internal_ip", { length: 45 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    changeAction: varchar("change_action", { length: 64 }).notNull(),
    changeContent: text("change_content"),
    description: text("description"),
    ticketNo: varchar("ticket_no", { length: 64 }),
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
    supplierDeviceId: text("supplier_device_id").references(() => supplierDevice.id, {
      onDelete: "cascade",
    }),
    supplierGpuInventoryId: text("supplier_gpu_inventory_id").references(
      () => supplierGpuInventory.id,
      { onDelete: "cascade" },
    ),
    scope: varchar("scope", { length: 255 }).notNull(),
    holdFrom: timestamp("hold_from", { withTimezone: true }).notNull(),
    holdUntil: timestamp("hold_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("internal_test_hold_supplier_device_id_idx").on(table.supplierDeviceId),
    index("internal_test_hold_inventory_id_idx").on(table.supplierGpuInventoryId),
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
    domain: varchar("domain", { length: 32 }).notNull(),
    stateCode: varchar("state_code", { length: 64 }).notNull(),
    displayName: varchar("display_name", { length: 128 }).notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [uniqueIndex("lifecycle_state_definition_uk").on(table.domain, table.stateCode)],
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
  tasks: many(onboardingTask),
  devices: many(supplierDevice),
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
  onboardingBatch: one(onboardingBatch, {
    fields: [supplierDevice.onboardingBatchId],
    references: [onboardingBatch.id],
  }),
  computeNodes: many(computeNode),
  changeLogs: many(supplierDeviceChangeLog),
  poolBindings: many(resourcePoolBinding),
}))

export const supplierDeviceChangeLogRelations = relations(supplierDeviceChangeLog, ({ one }) => ({
  supplierDevice: one(supplierDevice, {
    fields: [supplierDeviceChangeLog.supplierDeviceId],
    references: [supplierDevice.id],
  }),
  onboardingBatch: one(onboardingBatch, {
    fields: [supplierDeviceChangeLog.onboardingBatchId],
    references: [onboardingBatch.id],
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
export type SupplierDeviceRow = typeof supplierDevice.$inferSelect
export type SupplierDeviceChangeLogRow = typeof supplierDeviceChangeLog.$inferSelect
export type SupplierOpsUploadBatchRow = typeof supplierOpsUploadBatch.$inferSelect
export type SupplierUnitCostRow = typeof supplierUnitCost.$inferSelect
export type SupplierGpuInventoryRow = typeof supplierGpuInventory.$inferSelect
