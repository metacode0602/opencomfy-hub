import { createTRPCRouter, protectedProcedure } from '../trpc'
import { z } from 'zod'
import { db } from '@/db/drizzle'
import { knowledgePoints, wrongQuestions } from '@/db/schema'

export const homeworkSummarizeRouter = createTRPCRouter({
  // 提取知识点
  extractKnowledge: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().optional(),
        content: z.string().min(1), // 要提取知识点的内容
        title: z.string().optional(),
        subject: z.string().optional(),
        grade: z.string().optional(),
        tags: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id
      const { content, title, subject, grade, tags, sessionId } = input

      // 这里可以调用AI来提取知识点，暂时直接保存
      const [point] = await db
        .insert(knowledgePoints)
        .values({
          userId,
          sessionId,
          title: title || '提取的知识点',
          content,
          subject,
          grade,
          tags,
          source: sessionId ? `会话: ${sessionId}` : '手动提取',
        })
        .returning()

      return { success: true, data: point }
    }),

  // 保存到错题本
  saveToWrongQuestions: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().optional(),
        imageId: z.string().optional(),
        questionText: z.string().min(1),
        answerText: z.string().optional(),
        solutionText: z.string().optional(),
        subject: z.string().optional(),
        grade: z.string().optional(),
        difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
        tags: z.array(z.string()).default([]),
        mistakeReason: z.string().optional(),
        notes: z.string().optional(),
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
})
