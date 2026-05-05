import { createTRPCRouter, protectedProcedure } from '../trpc'
import { z } from 'zod'
import { db } from '@/db/drizzle'
import { knowledgePoints } from '@/db/schema'
import { eq, and, desc, or, ilike } from 'drizzle-orm'

export const knowledgePointsRouter = createTRPCRouter({
  // 获取知识点列表
  list: protectedProcedure
    .input(
      z.object({
        subject: z.string().optional(),
        grade: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id
      const { subject, grade, search, limit, offset } = input

      const whereConditions = [eq(knowledgePoints.userId, userId)]
      if (subject) {
        whereConditions.push(eq(knowledgePoints.subject, subject))
      }
      if (grade) {
        whereConditions.push(eq(knowledgePoints.grade, grade))
      }
      if (search && search.trim() !== '') {
        whereConditions.push(
          or(ilike(knowledgePoints.title, `%${search.trim()}%`), ilike(knowledgePoints.content, `%${search.trim()}%`))
        )
      }

      const points = await db
        .select()
        .from(knowledgePoints)
        .where(and(...whereConditions))
        .orderBy(desc(knowledgePoints.createdAt))
        .limit(limit)
        .offset(offset)

      const total = await db
        .select()
        .from(knowledgePoints)
        .where(and(...whereConditions))

      return {
        success: true,
        data: {
          points,
          total: total.length,
        },
      }
    }),

  // 获取知识点详情
  getById: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input, ctx }) => {
    const userId = ctx.user.id
    const { id } = input

    const [point] = await db
      .select()
      .from(knowledgePoints)
      .where(and(eq(knowledgePoints.id, id), eq(knowledgePoints.userId, userId)))
      .limit(1)

    if (!point) {
      throw new Error('Knowledge point not found')
    }

    return { success: true, data: point }
  }),

  // 创建知识点
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        content: z.string().min(1),
        subject: z.string().optional(),
        grade: z.string().optional(),
        tags: z.array(z.string()).default([]),
        source: z.string().optional(),
        sessionId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id
      const [point] = await db
        .insert(knowledgePoints)
        .values({
          userId,
          ...input,
        })
        .returning()

      return { success: true, data: point }
    }),

  // 更新知识点
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        content: z.string().optional(),
        subject: z.string().optional(),
        grade: z.string().optional(),
        tags: z.array(z.string()).optional(),
        source: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id
      const { id, ...updates } = input

      // 验证知识点属于当前用户
      const [existing] = await db
        .select()
        .from(knowledgePoints)
        .where(and(eq(knowledgePoints.id, id), eq(knowledgePoints.userId, userId)))
        .limit(1)

      if (!existing) {
        throw new Error('Knowledge point not found')
      }

      const [updated] = await db
        .update(knowledgePoints)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(knowledgePoints.id, id))
        .returning()

      return { success: true, data: updated }
    }),

  // 删除知识点
  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input, ctx }) => {
    const userId = ctx.user.id
    const { id } = input

    // 验证知识点属于当前用户
    const [existing] = await db
      .select()
      .from(knowledgePoints)
      .where(and(eq(knowledgePoints.id, id), eq(knowledgePoints.userId, userId)))
      .limit(1)

    if (!existing) {
      throw new Error('Knowledge point not found')
    }

    await db.delete(knowledgePoints).where(eq(knowledgePoints.id, id))

    return { success: true }
  }),

  // 搜索知识点
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        subject: z.string().optional(),
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id
      const { query, subject, limit } = input

      const whereConditions = [
        eq(knowledgePoints.userId, userId),
        or(ilike(knowledgePoints.title, `%${query}%`), ilike(knowledgePoints.content, `%${query}%`)),
      ]

      if (subject) {
        whereConditions.push(eq(knowledgePoints.subject, subject))
      }

      const points = await db
        .select()
        .from(knowledgePoints)
        .where(and(...whereConditions))
        .orderBy(desc(knowledgePoints.createdAt))
        .limit(limit)

      return { success: true, data: points }
    }),
})
