/**
 * CRM 域表结构（Drizzle ORM / PostgreSQL）
 *
 * 设计依据：apps/web/content/design/crm-database.md（v3.0）
 * 领域模型：Customer（客户主体）→ Project（经营项目）→ tenant（平台计费租户）
 *
 * 约定：
 * - 主键 text；金额 numeric(15,4)；扩展字段 jsonb
 * - 聚合字段（project_count、total_recharge 等）不入库
 * - 计费写表必须带 tenant_id（§1.1 R3）
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
} from "drizzle-orm/pg-core"

/** 金额 decimal(15,4) */
const money = (name: string) => numeric(name, { precision: 15, scale: 4 })

/** 平台同步租户金额：允许负值，精度覆盖平台 coin（约 12 位整数） */
const tenantMoney = (name: string) => numeric(name, { precision: 20, scale: 4 })

const crmTimestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}

// ---------------------------------------------------------------------------
// §3.2 主数据
// ---------------------------------------------------------------------------

/** CRM 客户主体（经营域）；禁止存 balance / platform_tenant_id */
export const customer = pgTable(
  "customer",
  {
    id: text("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    customerCode: varchar("customer_code", { length: 64 }), // 客户编码
    shortName: varchar("short_name", { length: 255 }), // 客户简称
    certCode: varchar("cert_code", { length: 64 }),
    type: varchar("type", { length: 8 }).notNull(), // B | C
    status: varchar("status", { length: 32 }).notNull(), // active | inactive | suspended
    contactPerson: varchar("contact_person", { length: 128 }),
    contactPhone: varchar("contact_phone", { length: 32 }),
    contactEmail: varchar("contact_email", { length: 255 }),
    industry: varchar("industry", { length: 128 }),
    address: text("address"),
    /** 销售经理；FK user_staff，表单选人 */
    salesManagerId: text("sales_manager_id").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    lifecyclePhase: varchar("lifecycle_phase", { length: 64 }),
    expectedScale: jsonb("expected_scale"),
    observedScaleSummary: jsonb("observed_scale_summary"),
    testStartedOn: date("test_started_on"),
    testCompletedOn: date("test_completed_on"),
    conversionDate: date("conversion_date"),
    conversionTrigger: varchar("conversion_trigger", { length: 128 }),
    ...crmTimestamps,
  },
  (table) => [
    uniqueIndex("customer_code_uk").on(table.customerCode),
    index("customer_status_idx").on(table.status),
    index("customer_type_idx").on(table.type),
  ],
)

/**
 * 平台计费租户；归属一个 customer
 * 每客户至多一个 is_default = true（部分唯一索引，落库时需 migration 声明）
 */
export const billingTenant = pgTable(
  "tenant",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 255 }).notNull(),
    platformTenantId: varchar("platform_tenant_id", { length: 128 }),
    isDefault: boolean("is_default").notNull().default(false),
    status: varchar("status", { length: 32 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    overdue_at: timestamp("overdue_at", { withTimezone: true }),
    credit_limit: tenantMoney("credit_limit"),
    balance: tenantMoney("balance").notNull().default("0"),
    /** 平台侧租户注册时间（OpenAPI create_time） */
    platformRegisteredAt: timestamp("platform_registered_at", { withTimezone: true }),
    ...crmTimestamps,
  },
  (table) => [
    uniqueIndex("tenant_platform_tenant_id_uk").on(table.platformTenantId),
    uniqueIndex("tenant_customer_default_uk")
      .on(table.customerId)
      .where(sql`${table.isDefault} = true`),
    index("tenant_customer_id_idx").on(table.customerId),
  ],
)

/** 业务线字典 */
export const businessLine = pgTable(
  "business_line",
  {
    id: text("id").primaryKey(),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    status: varchar("status", { length: 32 }).notNull(), // active | inactive
    ...crmTimestamps,
  },
  (table) => [uniqueIndex("business_line_code_uk").on(table.code)],
)

/** 经营项目 */
export const crmProject = pgTable(
  "project",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "restrict" }),
    primaryTenantId: text("primary_tenant_id").references(() => billingTenant.id, {
      onDelete: "set null",
    }),
    businessLineId: text("business_line_id")
      .notNull()
      .references(() => businessLine.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    stage: varchar("stage", { length: 32 }).notNull(), // lead | testing | converted
    status: varchar("status", { length: 32 }).notNull(), // active | paused | completed
    startDate: date("start_date"),
    endDate: date("end_date"),
    monthlyBudget: money("monthly_budget"),
    /** 上月充值快照，由月度数据同步更新 */
    lastMonthRecharge: money("last_month_recharge").notNull().default("0"),
    /** 本月充值快照，由月度数据同步更新 */
    thisMonthRecharge: money("this_month_recharge").notNull().default("0"),
    /** 上月消费快照，由月度数据同步更新 */
    lastMonthConsumption: money("last_month_consumption").notNull().default("0"),
    /** 本月消费快照，由月度数据同步更新 */
    thisMonthConsumption: money("this_month_consumption").notNull().default("0"),
    /** 可选缓存，非财务真值 */
    balance: money("balance"),
    ...crmTimestamps,
  },
  (table) => [
    index("project_customer_id_idx").on(table.customerId),
    index("project_primary_tenant_id_idx").on(table.primaryTenantId),
    index("project_business_line_id_idx").on(table.businessLineId),
    index("project_stage_idx").on(table.stage),
    index("project_status_idx").on(table.status),
  ],
)

/** 项目标签字典 */
export const projectTag = pgTable(
  "project_tag",
  {
    id: text("id").primaryKey(),
    name: varchar("name", { length: 128 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("project_tag_name_uk").on(table.name)],
)

/** 项目与标签关联 */
export const projectTagAssignment = pgTable(
  "project_tag_assignment",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => crmProject.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => projectTag.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.tagId] }),
    index("project_tag_assignment_tag_id_idx").on(table.tagId),
  ],
)

/** 项目关联计费账户（多 tenant 归因）；须满足 R1.3 同 customer */
export const projectTenant = pgTable(
  "project_tenant",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => crmProject.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => billingTenant.id, { onDelete: "cascade" }),
    bindingRole: varchar("binding_role", { length: 64 }),
    bindingLabel: varchar("binding_label", { length: 255 }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("project_tenant_project_tenant_uk").on(table.projectId, table.tenantId),
    index("project_tenant_tenant_id_idx").on(table.tenantId),
  ],
)

/** 内部员工主数据 */
export const userStaff = pgTable(
  "user_staff",
  {
    id: text("id").primaryKey(),
    employeeNo: varchar("employee_no", { length: 64 }),
    displayName: varchar("display_name", { length: 128 }).notNull(),
    mobile: varchar("mobile", { length: 32 }).notNull(),
    email: varchar("email", { length: 255 }),
    status: varchar("status", { length: 32 }).notNull(), // active | inactive
    department: varchar("department", { length: 128 }),
    position: varchar("position", { length: 128 }),
    /** 应用角色：admin | user | member */
    roles: jsonb("roles").$type<string[]>().notNull().default([]),
    isDefaultPreSales: boolean("is_default_pre_sales").notNull().default(false),
    isDefaultAccountManager: boolean("is_default_account_manager").notNull().default(false),
    isDefaultDeliveryManager: boolean("is_default_delivery_manager").notNull().default(false),
    isDefaultProjectManager: boolean("is_default_project_manager").notNull().default(false),
    ...crmTimestamps,
  },
  (table) => [
    uniqueIndex("user_staff_employee_no_uk").on(table.employeeNo),
    uniqueIndex("user_staff_email_uk").on(table.email),
    index("user_staff_status_idx").on(table.status),
    uniqueIndex("user_staff_default_pre_sales_uk")
      .on(table.isDefaultPreSales)
      .where(sql`${table.isDefaultPreSales} = true`),
    uniqueIndex("user_staff_default_account_manager_uk")
      .on(table.isDefaultAccountManager)
      .where(sql`${table.isDefaultAccountManager} = true`),
    uniqueIndex("user_staff_default_delivery_manager_uk")
      .on(table.isDefaultDeliveryManager)
      .where(sql`${table.isDefaultDeliveryManager} = true`),
    uniqueIndex("user_staff_default_project_manager_uk")
      .on(table.isDefaultProjectManager)
      .where(sql`${table.isDefaultProjectManager} = true`),
  ],
)

// ---------------------------------------------------------------------------
// §3.8 项目人员
// ---------------------------------------------------------------------------

/**
 * 项目四人组（售前/客户经理/交付/项目经理）
 * 当前主责：effective_to IS NULL；每项目每 role_type 至多一条（部分唯一）
 */
export const projectStaffAssignment = pgTable(
  "project_staff_assignment",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => crmProject.id, { onDelete: "cascade" }),
    userStaffId: text("user_staff_id")
      .notNull()
      .references(() => userStaff.id, { onDelete: "restrict" }),
    roleType: varchar("role_type", { length: 32 }).notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    createdBy: text("created_by").references(() => userStaff.id, { onDelete: "set null" }),
  },
  (table) => [
    uniqueIndex("project_staff_assignment_current_role_uk")
      .on(table.projectId, table.roleType)
      .where(sql`${table.effectiveTo} is null`),
    index("project_staff_assignment_user_staff_id_idx").on(table.userStaffId),
    index("project_staff_assignment_project_id_idx").on(table.projectId),
  ],
)

/** 客户级客户经理分配（统计「负责客户数」） */
export const accountManagerAssignment = pgTable(
  "account_manager_assignment",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    userStaffId: text("user_staff_id")
      .notNull()
      .references(() => userStaff.id, { onDelete: "restrict" }),
    roleType: varchar("role_type", { length: 32 }).notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("account_manager_assignment_customer_id_idx").on(table.customerId),
    index("account_manager_assignment_user_staff_id_idx").on(table.userStaffId),
  ],
)

// ---------------------------------------------------------------------------
// §3.3 商务与资金流
// ---------------------------------------------------------------------------

export const contract = pgTable(
  "contract",
  {
    id: text("id").primaryKey(),
    contractNo: varchar("contract_no", { length: 64 }),
    customerId: text("customer_id").references(() => customer.id, { onDelete: "set null" }),
    tenantId: text("tenant_id").references(() => billingTenant.id, { onDelete: "set null" }),
    projectId: text("project_id").references(() => crmProject.id, { onDelete: "set null" }),
    type: varchar("type", { length: 32 }).notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    totalAmount: money("total_amount").notNull(),
    paidAmount: money("paid_amount").notNull().default("0"),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    signerName: varchar("signer_name", { length: 128 }),
    terms: text("terms"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("contract_contract_no_uk").on(table.contractNo),
    index("contract_customer_id_idx").on(table.customerId),
    index("contract_project_id_idx").on(table.projectId),
  ],
)

/** 充值；必须 tenant_id */
export const recharge = pgTable(
  "recharge",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => billingTenant.id, { onDelete: "restrict" }),
    projectId: text("project_id").references(() => crmProject.id, { onDelete: "set null" }),
    amount: money("amount").notNull(), //充值金额
    paymentMethod: varchar("payment_method", { length: 32 }).notNull(), //支付方式：银行转账、支付宝、微信、发票
    status: varchar("status", { length: 32 }).notNull(), //充值状态：待支付、已支付、已取消
    transactionId: varchar("transaction_id", { length: 128 }), //交易流水号
    refundId: varchar("refund_id", { length: 128 }), //退款流水号
    refundAmount: money("refund_amount").notNull().default("0"), //退款金额
    remark: text("remark"), //充值备注
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }), //充值完成时间
  },
  (table) => [
    uniqueIndex("recharge_transaction_id_uk").on(table.transactionId),
    index("recharge_tenant_id_idx").on(table.tenantId),
    index("recharge_project_id_idx").on(table.projectId),
  ],
)

export const coupon = pgTable(
  "coupon",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => billingTenant.id, { onDelete: "restrict" }),
    projectId: text("project_id").references(() => crmProject.id, { onDelete: "set null" }),
    code: varchar("code", { length: 64 }),
    name: varchar("name", { length: 255 }).notNull(),
    type: varchar("type", { length: 32 }).notNull(),
    value: money("value").notNull(),
    minAmount: money("min_amount"),
    status: varchar("status", { length: 32 }).notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
    expiredAt: timestamp("expired_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("coupon_code_uk").on(table.code),
    index("coupon_tenant_id_idx").on(table.tenantId),
  ],
)

// ---------------------------------------------------------------------------
// §3.4 用量、任务与订单
// ---------------------------------------------------------------------------

export const consumptionRecord = pgTable(
  "consumption_record",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id").references(() => customer.id, { onDelete: "set null" }),
    tenantId: text("tenant_id").references(() => billingTenant.id, { onDelete: "set null" }),
    projectId: text("project_id").references(() => crmProject.id, { onDelete: "set null" }),
    productLine: varchar("product_line", { length: 64 }).notNull(),
    resourceName: varchar("resource_name", { length: 255 }),
    amount: money("amount").notNull(),
    duration: numeric("duration"),
    unit: varchar("unit", { length: 32 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("consumption_record_project_occurred_idx").on(table.projectId, table.occurredAt),
    index("consumption_record_tenant_occurred_idx").on(table.tenantId, table.occurredAt),
  ],
)

/** 算力运行任务（计费域）；非 follow_up_task */
export const computeTask = pgTable(
  "compute_task",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => billingTenant.id, { onDelete: "restrict" }),
    projectId: text("project_id").references(() => crmProject.id, { onDelete: "set null" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    status: varchar("status", { length: 32 }).notNull(),
    resourceType: varchar("resource_type", { length: 64 }),
    gpuCount: integer("gpu_count"),
    cpuCount: integer("cpu_count"),
    memoryGb: integer("memory_gb"),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }),
    cost: money("cost"),
  },
  (table) => [
    index("compute_task_tenant_id_idx").on(table.tenantId),
    index("compute_task_project_id_idx").on(table.projectId),
  ],
)

export const commerceOrder = pgTable(
  "commerce_order",
  {
    id: text("id").primaryKey(),
    orderNo: varchar("order_no", { length: 64 }), //订单编号
    customerId: text("customer_id").references(() => customer.id, { onDelete: "set null" }), //客户ID
    tenantId: text("tenant_id").references(() => billingTenant.id, { onDelete: "set null" }), //租户ID
    projectId: text("project_id").references(() => crmProject.id, { onDelete: "set null" }), //项目ID
    productLine: varchar("product_line", { length: 64 }), //产品线
    status: varchar("status", { length: 32 }).notNull(), //订单状态
    dataCenterId: text("data_center_id"), //关联的机房Id
    dataCenterName: varchar("data_center_name", { length: 255 }), //机房名称
    amount: money("amount").notNull(), //订单总金额
    balanceAmount: money("balance_amount").notNull(), //余额消费金额
    couponAmount: money("coupon_amount").notNull().default("0"), //券消费金额
    discountAmount: money("discount_amount").notNull().default("0"), //优惠金额
    deviceCount: integer("device_count"), //设备数量
    deviceModel: varchar("device_model", { length: 64 }), //设备型号
    gpuCount: integer("gpu_count"), //GPU数量
    unit: varchar("unit", { length: 32 }), //单位，小时、天、月、个
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("commerce_order_order_no_uk").on(table.orderNo),
    index("commerce_order_project_id_idx").on(table.projectId),
  ],
)

export const commerceOrderItem = pgTable(
  "commerce_order_item",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => commerceOrder.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    quantity: numeric("quantity").notNull(),
    unitPrice: money("unit_price").notNull(),
    total: money("total").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("commerce_order_item_order_id_idx").on(table.orderId)],
)

// ---------------------------------------------------------------------------
// §3.5 账单与时间线
// ---------------------------------------------------------------------------

export const tenantBill = pgTable(
  "tenant_bill",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id").references(() => customer.id, { onDelete: "set null" }),
    tenantId: text("tenant_id").references(() => billingTenant.id, { onDelete: "set null" }),
    projectId: text("project_id").references(() => crmProject.id, { onDelete: "set null" }),
    billMonth: varchar("bill_month", { length: 7 }).notNull(), // YYYY-MM
    totalAmount: money("total_amount").notNull(),
    balanceAmount: money("balance_amount").notNull(), // 余额消费总额
    couponAmount: money("coupon_amount").notNull(), // 券消费总额
    status: varchar("status", { length: 32 }).notNull(),
    dueDate: date("due_date").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    platformPeriodStart: timestamp("platform_period_start", { withTimezone: true }),
    platformPeriodEnd: timestamp("platform_period_end", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("tenant_bill_tenant_month_uk").on(table.tenantId, table.billMonth),
    index("tenant_bill_tenant_id_idx").on(table.tenantId),
  ],
)

export const tenantBillDetail = pgTable(
  "tenant_bill_detail",
  {
    id: text("id").primaryKey(),
    billId: text("bill_id")
      .notNull()
      .references(() => tenantBill.id, { onDelete: "cascade" }),
    productLine: varchar("product_line", { length: 64 }),
    resourceName: varchar("resource_name", { length: 255 }),
    usage: numeric("usage"),
    unit: varchar("unit", { length: 32 }),
    unitPrice: money("unit_price"),
    amount: money("amount").notNull(), // 消费总金额
    balanceAmount: money("balance_amount").notNull(), // 余额消费金额
    couponAmount: money("coupon_amount").notNull(), // 券消费金额
    type: varchar("type", { length: 32 }).notNull(), // 付费类型： 预付费、后付费
  },
  (table) => [index("tenant_bill_detail_bill_id_idx").on(table.billId)],
)

export const projectActivity = pgTable(
  "project_activity",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => crmProject.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 32 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    authorName: varchar("author_name", { length: 128 }),
    authorStaffId: text("author_staff_id").references(() => userStaff.id, {
      onDelete: "set null",
    }),
    authorRole: varchar("author_role", { length: 32 }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("project_activity_project_id_idx").on(table.projectId)],
)

export const projectActivityAttachment = pgTable(
  "project_activity_attachment",
  {
    id: text("id").primaryKey(),
    activityId: text("activity_id")
      .notNull()
      .references(() => projectActivity.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileSize: bigint("file_size", { mode: "number" }),
    mimeType: varchar("mime_type", { length: 128 }),
    storageUri: varchar("storage_uri", { length: 1024 }).notNull(),
  },
  (table) => [index("project_activity_attachment_activity_id_idx").on(table.activityId)],
)

// ---------------------------------------------------------------------------
// §3.6 客户动态与日历
// ---------------------------------------------------------------------------

export const activityTypeDefinition = pgTable(
  "activity_type_definition",
  {
    id: text("id").primaryKey(),
    typeCode: varchar("type_code", { length: 64 }).notNull(),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    category: varchar("category", { length: 32 }),
    isPlatformProjection: boolean("is_platform_projection").notNull().default(true),
    sortOrder: integer("sort_order"),
  },
  (table) => [uniqueIndex("activity_type_definition_type_code_uk").on(table.typeCode)],
)

/** 客户动态（日历）；与 project_activity 分立 */
export const accountActivity = pgTable(
  "account_activity",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id").references(() => billingTenant.id, { onDelete: "set null" }),
    activityTypeId: text("activity_type_id").references(() => activityTypeDefinition.id, {
      onDelete: "set null",
    }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    refDomain: varchar("ref_domain", { length: 64 }),
    refId: text("ref_id"),
    idempotencyKey: varchar("idempotency_key", { length: 128 }),
    actorUserId: text("actor_user_id").references(() => userStaff.id, { onDelete: "set null" }),
    titleSnapshot: varchar("title_snapshot", { length: 255 }),
    summarySnapshot: text("summary_snapshot"),
    payload: jsonb("payload"),
    visibility: varchar("visibility", { length: 32 }),
  },
  (table) => [
    uniqueIndex("account_activity_idempotency_key_uk").on(table.idempotencyKey),
    index("account_activity_customer_occurred_idx").on(table.customerId, table.occurredAt),
    index("account_activity_tenant_occurred_idx").on(table.tenantId, table.occurredAt),
  ],
)

/** 工作日历；应用层 id = region_code + '__' + calendar_date */
export const calendarWorkday = pgTable(
  "calendar_workday",
  {
    calendarDate: date("calendar_date").notNull(),
    regionCode: varchar("region_code", { length: 16 }).notNull(),
    isWorkday: boolean("is_workday").notNull(),
  },
  (table) => [primaryKey({ columns: [table.calendarDate, table.regionCode] })],
)

// ---------------------------------------------------------------------------
// §3.7 经营扩展（Store / 待 UI）
// ---------------------------------------------------------------------------

export const lifecycleMilestone = pgTable(
  "lifecycle_milestone",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    milestoneType: varchar("milestone_type", { length: 64 }).notNull(),
    milestoneDate: date("milestone_date").notNull(),
    filledBy: text("filled_by").references(() => userStaff.id, { onDelete: "set null" }),
    filledAt: timestamp("filled_at", { withTimezone: true }).notNull(),
    notes: text("notes"),
  },
  (table) => [index("lifecycle_milestone_customer_id_idx").on(table.customerId)],
)

export const milestoneEvidence = pgTable(
  "milestone_evidence",
  {
    id: text("id").primaryKey(),
    lifecycleMilestoneId: text("lifecycle_milestone_id")
      .notNull()
      .references(() => lifecycleMilestone.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    storageUri: varchar("storage_uri", { length: 1024 }).notNull(),
    fileHash: varchar("file_hash", { length: 128 }),
    uploadedBy: text("uploaded_by").references(() => userStaff.id, { onDelete: "set null" }),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("milestone_evidence_lifecycle_milestone_id_idx").on(table.lifecycleMilestoneId),
  ],
)

export const testVoucherIssue = pgTable(
  "test_voucher_issue",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id").references(() => billingTenant.id, { onDelete: "set null" }),
    operatorId: text("operator_id").references(() => userStaff.id, { onDelete: "set null" }),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
    issueStatus: varchar("issue_status", { length: 32 }).notNull(),
    couponId: text("coupon_id").references(() => coupon.id, { onDelete: "set null" }),
    couponConfig: jsonb("coupon_config"),
    remark: text("remark"),
  },
  (table) => [index("test_voucher_issue_customer_id_idx").on(table.customerId)],
)

/** 轻量合同摘要；全量合同见 contract */
export const contractSnapshot = pgTable(
  "contract_snapshot",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    tenantId: text("tenant_id").references(() => billingTenant.id, { onDelete: "set null" }),
    contractNo: varchar("contract_no", { length: 64 }),
    contractUrl: varchar("contract_url", { length: 1024 }),
    signedOn: date("signed_on"),
    amountSummary: varchar("amount_summary", { length: 255 }),
    externalCrmId: varchar("external_crm_id", { length: 128 }),
  },
  (table) => [index("contract_snapshot_customer_id_idx").on(table.customerId)],
)

/** CRM 视图充值订单（与 recharge 并存） */
export const rechargeOrder = pgTable(
  "recharge_order",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id").references(() => customer.id, { onDelete: "set null" }),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => billingTenant.id, { onDelete: "restrict" }),
    amount: money("amount").notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("CNY"),
    status: varchar("status", { length: 32 }).notNull(),
    type: varchar("type", { length: 32 }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    externalTradeNo: varchar("external_trade_no", { length: 128 }),
  },
  (table) => [index("recharge_order_tenant_id_idx").on(table.tenantId)],
)

/** 客户消费明细，按天汇总 */
export const consumptionUsageDaily = pgTable(
  "consumption_usage_daily",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id").references(() => customer.id, { onDelete: "set null" }),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => billingTenant.id, { onDelete: "restrict" }),
    usageDate: date("usage_date").notNull(),
    productLine: varchar("product_line", { length: 64 }),
    unit: varchar("unit", { length: 32 }),
    amount: money("amount"), // 消费金额
    balance: tenantMoney("balance"), // 平台同步租户金额：允许负值，精度覆盖平台 coin（约 12 位整数）
    voucherAmount: money("voucher_amount"), // 算力券消费金额
    balanceAmount: money("balance_amount"), // 余额消费金额
    gpuSeconds: numeric("gpu_seconds"), // GPU 秒数
  },
  (table) => [
    index("consumption_usage_daily_tenant_date_idx").on(table.tenantId, table.usageDate),
  ],
)

export const conversionRecord = pgTable(
  "conversion_record",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    conversionDate: date("conversion_date").notNull(),
    triggerType: varchar("trigger_type", { length: 64 }).notNull(),
    candidateSignedOn: date("candidate_signed_on"),
    candidateScaleMetOn: date("candidate_scale_met_on"),
    candidateRechargeGeThresholdAt: timestamp("candidate_recharge_ge_threshold_at", {
      withTimezone: true,
    }),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("conversion_record_customer_id_idx").on(table.customerId)],
)

export const engagementDocument = pgTable(
  "engagement_document",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => crmProject.id, { onDelete: "set null" }),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => userStaff.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 255 }).notNull(),
    versionNo: integer("version_no").notNull().default(1),
    storageUri: varchar("storage_uri", { length: 1024 }).notNull(),
    visibility: varchar("visibility", { length: 32 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("engagement_document_customer_id_idx").on(table.customerId)],
)

/** CRM 协作跟进；禁止仅挂 tenant */
export const followUpTask = pgTable(
  "follow_up_task",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => crmProject.id, { onDelete: "set null" }),
    assigneeId: text("assignee_id").references(() => userStaff.id, { onDelete: "set null" }),
    sourceAccountActivityId: text("source_account_activity_id").references(
      () => accountActivity.id,
      { onDelete: "set null" },
    ),
    title: varchar("title", { length: 255 }).notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    dueOn: date("due_on"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completionNote: text("completion_note"),
  },
  (table) => [
    index("follow_up_task_customer_id_idx").on(table.customerId),
    index("follow_up_task_project_id_idx").on(table.projectId),
  ],
)

export const engagementComment = pgTable(
  "engagement_comment",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    accountActivityId: text("account_activity_id")
      .notNull()
      .references(() => accountActivity.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => userStaff.id, { onDelete: "restrict" }),
    parentCommentId: text("parent_comment_id"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("engagement_comment_account_activity_id_idx").on(table.accountActivityId),
  ],
)

// ---------------------------------------------------------------------------
// Relations（查询用）
// ---------------------------------------------------------------------------

export const customerRelations = relations(customer, ({ many, one }) => ({
  billingTenants: many(billingTenant),
  projects: many(crmProject),
  accountManagerAssignments: many(accountManagerAssignment),
  salesManager: one(userStaff, {
    fields: [customer.salesManagerId],
    references: [userStaff.id],
  }),
}))

export const billingTenantRelations = relations(billingTenant, ({ one, many }) => ({
  customer: one(customer, {
    fields: [billingTenant.customerId],
    references: [customer.id],
  }),
  recharges: many(recharge),
  projectLinks: many(projectTenant),
}))

export const crmProjectRelations = relations(crmProject, ({ one, many }) => ({
  customer: one(customer, {
    fields: [crmProject.customerId],
    references: [customer.id],
  }),
  primaryTenant: one(billingTenant, {
    fields: [crmProject.primaryTenantId],
    references: [billingTenant.id],
  }),
  businessLine: one(businessLine, {
    fields: [crmProject.businessLineId],
    references: [businessLine.id],
  }),
  staffAssignments: many(projectStaffAssignment),
  tenantLinks: many(projectTenant),
  tagAssignments: many(projectTagAssignment),
  activities: many(projectActivity),
  bills: many(tenantBill),
}))

export const projectTagRelations = relations(projectTag, ({ many }) => ({
  assignments: many(projectTagAssignment),
}))

export const projectTagAssignmentRelations = relations(projectTagAssignment, ({ one }) => ({
  project: one(crmProject, {
    fields: [projectTagAssignment.projectId],
    references: [crmProject.id],
  }),
  tag: one(projectTag, {
    fields: [projectTagAssignment.tagId],
    references: [projectTag.id],
  }),
}))

export const projectStaffAssignmentRelations = relations(projectStaffAssignment, ({ one }) => ({
  project: one(crmProject, {
    fields: [projectStaffAssignment.projectId],
    references: [crmProject.id],
  }),
  userStaff: one(userStaff, {
    fields: [projectStaffAssignment.userStaffId],
    references: [userStaff.id],
  }),
}))

export const commerceOrderRelations = relations(commerceOrder, ({ one, many }) => ({
  items: many(commerceOrderItem),
  project: one(crmProject, {
    fields: [commerceOrder.projectId],
    references: [crmProject.id],
  }),
}))

export const tenantBillRelations = relations(tenantBill, ({ one, many }) => ({
  details: many(tenantBillDetail),
  project: one(crmProject, {
    fields: [tenantBill.projectId],
    references: [crmProject.id],
  }),
}))

// ---------------------------------------------------------------------------
// 类型导出
// ---------------------------------------------------------------------------

export type CustomerRow = typeof customer.$inferSelect
export type NewCustomerRow = typeof customer.$inferInsert
export type BillingTenantRow = typeof billingTenant.$inferSelect
export type CrmProjectRow = typeof crmProject.$inferSelect
export type ProjectTagRow = typeof projectTag.$inferSelect
export type UserStaffRow = typeof userStaff.$inferSelect
