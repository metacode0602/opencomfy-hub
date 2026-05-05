import { createTRPCRouter, protectedProcedure } from '../trpc'
import { z } from 'zod'
import { db } from '@/db/drizzle'
import { wrongQuestions, chatAttachments } from '@/db/schema'
import { eq, and, desc, or, ilike, isNull } from 'drizzle-orm'

export const wrongQuestionsRouter = createTRPCRouter({
  // 获取错题列表
  list: protectedProcedure
    .input(
      z.object({
        subject: z.string().optional(),
        grade: z.string().optional(),
        isReviewed: z.boolean().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id
      const { subject, grade, isReviewed, search, limit, offset } = input

      const whereConditions = [
        eq(wrongQuestions.userId, userId),
        isNull(wrongQuestions.deletedAt), // 只查询未删除的记录
      ]
      if (subject) {
        whereConditions.push(eq(wrongQuestions.subject, subject))
      }
      if (grade) {
        whereConditions.push(eq(wrongQuestions.grade, grade))
      }
      if (isReviewed !== undefined) {
        whereConditions.push(eq(wrongQuestions.isReviewed, isReviewed))
      }
      if (search) {
        whereConditions.push(
          or(
            ilike(wrongQuestions.questionText, `%${search}%`),
            wrongQuestions.answerText ? ilike(wrongQuestions.answerText, `%${search}%`) : undefined
          )!
        )
      }

      const questions = await db
        .select({
          wrongQuestion: wrongQuestions,
          attachment: chatAttachments,
        })
        .from(wrongQuestions)
        .leftJoin(chatAttachments, eq(wrongQuestions.imageId, chatAttachments.id))
        .where(and(...whereConditions))
        .orderBy(desc(wrongQuestions.createdAt))
        .limit(limit)
        .offset(offset)

      // 按错题 ID 分组，处理一个错题可能有多个图片的情况（虽然 schema 只支持单个 imageId，但为了兼容性）
      const questionsMap = new Map()
      for (const row of questions) {
        const questionId = row.wrongQuestion.id
        if (!questionsMap.has(questionId)) {
          questionsMap.set(questionId, {
            ...row.wrongQuestion,
            images: [] as Array<{ id: string; url: string; ossUrl: string }>,
          })
        }
        if (row.attachment) {
          questionsMap.get(questionId).images.push({
            id: row.attachment.id,
            url: row.attachment.url,
            ossUrl: row.attachment.ossUrl,
          })
        }
      }

      const questionsWithImages = Array.from(questionsMap.values())

      const total = await db
        .select()
        .from(wrongQuestions)
        .where(and(...whereConditions))

      return {
        success: true,
        data: {
          questions: questionsWithImages,
          total: total.length,
        },
      }
    }),

  // 获取错题详情
  getById: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input, ctx }) => {
    const userId = ctx.user.id
    const { id } = input

    const [row] = await db
      .select({
        wrongQuestion: wrongQuestions,
        attachment: chatAttachments,
      })
      .from(wrongQuestions)
      .leftJoin(chatAttachments, eq(wrongQuestions.imageId, chatAttachments.id))
      .where(
        and(eq(wrongQuestions.id, id), eq(wrongQuestions.userId, userId), isNull(wrongQuestions.deletedAt))
      )
      .limit(1)

    if (!row) {
      throw new Error('Wrong question not found')
    }

    const question = {
      ...row.wrongQuestion,
      images: row.attachment
        ? [
          {
            id: row.attachment.id,
            url: row.attachment.url,
            ossUrl: row.attachment.ossUrl,
          },
        ]
        : [],
    }

    return { success: true, data: question }
  }),

  // 创建错题
  create: protectedProcedure
    .input(
      z.object({
        questionText: z.string().min(1),
        answerText: z.string().optional(),
        solutionText: z.string().optional(),
        subject: z.string().optional(),
        grade: z.string().optional(),
        difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
        tags: z.array(z.string()).default([]),
        mistakeReason: z.string().optional(),
        notes: z.string().optional(),
        chatId: z.string().optional(),
        sessionId: z.string().optional(),
        imageId: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id
      const [question] = await db
        .insert(wrongQuestions)
        .values({
          userId,
          ...input,
        })
        .returning()

      return { success: true, data: question }
    }),

  // 更新错题
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        questionText: z.string().optional(),
        answerText: z.string().optional(),
        solutionText: z.string().optional(),
        subject: z.string().optional(),
        grade: z.string().optional(),
        difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
        tags: z.array(z.string()).optional(),
        mistakeReason: z.string().optional(),
        notes: z.string().optional(),
        isReviewed: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id
      const { id, ...updates } = input

      // 验证错题属于当前用户且未删除
      const [existing] = await db
        .select()
        .from(wrongQuestions)
        .where(
          and(eq(wrongQuestions.id, id), eq(wrongQuestions.userId, userId), isNull(wrongQuestions.deletedAt))
        )
        .limit(1)

      if (!existing) {
        throw new Error('Wrong question not found')
      }

      const updateData: any = {
        ...updates,
        updatedAt: new Date(),
      }

      // 如果标记为已复习，更新复习时间和次数
      if (updates.isReviewed === true && !existing.isReviewed) {
        updateData.reviewedAt = new Date()
        updateData.reviewCount = (existing.reviewCount || 0) + 1
      }

      const [updated] = await db.update(wrongQuestions).set(updateData).where(eq(wrongQuestions.id, id)).returning()

      return { success: true, data: updated }
    }),

  // 删除错题（逻辑删除）
  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input, ctx }) => {
    const userId = ctx.user.id
    const { id } = input

    // 验证错题属于当前用户且未删除
    const [existing] = await db
      .select()
      .from(wrongQuestions)
      .where(
        and(eq(wrongQuestions.id, id), eq(wrongQuestions.userId, userId), isNull(wrongQuestions.deletedAt))
      )
      .limit(1)

    if (!existing) {
      throw new Error('Wrong question not found')
    }

    // 逻辑删除：更新 deletedAt 字段
    await db
      .update(wrongQuestions)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(wrongQuestions.id, id))

    return { success: true }
  }),

  // 搜索错题
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
        eq(wrongQuestions.userId, userId),
        isNull(wrongQuestions.deletedAt), // 只查询未删除的记录
        or(ilike(wrongQuestions.questionText, `%${query}%`), ilike(wrongQuestions.answerText, `%${query}%`)),
      ]

      if (subject) {
        whereConditions.push(eq(wrongQuestions.subject, subject))
      }

      const questions = await db
        .select()
        .from(wrongQuestions)
        .where(and(...whereConditions))
        .orderBy(desc(wrongQuestions.createdAt))
        .limit(limit)

      return { success: true, data: questions }
    }),

  // 获取错题统计信息
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id

    // 获取所有未删除的错题（用于统计）
    const allQuestions = await db
      .select()
      .from(wrongQuestions)
      .where(and(eq(wrongQuestions.userId, userId), isNull(wrongQuestions.deletedAt)))

    const total = allQuestions.length
    const reviewed = allQuestions.filter((q) => q.isReviewed).length

    // 按学科统计
    const subjectMap = new Map<string, { count: number; reviewCount: number }>()
    allQuestions.forEach((q) => {
      if (q.subject) {
        const existing = subjectMap.get(q.subject) || { count: 0, reviewCount: 0 }
        subjectMap.set(q.subject, {
          count: existing.count + 1,
          reviewCount: existing.reviewCount + (q.reviewCount || 0),
        })
      }
    })

    const subjectStats = Array.from(subjectMap.entries())
      .map(([subject, stats]) => ({ subject, count: stats.count, reviewCount: stats.reviewCount }))
      .sort((a, b) => b.count - a.count)

    return {
      success: true,
      data: {
        total,
        reviewed,
        subjectStats,
      },
    }
  }),
})
