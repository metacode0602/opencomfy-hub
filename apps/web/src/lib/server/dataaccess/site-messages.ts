import { db } from '@/lib/db'
import type {
  SiteMessageDetail,
  SiteMessageListResult,
  SiteMessageReadFilter,
} from '@/lib/types/site-messages'
import { userSiteMessage, type NewUserSiteMessage } from '@workspace/db/schema'
import { and, count, desc, eq } from 'drizzle-orm'

const DEFAULT_PAGE_SIZE = 10

function toIso(value: Date | null | undefined): string | null {
  if (!value) return null
  return value.toISOString()
}

function mapListItem(row: typeof userSiteMessage.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    category: row.category,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  }
}

function mapDetail(row: typeof userSiteMessage.$inferSelect): SiteMessageDetail {
  return {
    ...mapListItem(row),
    content: row.content,
    links: row.links ?? [],
    readAt: toIso(row.readAt),
  }
}

const demoMessages: Omit<NewUserSiteMessage, 'id' | 'userId'>[] = [
  {
    title: '账单待确认提醒',
    summary: '项目「星云算力-A」2026 年 5 月账单已生成，请在 3 个工作日内完成确认。',
    content: `您好，

项目 **星云算力-A** 的 2026 年 5 月账单已生成，总消费 **¥128,450.00**。

请在收到本消息后 **3 个工作日内** 完成确认。如有疑问，请联系财务对接人或在系统中查看明细。`,
    category: '财务',
    links: [{ label: '查看账单明细', href: '/dashboard/projects' }],
    read: false,
    createdAt: new Date('2026-06-15T09:30:00.000Z'),
  },
  {
    title: '供应商设备导入完成',
    summary: '供应商「华东云」机房设备变更导入已成功，共 42 条记录。',
    content: `供应商 **华东云** 的设备变更导入任务已完成。

- 成功：40 条
- 警告：2 条（未知变更动作，已保留原文）
- 失败：0 条

您可以在 [供应商设备页](/supplier/devices) 查看详情，或点击底部按钮直接进入。`,
    category: '供应链',
    links: [{ label: '前往设备列表', href: '/supplier/devices' }],
    read: false,
    createdAt: new Date('2026-06-14T16:20:00.000Z'),
  },
  {
    title: '系统维护通知',
    summary: '本周六 02:00–04:00 将进行例行维护，期间部分功能可能不可用。',
    content: `为提升系统稳定性，我们计划于 **2026 年 6 月 21 日（周六）02:00–04:00** 进行例行维护。

维护期间以下功能可能暂时不可用：
- 账单同步
- 设备导入提交

如有紧急问题，请通过 [工单系统](https://example.com/support) 联系我们。`,
    category: '系统',
    links: [{ label: '打开工单系统', href: 'https://example.com/support', external: true }],
    read: true,
    readAt: new Date('2026-06-13T11:00:00.000Z'),
    createdAt: new Date('2026-06-13T10:00:00.000Z'),
  },
]

async function seedDemoMessagesIfEmpty(userId: string) {
  const [existing] = await db
    .select({ total: count() })
    .from(userSiteMessage)
    .where(eq(userSiteMessage.userId, userId))

  if ((existing?.total ?? 0) > 0) {
    return
  }

  await db.insert(userSiteMessage).values(
    demoMessages.map((message) => ({
      ...message,
      userId,
    })),
  )
}

function buildReadFilter(userId: string, readFilter: SiteMessageReadFilter) {
  const conditions = [eq(userSiteMessage.userId, userId)]

  if (readFilter === 'unread') {
    conditions.push(eq(userSiteMessage.read, false))
  } else if (readFilter === 'read') {
    conditions.push(eq(userSiteMessage.read, true))
  }

  return and(...conditions)
}

export const siteMessagesDataAccess = {
  async list(input: {
    userId: string
    page: number
    pageSize: number
    readFilter: SiteMessageReadFilter
  }): Promise<SiteMessageListResult> {
    await seedDemoMessagesIfEmpty(input.userId)

    const page = Math.max(1, input.page)
    const pageSize = Math.min(50, Math.max(1, input.pageSize))
    const offset = (page - 1) * pageSize
    const whereClause = buildReadFilter(input.userId, input.readFilter)

    const [totalRow] = await db
      .select({ total: count() })
      .from(userSiteMessage)
      .where(whereClause)

    const total = totalRow?.total ?? 0
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize)

    const rows = await db
      .select()
      .from(userSiteMessage)
      .where(whereClause)
      .orderBy(desc(userSiteMessage.createdAt), desc(userSiteMessage.id))
      .limit(pageSize)
      .offset(offset)

    return {
      items: rows.map(mapListItem),
      page,
      pageSize,
      total,
      totalPages,
    }
  },

  async getUnreadCount(userId: string): Promise<number> {
    await seedDemoMessagesIfEmpty(userId)

    const [row] = await db
      .select({ total: count() })
      .from(userSiteMessage)
      .where(and(eq(userSiteMessage.userId, userId), eq(userSiteMessage.read, false)))

    return row?.total ?? 0
  },

  async getById(userId: string, id: string): Promise<SiteMessageDetail | null> {
    const row = await db.query.userSiteMessage.findFirst({
      where: and(eq(userSiteMessage.id, id), eq(userSiteMessage.userId, userId)),
    })

    if (!row) return null
    return mapDetail(row)
  },

  async markRead(userId: string, id: string): Promise<boolean> {
    const [updated] = await db
      .update(userSiteMessage)
      .set({
        read: true,
        readAt: new Date(),
      })
      .where(and(eq(userSiteMessage.id, id), eq(userSiteMessage.userId, userId)))
      .returning({ id: userSiteMessage.id })

    return Boolean(updated)
  },

  async markAllRead(userId: string): Promise<number> {
    const updated = await db
      .update(userSiteMessage)
      .set({
        read: true,
        readAt: new Date(),
      })
      .where(and(eq(userSiteMessage.userId, userId), eq(userSiteMessage.read, false)))
      .returning({ id: userSiteMessage.id })

    return updated.length
  },
}

export { DEFAULT_PAGE_SIZE as SITE_MESSAGE_DEFAULT_PAGE_SIZE }
