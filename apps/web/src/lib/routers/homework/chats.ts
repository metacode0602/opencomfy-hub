import { createTRPCRouter, protectedProcedure } from '../trpc'
import { z } from 'zod'
import { db } from '@/db/drizzle'
import { chats, messages } from '@/db/schema'
import { eq, desc, and, ilike, sql, count, asc } from 'drizzle-orm'

export const chatsRouter = createTRPCRouter({
  /**
   * 获取对话列表（分页，支持过滤）
   */
  getChatsPaginated: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(10),
        search: z.string().optional(),
        subject: z.string().optional(),
        grade: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const userId = ctx.user.id
        const { page, limit, search, subject, grade } = input
        const offset = (page - 1) * limit

        // 构建查询条件
        const conditions = [eq(chats.userId, userId)]

        if (search) {
          conditions.push(ilike(chats.title, `%${search}%`))
        }

        if (subject && subject !== 'all') {
          conditions.push(eq(chats.subject, subject))
        }

        if (grade && grade !== 'all') {
          conditions.push(eq(chats.grade, grade))
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined

        // 获取总数
        const countResult = await db.select({ count: count() }).from(chats).where(whereClause)

        const total = countResult[0]?.count || 0
        const totalPages = Math.ceil(total / limit)

        // 获取对话列表，并统计每个对话的消息数
        const chatsList = await db
          .select({
            id: chats.id,
            userId: chats.userId,
            title: chats.title,
            subject: chats.subject,
            grade: chats.grade,
            cover: chats.cover,
            personaId: chats.personaId,
            originalChatId: chats.originalChatId,
            isPinned: chats.isPinned,
            public: chats.public,
            shareAttachments: chats.shareAttachments,
            createdAt: chats.createdAt,
            updatedAt: chats.updatedAt,
            messageCount: sql<number>`(
              SELECT COUNT(*)::int
              FROM ${messages}
              WHERE ${messages.chatId} = ${chats.id}
            )`,
          })
          .from(chats)
          .where(whereClause)
          .orderBy(desc(chats.updatedAt))
          .limit(limit)
          .offset(offset)

        return {
          success: true,
          data: chatsList,
          pagination: {
            page,
            limit,
            total,
            totalPages,
          },
        }
      } catch (error) {
        console.error('获取对话列表失败:', error)
        return {
          success: false,
          error: '获取对话列表失败',
          data: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
          },
        }
      }
    }),

  /**
   * 获取对话统计信息
   */
  getChatStats: protectedProcedure.query(async ({ ctx }) => {
    try {
      const userId = ctx.user.id

      // 获取总对话数
      const totalResult = await db.select({ count: count() }).from(chats).where(eq(chats.userId, userId))

      const total = totalResult[0]?.count || 0

      // 按科目统计
      const subjectStats = await db
        .select({
          subject: chats.subject,
          count: count(),
        })
        .from(chats)
        .where(and(eq(chats.userId, userId), sql`${chats.subject} IS NOT NULL`))
        .groupBy(chats.subject)
        .orderBy(desc(count()))
        .limit(3)

      return {
        success: true,
        data: {
          total,
          subjectStats: subjectStats.map((s) => ({
            subject: s.subject || '未分类',
            count: s.count,
          })),
        },
      }
    } catch (error) {
      console.error('获取对话统计失败:', error)
      return {
        success: false,
        error: '获取对话统计失败',
        data: {
          total: 0,
          subjectStats: [],
        },
      }
    }
  }),

  /**
   * 获取对话详情
   */
  getChatById: protectedProcedure.input(z.object({ chatId: z.string() })).query(async ({ input, ctx }) => {
    try {
      const userId = ctx.user.id
      const { chatId } = input

      // 验证对话属于当前用户
      const [chat] = await db
        .select()
        .from(chats)
        .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
        .limit(1)

      if (!chat) {
        return {
          success: false,
          error: '对话不存在或无权限访问',
          data: null,
        }
      }

      return {
        success: true,
        data: chat,
      }
    } catch (error) {
      console.error('获取对话详情失败:', error)
      return {
        success: false,
        error: '获取对话详情失败',
        data: null,
      }
    }
  }),

  /**
   * 获取对话的消息列表
   */
  getChatMessages: protectedProcedure.input(z.object({ chatId: z.string() })).query(async ({ input, ctx }) => {
    try {
      const userId = ctx.user.id
      const { chatId } = input

      // 验证对话属于当前用户
      const [chat] = await db
        .select()
        .from(chats)
        .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
        .limit(1)

      if (!chat) {
        return {
          success: false,
          error: '对话不存在或无权限访问',
          data: null,
        }
      }

      // 获取消息列表
      const messagesList = await db
        .select()
        .from(messages)
        .where(eq(messages.chatId, chatId))
        .orderBy(asc(messages.createdAt))

      return {
        success: true,
        data: {
          chat,
          messages: messagesList,
        },
      }
    } catch (error) {
      console.error('获取对话消息失败:', error)
      return {
        success: false,
        error: '获取对话消息失败',
        data: null,
      }
    }
  }),

  /**
   * 删除对话
   */
  deleteChat: protectedProcedure.input(z.object({ chatId: z.string() })).mutation(async ({ input, ctx }) => {
    try {
      const userId = ctx.user.id
      const { chatId } = input

      // 验证对话属于当前用户
      const [chat] = await db
        .select()
        .from(chats)
        .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
        .limit(1)

      if (!chat) {
        return {
          success: false,
          error: '对话不存在或无权限删除',
        }
      }

      // 删除对话（级联删除消息）
      await db.delete(chats).where(eq(chats.id, chatId))

      return {
        success: true,
      }
    } catch (error) {
      console.error('删除对话失败:', error)
      return {
        success: false,
        error: '删除对话失败',
      }
    }
  }),

  /**
   * 删除消息
   */
  deleteMessage: protectedProcedure.input(z.object({ messageId: z.string() })).mutation(async ({ input, ctx }) => {
    try {
      const userId = ctx.user.id
      const { messageId } = input

      // 验证消息属于当前用户
      const [message] = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1)

      if (!message) {
        return {
          success: false,
          error: '消息不存在',
        }
      }

      // 验证消息所属的对话属于当前用户
      const [chat] = await db
        .select()
        .from(chats)
        .where(and(eq(chats.id, message.chatId), eq(chats.userId, userId)))
        .limit(1)

      if (!chat) {
        return {
          success: false,
          error: '无权限删除此消息',
        }
      }

      // 删除消息
      await db.delete(messages).where(eq(messages.id, messageId))

      return {
        success: true,
      }
    } catch (error) {
      console.error('删除消息失败:', error)
      return {
        success: false,
        error: '删除消息失败',
      }
    }
  }),
})
