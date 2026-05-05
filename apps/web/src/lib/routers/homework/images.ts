import { createTRPCRouter, protectedProcedure } from '../trpc'
import { z } from 'zod'
import { db } from '@/db/drizzle'
import { chatAttachments as homeworkImages, chats as homeworkSessions } from '@/db/schema/chat-schema'
import { eq, and, } from 'drizzle-orm'
import { uploadFile, deleteFile } from '@/storage'
import userSubscriptionsDataAccess from '@/web/user-subscriptions'
import { getPlanConfig } from '@/lib/config/subscription-plans'

export const homeworkImagesRouter = createTRPCRouter({
  // 上传图片
  upload: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        file: z.object({
          name: z.string(),
          type: z.string(),
          data: z.string(), // base64 encoded
        }),
        order: z.number().default(0),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id
      const { sessionId, file, order } = input

      // 验证会话属于当前用户
      const [session] = await db
        .select()
        .from(homeworkSessions)
        .where(and(eq(homeworkSessions.id, sessionId), eq(homeworkSessions.userId, userId)))
        .limit(1)

      if (!session) {
        throw new Error('Session not found')
      }

      // 获取用户订阅信息，确定每次上传的最大图片数量
      const subscription = await userSubscriptionsDataAccess.getActiveSubscriptionByUserId(userId)
      const planId = subscription?.planId || 'free'
      const planConfig = getPlanConfig(planId)
      const maxImagesPerUpload = planConfig?.maxImagesPerUpload || 1

      // 检查图片数量（根据套餐限制）
      const existingImages = await db.select().from(homeworkImages).where(eq(homeworkImages.chatId, sessionId))

      if (existingImages.length >= maxImagesPerUpload) {
        throw new Error(`根据您的套餐（${planConfig?.planName || '免费体验版'}），每次最多只能上传 ${maxImagesPerUpload} 张图片`)
      }

      // 将base64转换为Buffer
      const base64Data = file.data.includes(',')
        ? file.data.split(',')[1]
        : file.data.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')

      // 上传到OSS
      const { url, key } = await uploadFile(buffer, file.name, file.type, `homework/${userId}/${sessionId}`)

      // 保存到数据库
      const [image] = await db
        .insert(homeworkImages)
        .values({
          chatId: sessionId,
          userId,
          key: key,
          filename: file.name,
          contentType: file.type,
          size: buffer.length,
          url: url,
          ossKey: key,
          ossUrl: url,
          order,
          metadata: {
            size: buffer.length,
            mimeType: file.type,
          },
        })
        .returning()

      return { success: true, data: image }
    }),

  // 更新OCR文本
  updateText: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        ocrText: z.string().optional(),
        ocrTextEdited: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id
      const { id, ...updates } = input

      // 验证图片属于当前用户
      const [existing] = await db
        .select()
        .from(homeworkImages)
        .where(and(eq(homeworkImages.id, id), eq(homeworkImages.userId, userId)))
        .limit(1)

      if (!existing) {
        throw new Error('Image not found')
      }

      const [updated] = await db
        .update(homeworkImages)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(homeworkImages.id, id))
        .returning()

      return { success: true, data: updated }
    }),

  // 删除图片
  delete: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input, ctx }) => {
    const userId = ctx.user.id
    const { id } = input

    // 验证图片属于当前用户
    const [existing] = await db
      .select()
      .from(homeworkImages)
      .where(and(eq(homeworkImages.id, id), eq(homeworkImages.userId, userId)))
      .limit(1)

    if (!existing) {
      throw new Error('Image not found')
    }

    // 从OSS删除
    try {
      await deleteFile(existing.ossKey)
    } catch (error) {
      console.error('Failed to delete file from OSS:', error)
      // 继续删除数据库记录
    }

    // 从数据库删除
    await db.delete(homeworkImages).where(eq(homeworkImages.id, id))

    return { success: true }
  }),

  // 更新图片顺序
  updateOrder: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        imageOrders: z.array(
          z.object({
            id: z.string(),
            order: z.number(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id
      const { sessionId, imageOrders } = input

      // 验证会话属于当前用户
      const [session] = await db
        .select()
        .from(homeworkSessions)
        .where(and(eq(homeworkSessions.id, sessionId), eq(homeworkSessions.userId, userId)))
        .limit(1)

      if (!session) {
        throw new Error('Session not found')
      }

      // 批量更新顺序
      const updates = imageOrders.map(({ id, order }) =>
        db
          .update(homeworkImages)
          .set({ order, updatedAt: new Date() })
          .where(and(eq(homeworkImages.id, id), eq(homeworkImages.chatId, sessionId)))
      )

      await Promise.all(updates)

      return { success: true }
    }),

  // 获取对话的附件列表
  getChatAttachments: protectedProcedure
    .input(z.object({ chatId: z.string() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.user.id
      const { chatId } = input

      // 验证对话属于当前用户
      const [chat] = await db
        .select()
        .from(homeworkSessions)
        .where(and(eq(homeworkSessions.id, chatId), eq(homeworkSessions.userId, userId)))
        .limit(1)

      if (!chat) {
        throw new Error('Chat not found')
      }

      // 获取附件列表
      const attachments = await db
        .select()
        .from(homeworkImages)
        .where(eq(homeworkImages.chatId, chatId))
        .orderBy(homeworkImages.order)

      return {
        success: true,
        attachments,
      }
    }),
})
