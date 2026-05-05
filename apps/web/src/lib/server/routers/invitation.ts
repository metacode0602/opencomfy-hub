import { createTRPCRouter, protectedProcedure, publicProcedure } from '@/lib/server/routers/trpc'
import { z } from 'zod'
import {
  generateUserInvitationCode,
  verifyInvitationCode,
  getUserInvitationStats,
  getUserInvitationCode,
} from '@/lib/server/actions/invitations'

export const invitationRouter = createTRPCRouter({
  /**
   * 生成邀请码
   */
  generateCode: protectedProcedure
    .input(
      z.object({
        maxUsage: z.number().min(1).optional(),
        expiresAt: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const code = await generateUserInvitationCode(ctx.user.id, {
          maxUsage: input.maxUsage,
          expiresAt: input.expiresAt,
        })

        return {
          success: true,
          data: {
            code: code?.code,
            id: code?.id,
          },
        }
      } catch (error) {
        console.error('生成邀请码失败:', error)
        return {
          success: false,
          error: '生成邀请码失败',
        }
      }
    }),

  /**
   * 获取当前用户的邀请码信息
   */
  getMyCode: protectedProcedure.query(async ({ ctx }) => {
    try {
      const codeInfo = await getUserInvitationCode(ctx.user.id)

      return {
        success: true,
        data: codeInfo,
      }
    } catch (error) {
      console.error('获取邀请码信息失败:', error)
      return {
        success: false,
        error: '获取邀请码信息失败',
        data: null,
      }
    }
  }),

  /**
   * 验证邀请码（公开接口）
   */
  verifyCode: publicProcedure
    .input(z.object({ code: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        const result = await verifyInvitationCode(input.code)

        return {
          success: true,
          data: result,
        }
      } catch (error) {
        console.error('验证邀请码失败:', error)
        return {
          success: false,
          error: '验证邀请码失败',
          data: { valid: false },
        }
      }
    }),

  /**
   * 获取邀请统计
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    try {
      const stats = await getUserInvitationStats(ctx.user.id)

      return {
        success: true,
        data: stats,
      }
    } catch (error) {
      console.error('获取邀请统计失败:', error)
      return {
        success: false,
        error: '获取邀请统计失败',
        data: {
          code: null,
          usageCount: 0,
          totalInvited: 0,
          invitees: [],
        },
      }
    }
  }),
})
