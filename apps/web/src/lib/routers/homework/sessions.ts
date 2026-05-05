import { createTRPCRouter, protectedProcedure } from '../trpc'
import { z } from 'zod'
import { db } from '@/db/drizzle'
import { chats as homeworkSessions, chatAttachments as homeworkImages, messages as homeworkMessages } from '@/db/schema'
import { eq, desc, and } from 'drizzle-orm'

export const homeworkSessionsRouter = createTRPCRouter({
  // 创建会话
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().optional(),
        subject: z.string().optional(),
        grade: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id
      const [session] = await db
        .insert(homeworkSessions)
        .values({
          userId,
          title: input.title || '新会话',
          subject: input.subject,
          grade: input.grade,
        })
        .returning()

      return { success: true, data: session }
    }),

  // 获取会话列表
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(['active', 'completed', 'archived']).optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id
      const { status, limit, offset } = input

      const whereConditions = [eq(homeworkSessions.userId, userId)]
      if (status) {
        whereConditions.push(eq(homeworkSessions.status, status))
      }

      const sessions = await db
        .select()
        .from(homeworkSessions)
        .where(and(...whereConditions))
        .orderBy(desc(homeworkSessions.createdAt))
        .limit(limit)
        .offset(offset)

      const total = await db
        .select({ count: homeworkSessions.id })
        .from(homeworkSessions)
        .where(and(...whereConditions))

      return {
        success: true,
        data: {
          sessions,
          total: total.length,
        },
      }
    }),

  // 获取会话详情
  getById: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input, ctx }) => {
    const userId = ctx.user.id
    const { id } = input

    const [session] = await db
      .select()
      .from(homeworkSessions)
      .where(and(eq(homeworkSessions.id, id), eq(homeworkSessions.userId, userId)))
      .limit(1)

    if (!session) {
      throw new Error('Session not found')
    }

    // 获取关联的图片
    const images = await db
      .select()
      .from(homeworkImages)
      .where(eq(homeworkImages.chatId, id))
      .orderBy(homeworkImages.order)

    // 获取关联的消息
    const messages = await db
      .select()
      .from(homeworkMessages)
      .where(eq(homeworkMessages.sessionId, id))
      .orderBy(homeworkMessages.createdAt)

    return {
      success: true,
      data: {
        ...session,
        images,
        messages,
      },
    }
  }),

  // 更新会话
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        subject: z.string().optional(),
        grade: z.string().optional(),
        status: z.enum(['active', 'completed', 'archived']).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id
      const { id, ...updates } = input

      // 验证会话属于当前用户
      const [existing] = await db
        .select()
        .from(homeworkSessions)
        .where(and(eq(homeworkSessions.id, id), eq(homeworkSessions.userId, userId)))
        .limit(1)

      if (!existing) {
        throw new Error('Session not found')
      }

      const [updated] = await db
        .update(homeworkSessions)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(homeworkSessions.id, id))
        .returning()

      return { success: true, data: updated }
    }),

  // 删除会话
  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input, ctx }) => {
    const userId = ctx.user.id
    const { id } = input

    // 验证会话属于当前用户
    const [existing] = await db
      .select()
      .from(homeworkSessions)
      .where(and(eq(homeworkSessions.id, id), eq(homeworkSessions.userId, userId)))
      .limit(1)

    if (!existing) {
      throw new Error('Session not found')
    }

    await db.delete(homeworkSessions).where(eq(homeworkSessions.id, id))

    return { success: true }
  }),
})
