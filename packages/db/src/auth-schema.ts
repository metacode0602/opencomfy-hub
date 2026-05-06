import { relations } from "drizzle-orm"
import { pgTable, text, timestamp, boolean, index, varchar, integer, jsonb } from "drizzle-orm/pg-core"
import { createId } from '@paralleldrive/cuid2'

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
})

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    activeOrganizationId: text("active_organization_id")
      .references(() => organization.id, { onDelete: "cascade" }),
    impersonatedBy: text('impersonated_by'),
  },
  (table) => [index("session_userId_idx").on(table.userId)]
)

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)]
)

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
)

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}))



/**
 * 用户邀请码表 - 存储用户的邀请码信息
 */
export const userInvitationCodes = pgTable(
  'user_invitation_codes',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    code: varchar('code', { length: 20 }).notNull().unique(), // 邀请码，6-8位随机字符串
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at'), // 可选过期时间
    isActive: boolean('is_active').notNull().default(true),
    usageCount: integer('usage_count').notNull().default(0), // 被使用的次数
    maxUsage: integer('max_usage'), // 最大使用次数限制，NULL表示无限制
  },
  (table) => [
    index('user_invitation_codes_user_id_idx').on(table.userId),
    index('user_invitation_codes_code_idx').on(table.code),
    index('user_invitation_codes_active_idx').on(table.isActive),
  ]
)

/**
 * 用户邀请关系表 - 存储用户间的邀请关系
 */
export const userInvitationRelations = pgTable(
  'user_invitation_relations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    inviterId: text('inviter_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    inviteeId: text('invitee_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    invitationCodeId: text('invitation_code_id')
      .references(() => userInvitationCodes.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    status: varchar('status', { length: 20 }).notNull().default('active'), // active, cancelled
    rewardGranted: boolean('reward_granted').notNull().default(false), // 是否已发放奖励
    metadata: jsonb('metadata').default({}), // 扩展字段
  },
  (table) => [
    index('user_invitation_relations_inviter_idx').on(table.inviterId),
    index('user_invitation_relations_invitee_idx').on(table.inviteeId),
    index('user_invitation_relations_code_idx').on(table.invitationCodeId),
    index('user_invitation_relations_unique_idx').on(table.inviterId, table.inviteeId),
  ]
)

// 邀请码表的关系定义
export const userInvitationCodesRelations = relations(userInvitationCodes, ({ one, many }) => ({
  user: one(user, {
    fields: [userInvitationCodes.userId],
    references: [user.id],
  }),
  relations: many(userInvitationRelations),
}))

// 邀请关系表的关系定义
export const userInvitationRelationsRelations = relations(userInvitationRelations, ({ one }) => ({
  inviter: one(user, {
    fields: [userInvitationRelations.inviterId],
    references: [user.id],
  }),
  invitee: one(user, {
    fields: [userInvitationRelations.inviteeId],
    references: [user.id],
  }),
  invitationCode: one(userInvitationCodes, {
    fields: [userInvitationRelations.invitationCodeId],
    references: [userInvitationCodes.id],
  }),
}))

// 类型导出
export type UserInvitationCode = typeof userInvitationCodes.$inferSelect
export type NewUserInvitationCode = typeof userInvitationCodes.$inferInsert
export type UserInvitationRelation = typeof userInvitationRelations.$inferSelect
export type NewUserInvitationRelation = typeof userInvitationRelations.$inferInsert

export const organization = pgTable('organization', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique(),
  logo: text('logo'),
  createdAt: timestamp('created_at').notNull(),
  metadata: jsonb('metadata'),
  entryApproved: boolean('entry_approved').notNull().default(false),
  isCurrent: boolean('is_current').notNull().default(false),
  status: text('status').default('active').notNull(),
})

export type Organization = typeof organization.$inferSelect

export const member = pgTable('member', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').default('member').notNull(),
  createdAt: timestamp('created_at').notNull(),
})

export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [member.userId],
    references: [user.id],
  }),
}))

export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
}))

export type Member = typeof member.$inferSelect & {
  user: typeof user.$inferSelect
}

export const invitation = pgTable('invitation', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role'),
  status: text('status').default('pending').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  inviterId: text('inviter_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
}, (table) => [
  index('invitation_organization_id_idx').on(table.organizationId),
  index('invitation_email_idx').on(table.email),
  index('invitation_inviter_id_idx').on(table.inviterId),
])

export enum Role {
  Admin = 'admin',
  Member = 'member',
}