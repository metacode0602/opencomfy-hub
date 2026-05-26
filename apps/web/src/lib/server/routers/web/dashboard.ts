import { z } from 'zod'
import { globalSearchDataAccess } from '@/lib/server/dataaccess/global-search'
import { createTRPCRouter, protectedProcedure } from '../trpc'

const globalSearchSchema = z.object({
  query: z.string().min(1).max(100),
})

export const dashboardRouter = createTRPCRouter({
  globalSearch: protectedProcedure.input(globalSearchSchema).query(async ({ input }) => {
    return globalSearchDataAccess.search(input.query)
  }),
})
