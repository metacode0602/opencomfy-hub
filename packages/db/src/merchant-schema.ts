/**
 * 商户域表结构 — 设计依据 merchant-management-design.md v1.3
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
import { billingTenant, userStaff } from "./crm-schema"
import { platformCardListPrice } from "./platform-pricing-schema"
import { dataCenter, gpuCardType } from "./supply-schema"

const money = (name: string) => numeric(name, { precision: 15, scale: 4 })

const merchantTimestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}

export const merchant = pgTable(
  "merchant",
  {
    id: text("id").primaryKey(),
    platformMerchantId: integer("platform_merchant_id").notNull(),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    companyFullName: varchar("company_full_name", { length: 512 }).notNull(),
    unifiedSocialCreditCode: varchar("unified_social_credit_code", { length: 18 }).notNull(),
    merchantMark: varchar("merchant_mark", { length: 128 }),
    accessMode: varchar("access_mode", { length: 16 }).notNull().default("oem"),
    type: varchar("type", { length: 32 }).notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    status: varchar("status", { length: 32 }).notNull(),
    contactUser: varchar("contact_user", { length: 128 }),
    contactPhone: varchar("contact_phone", { length: 32 }),
    remark: text("remark"),
    platformSyncedAt: timestamp("platform_synced_at", { withTimezone: true }),
    ...merchantTimestamps,
  },
  (table) => [
    uniqueIndex("merchant_platform_merchant_id_uk").on(table.platformMerchantId),
    uniqueIndex("merchant_code_uk").on(table.code),
    uniqueIndex("merchant_uscc_uk").on(table.unifiedSocialCreditCode),
    uniqueIndex("merchant_is_default_uk").on(table.isDefault).where(sql`is_default = true`),
    index("merchant_status_idx").on(table.status),
    index("merchant_name_idx").on(table.name),
  ],
)

export const tenantMerchant = pgTable(
  "tenant_merchant",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => billingTenant.id, { onDelete: "restrict" }),
    merchantId: text("merchant_id")
      .notNull()
      .references(() => merchant.id, { onDelete: "restrict" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    bindingRole: varchar("binding_role", { length: 32 }).notNull(),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    remark: text("remark"),
    createdByStaffId: text("created_by_staff_id").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    ...merchantTimestamps,
  },
  (table) => [
    index("tenant_merchant_merchant_id_idx").on(table.merchantId),
    index("tenant_merchant_tenant_id_idx").on(table.tenantId),
    index("tenant_merchant_tenant_primary_idx").on(table.tenantId, table.isPrimary),
  ],
)

export const merchantRechargeRecord = pgTable(
  "merchant_recharge_record",
  {
    id: text("id").primaryKey(),
    merchantId: text("merchant_id")
      .notNull()
      .references(() => merchant.id, { onDelete: "restrict" }),
    amount: money("amount").notNull(),
    paymentMethod: varchar("payment_method", { length: 32 }).notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    transactionId: varchar("transaction_id", { length: 128 }),
    rechargeDate: date("recharge_date").notNull(),
    remark: text("remark"),
    source: varchar("source", { length: 32 }).notNull().default("manual"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdByStaffId: text("created_by_staff_id").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    updatedByStaffId: text("updated_by_staff_id").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    ...merchantTimestamps,
  },
  (table) => [
    index("merchant_recharge_merchant_date_idx").on(table.merchantId, table.rechargeDate),
    index("merchant_recharge_merchant_status_idx").on(table.merchantId, table.status),
  ],
)

export const merchantRechargeAttachment = pgTable(
  "merchant_recharge_attachment",
  {
    id: text("id").primaryKey(),
    rechargeId: text("recharge_id")
      .notNull()
      .references(() => merchantRechargeRecord.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 128 }).notNull(),
    fileSize: bigint("file_size", { mode: "number" }).notNull(),
    storageUri: varchar("storage_uri", { length: 1024 }).notNull(),
    uploadedByStaffId: text("uploaded_by_staff_id").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("merchant_recharge_attachment_recharge_id_idx").on(table.rechargeId)],
)

export const merchantRechargeAuditLog = pgTable(
  "merchant_recharge_audit_log",
  {
    id: text("id").primaryKey(),
    rechargeId: text("recharge_id")
      .notNull()
      .references(() => merchantRechargeRecord.id, { onDelete: "cascade" }),
    merchantId: text("merchant_id")
      .notNull()
      .references(() => merchant.id, { onDelete: "restrict" }),
    action: varchar("action", { length: 16 }).notNull(),
    operatorStaffId: text("operator_staff_id").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    operatorName: varchar("operator_name", { length: 128 }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    changes: jsonb("changes"),
    remark: text("remark"),
  },
  (table) => [
    index("merchant_recharge_audit_recharge_idx").on(table.rechargeId, table.occurredAt),
    index("merchant_recharge_audit_merchant_idx").on(table.merchantId, table.occurredAt),
  ],
)

export const merchantActivity = pgTable(
  "merchant_activity",
  {
    id: text("id").primaryKey(),
    merchantId: text("merchant_id")
      .notNull()
      .references(() => merchant.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 64 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    authorStaffId: text("author_staff_id").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    authorName: varchar("author_name", { length: 128 }).notNull(),
    authorRole: varchar("author_role", { length: 32 }).notNull(),
    refDomain: varchar("ref_domain", { length: 64 }),
    refId: text("ref_id"),
    metadata: jsonb("metadata"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("merchant_activity_merchant_occurred_idx").on(table.merchantId, table.occurredAt),
    index("merchant_activity_ref_idx").on(table.refDomain, table.refId),
  ],
)

export const merchantDatacenterRegion = pgTable(
  "merchant_datacenter_region",
  {
    id: text("id").primaryKey(),
    merchantId: text("merchant_id")
      .notNull()
      .references(() => merchant.id, { onDelete: "restrict" }),
    dataCenterId: text("data_center_id")
      .notNull()
      .references(() => dataCenter.id, { onDelete: "restrict" }),
    displayName: varchar("display_name", { length: 255 }),
    regionCode: varchar("region_code", { length: 128 }).notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    availableGpuQuota: integer("available_gpu_quota").notNull().default(-1),
    sortOrder: integer("sort_order").notNull().default(0),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    updatedByStaffId: text("updated_by_staff_id").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    ...merchantTimestamps,
  },
  (table) => [
    uniqueIndex("merchant_datacenter_region_merchant_dc_active_uk")
      .on(table.merchantId, table.dataCenterId)
      .where(sql`effective_to IS NULL`),
    index("merchant_datacenter_region_merchant_status_idx").on(table.merchantId, table.status),
    index("merchant_datacenter_region_data_center_id_idx").on(table.dataCenterId),
  ],
)

export const merchantDatacenterCardType = pgTable(
  "merchant_datacenter_card_type",
  {
    id: text("id").primaryKey(),
    merchantDatacenterRegionId: text("merchant_datacenter_region_id")
      .notNull()
      .references(() => merchantDatacenterRegion.id, { onDelete: "cascade" }),
    gpuCardTypeId: text("gpu_card_type_id")
      .notNull()
      .references(() => gpuCardType.id, { onDelete: "restrict" }),
    status: varchar("status", { length: 32 }).notNull().default("enabled"),
    ...merchantTimestamps,
  },
  (table) => [
    uniqueIndex("merchant_datacenter_card_type_region_card_uk").on(
      table.merchantDatacenterRegionId,
      table.gpuCardTypeId,
    ),
    index("merchant_datacenter_card_type_region_id_idx").on(table.merchantDatacenterRegionId),
  ],
)

export const merchantPurchasePrice = pgTable(
  "merchant_purchase_price",
  {
    id: text("id").primaryKey(),
    merchantId: text("merchant_id")
      .notNull()
      .references(() => merchant.id, { onDelete: "restrict" }),
    dataCenterId: text("data_center_id")
      .notNull()
      .references(() => dataCenter.id, { onDelete: "restrict" }),
    gpuCardTypeId: text("gpu_card_type_id")
      .notNull()
      .references(() => gpuCardType.id, { onDelete: "restrict" }),
    productLine: varchar("product_line", { length: 32 }).notNull(),
    billingUnit: varchar("billing_unit", { length: 16 }).notNull().default("hour"),
    purchasePrice: money("purchase_price").notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("CNY"),
    source: varchar("source", { length: 32 }).notNull(),
    platformListPriceId: text("platform_list_price_id").references(() => platformCardListPrice.id, {
      onDelete: "set null",
    }),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    status: varchar("status", { length: 32 }).notNull(),
    remark: text("remark"),
    updatedByStaffId: text("updated_by_staff_id").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    ...merchantTimestamps,
  },
  (table) => [
    uniqueIndex("merchant_purchase_price_active_uk")
      .on(
        table.merchantId,
        table.dataCenterId,
        table.gpuCardTypeId,
        table.productLine,
        table.billingUnit,
      )
      .where(sql`${table.effectiveTo} IS NULL AND ${table.status} = 'active'`),
    index("merchant_purchase_price_merchant_dc_idx").on(table.merchantId, table.dataCenterId),
    index("merchant_purchase_price_gpu_card_type_id_idx").on(table.gpuCardTypeId),
  ],
)

export const merchantPurchasePriceRecord = pgTable(
  "merchant_purchase_price_record",
  {
    id: text("id").primaryKey(),
    merchantId: text("merchant_id")
      .notNull()
      .references(() => merchant.id, { onDelete: "restrict" }),
    dataCenterId: text("data_center_id")
      .notNull()
      .references(() => dataCenter.id, { onDelete: "restrict" }),
    gpuCardTypeId: text("gpu_card_type_id")
      .notNull()
      .references(() => gpuCardType.id, { onDelete: "restrict" }),
    productLine: varchar("product_line", { length: 32 }).notNull(),
    billingUnit: varchar("billing_unit", { length: 16 }).notNull().default("hour"),
    purchasePrice: money("purchase_price").notNull(),
    platformListPriceId: text("platform_list_price_id").references(() => platformCardListPrice.id, {
      onDelete: "set null",
    }),
    source: varchar("source", { length: 32 }).notNull(),
    effectiveFrom: date("effective_from").notNull(),
    updatedByStaffId: text("updated_by_staff_id").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("merchant_purchase_price_record_uk").on(
      table.merchantId,
      table.dataCenterId,
      table.gpuCardTypeId,
      table.productLine,
      table.billingUnit,
    ),
    index("merchant_purchase_price_record_merchant_id_idx").on(table.merchantId),
    index("merchant_purchase_price_record_data_center_id_idx").on(table.dataCenterId),
  ],
)

export const merchantActivityAttachment = pgTable(
  "merchant_activity_attachment",
  {
    id: text("id").primaryKey(),
    activityId: text("activity_id")
      .notNull()
      .references(() => merchantActivity.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileSize: bigint("file_size", { mode: "number" }),
    mimeType: varchar("mime_type", { length: 128 }),
    storageUri: varchar("storage_uri", { length: 1024 }).notNull(),
  },
  (table) => [index("merchant_activity_attachment_activity_id_idx").on(table.activityId)],
)

export const merchantRelations = relations(merchant, ({ many }) => ({
  tenantMerchants: many(tenantMerchant),
  rechargeRecords: many(merchantRechargeRecord),
  activities: many(merchantActivity),
  datacenterRegions: many(merchantDatacenterRegion),
  purchasePrices: many(merchantPurchasePrice),
  purchasePriceRecords: many(merchantPurchasePriceRecord),
}))

export const merchantDatacenterRegionRelations = relations(
  merchantDatacenterRegion,
  ({ one, many }) => ({
    merchant: one(merchant, {
      fields: [merchantDatacenterRegion.merchantId],
      references: [merchant.id],
    }),
    dataCenter: one(dataCenter, {
      fields: [merchantDatacenterRegion.dataCenterId],
      references: [dataCenter.id],
    }),
    cardTypes: many(merchantDatacenterCardType),
  }),
)

export const merchantDatacenterCardTypeRelations = relations(
  merchantDatacenterCardType,
  ({ one }) => ({
    region: one(merchantDatacenterRegion, {
      fields: [merchantDatacenterCardType.merchantDatacenterRegionId],
      references: [merchantDatacenterRegion.id],
    }),
    gpuCardType: one(gpuCardType, {
      fields: [merchantDatacenterCardType.gpuCardTypeId],
      references: [gpuCardType.id],
    }),
  }),
)

export const merchantPurchasePriceRelations = relations(merchantPurchasePrice, ({ one }) => ({
  merchant: one(merchant, {
    fields: [merchantPurchasePrice.merchantId],
    references: [merchant.id],
  }),
  dataCenter: one(dataCenter, {
    fields: [merchantPurchasePrice.dataCenterId],
    references: [dataCenter.id],
  }),
  gpuCardType: one(gpuCardType, {
    fields: [merchantPurchasePrice.gpuCardTypeId],
    references: [gpuCardType.id],
  }),
  platformListPrice: one(platformCardListPrice, {
    fields: [merchantPurchasePrice.platformListPriceId],
    references: [platformCardListPrice.id],
  }),
}))

export const merchantPurchasePriceRecordRelations = relations(
  merchantPurchasePriceRecord,
  ({ one }) => ({
    merchant: one(merchant, {
      fields: [merchantPurchasePriceRecord.merchantId],
      references: [merchant.id],
    }),
    dataCenter: one(dataCenter, {
      fields: [merchantPurchasePriceRecord.dataCenterId],
      references: [dataCenter.id],
    }),
    gpuCardType: one(gpuCardType, {
      fields: [merchantPurchasePriceRecord.gpuCardTypeId],
      references: [gpuCardType.id],
    }),
    platformListPrice: one(platformCardListPrice, {
      fields: [merchantPurchasePriceRecord.platformListPriceId],
      references: [platformCardListPrice.id],
    }),
  }),
)

export const tenantMerchantRelations = relations(tenantMerchant, ({ one }) => ({
  merchant: one(merchant, {
    fields: [tenantMerchant.merchantId],
    references: [merchant.id],
  }),
  tenant: one(billingTenant, {
    fields: [tenantMerchant.tenantId],
    references: [billingTenant.id],
  }),
}))

export const merchantRechargeRecordRelations = relations(merchantRechargeRecord, ({ one, many }) => ({
  merchant: one(merchant, {
    fields: [merchantRechargeRecord.merchantId],
    references: [merchant.id],
  }),
  attachments: many(merchantRechargeAttachment),
  auditLogs: many(merchantRechargeAuditLog),
}))

export const merchantActivityRelations = relations(merchantActivity, ({ one, many }) => ({
  merchant: one(merchant, {
    fields: [merchantActivity.merchantId],
    references: [merchant.id],
  }),
  attachments: many(merchantActivityAttachment),
}))
