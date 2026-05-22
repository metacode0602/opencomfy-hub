/**
 * 平台定价域表结构（Drizzle ORM / PostgreSQL）
 *
 * 设计依据：apps/web/content/design/platform-pricing-design.md（v1.0）
 * 领域模型：L1 平台级销售价格 — gpu_card_type × product_line × billing_unit
 *
 * 约定：
 * - 主键 text；金额 numeric(15,4)
 * - 员工 FK 复用 CRM `user_staff`；卡型 FK 复用 supply `gpu_card_type`
 */

import { relations, sql } from "drizzle-orm"
import { index, numeric, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core"

import { userStaff } from "./crm-schema"
import { gpuCardType } from "./supply-schema"

/** 金额 decimal(15,4) */
const money = (name: string) => numeric(name, { precision: 15, scale: 4 })

const platformPricingTimestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}

// ---------------------------------------------------------------------------
// L1 平台刊例价（版本化主数据）
// ---------------------------------------------------------------------------

export const platformCardListPrice = pgTable(
  "platform_card_list_price",
  {
    id: text("id").primaryKey(),
    gpuCardTypeId: text("gpu_card_type_id")
      .notNull()
      .references(() => gpuCardType.id, { onDelete: "restrict" }),
    productLine: varchar("product_line", { length: 32 }).notNull(),
    billingUnit: varchar("billing_unit", { length: 16 }).notNull().default("hour"),
    sellPrice: money("sell_price").notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("CNY"),
    effectiveFrom: timestamp("effective_from", { mode: "string", precision: 0 }).notNull(),
    effectiveTo: timestamp("effective_to", { mode: "string", precision: 0 }),
    /** draft | active | archived */
    status: varchar("status", { length: 32 }).notNull(),
    remark: text("remark"),
    updatedByStaffId: text("updated_by_staff_id").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    ...platformPricingTimestamps,
  },
  (table) => [
    uniqueIndex("platform_card_list_price_current_uk")
      .on(table.gpuCardTypeId, table.productLine, table.billingUnit)
      .where(sql`${table.effectiveTo} IS NULL AND ${table.status} = 'active'`),
    index("platform_card_list_price_gpu_card_type_id_idx").on(table.gpuCardTypeId),
    index("platform_card_list_price_product_line_idx").on(table.productLine),
    index("platform_card_list_price_effective_from_idx").on(table.effectiveFrom),
  ],
)

// ---------------------------------------------------------------------------
// L1 平台当前价读模型
// ---------------------------------------------------------------------------

export const platformCardPriceRecord = pgTable(
  "platform_card_price_record",
  {
    id: text("id").primaryKey(),
    gpuCardTypeId: text("gpu_card_type_id")
      .notNull()
      .references(() => gpuCardType.id, { onDelete: "restrict" }),
    productLine: varchar("product_line", { length: 32 }).notNull(),
    billingUnit: varchar("billing_unit", { length: 16 }).notNull().default("hour"),
    sellPrice: money("sell_price").notNull(),
    platformCardListPriceId: text("platform_card_list_price_id").references(
      () => platformCardListPrice.id,
      { onDelete: "set null" },
    ),
    effectiveFrom: timestamp("effective_from", { mode: "string", precision: 0 }).notNull(),
    updatedByStaffId: text("updated_by_staff_id").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("platform_card_price_record_uk").on(
      table.gpuCardTypeId,
      table.productLine,
      table.billingUnit,
    ),
    index("platform_card_price_record_list_price_id_idx").on(table.platformCardListPriceId),
  ],
)

// ---------------------------------------------------------------------------
// L1 平台调价历史
// ---------------------------------------------------------------------------

export const platformCardPriceHistory = pgTable(
  "platform_card_price_history",
  {
    id: text("id").primaryKey(),
    priceRecordId: text("price_record_id")
      .notNull()
      .references(() => platformCardPriceRecord.id, { onDelete: "cascade" }),
    gpuCardTypeId: text("gpu_card_type_id")
      .notNull()
      .references(() => gpuCardType.id, { onDelete: "restrict" }),
    productLine: varchar("product_line", { length: 32 }).notNull(),
    billingUnit: varchar("billing_unit", { length: 16 }).notNull().default("hour"),
    previousSellPrice: money("previous_sell_price"),
    newSellPrice: money("new_sell_price").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull(),
    changedByStaffId: text("changed_by_staff_id").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    reason: text("reason"),
  },
  (table) => [
    index("platform_card_price_history_record_changed_idx").on(
      table.priceRecordId,
      table.changedAt,
    ),
    index("platform_card_price_history_gpu_card_type_id_idx").on(table.gpuCardTypeId),
  ],
)

// ---------------------------------------------------------------------------
// Relations（查询用）
// ---------------------------------------------------------------------------

export const platformCardListPriceRelations = relations(platformCardListPrice, ({ one, many }) => ({
  gpuCardType: one(gpuCardType, {
    fields: [platformCardListPrice.gpuCardTypeId],
    references: [gpuCardType.id],
  }),
  updatedBy: one(userStaff, {
    fields: [platformCardListPrice.updatedByStaffId],
    references: [userStaff.id],
  }),
  priceRecords: many(platformCardPriceRecord),
  historyEntries: many(platformCardPriceHistory),
}))

export const platformCardPriceRecordRelations = relations(platformCardPriceRecord, ({ one, many }) => ({
  gpuCardType: one(gpuCardType, {
    fields: [platformCardPriceRecord.gpuCardTypeId],
    references: [gpuCardType.id],
  }),
  listPrice: one(platformCardListPrice, {
    fields: [platformCardPriceRecord.platformCardListPriceId],
    references: [platformCardListPrice.id],
  }),
  updatedBy: one(userStaff, {
    fields: [platformCardPriceRecord.updatedByStaffId],
    references: [userStaff.id],
  }),
  historyEntries: many(platformCardPriceHistory),
}))

export const platformCardPriceHistoryRelations = relations(platformCardPriceHistory, ({ one }) => ({
  priceRecord: one(platformCardPriceRecord, {
    fields: [platformCardPriceHistory.priceRecordId],
    references: [platformCardPriceRecord.id],
  }),
  gpuCardType: one(gpuCardType, {
    fields: [platformCardPriceHistory.gpuCardTypeId],
    references: [gpuCardType.id],
  }),
  changedBy: one(userStaff, {
    fields: [platformCardPriceHistory.changedByStaffId],
    references: [userStaff.id],
  }),
}))

// ---------------------------------------------------------------------------
// 类型导出
// ---------------------------------------------------------------------------

export type PlatformCardListPriceRow = typeof platformCardListPrice.$inferSelect
export type NewPlatformCardListPriceRow = typeof platformCardListPrice.$inferInsert
export type PlatformCardPriceRecordRow = typeof platformCardPriceRecord.$inferSelect
export type NewPlatformCardPriceRecordRow = typeof platformCardPriceRecord.$inferInsert
export type PlatformCardPriceHistoryRow = typeof platformCardPriceHistory.$inferSelect
export type NewPlatformCardPriceHistoryRow = typeof platformCardPriceHistory.$inferInsert
