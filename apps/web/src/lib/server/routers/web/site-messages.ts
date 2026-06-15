import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import {
  SITE_MESSAGE_DEFAULT_PAGE_SIZE,
  siteMessagesDataAccess,
} from '@/lib/server/dataaccess/site-messages'
import { createTRPCRouter, sharedReadProcedure } from '../trpc'

const listInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(SITE_MESSAGE_DEFAULT_PAGE_SIZE),
  readFilter: z.enum(['all', 'unread', 'read']).default('all'),
})

export const siteMessagesRouter = createTRPCRouter({
  list: sharedReadProcedure.input(listInputSchema).query(async ({ ctx, input }) => {
    return siteMessagesDataAccess.list({
      userId: ctx.user.id,
      page: input.page,
      pageSize: input.pageSize,
      readFilter: input.readFilter,
    })
  }),

  unreadCount: sharedReadProcedure.query(async ({ ctx }) => {
    const count = await siteMessagesDataAccess.getUnreadCount(ctx.user.id)
    return { count }
  }),

  getById: sharedReadProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const message = await siteMessagesDataAccess.getById(ctx.user.id, input.id)
      if (!message) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '消息不存在或无权访问' })
      }
      return message
    }),

  markRead: sharedReadProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const updated = await siteMessagesDataAccess.markRead(ctx.user.id, input.id)
      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '消息不存在或无权访问' })
      }
      return { success: true as const }
    }),

  markAllRead: sharedReadProcedure.mutation(async ({ ctx }) => {
    const updatedCount = await siteMessagesDataAccess.markAllRead(ctx.user.id)
    return { updatedCount }
  }),
})
