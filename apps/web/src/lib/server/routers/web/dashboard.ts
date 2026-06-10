import { z } from 'zod'
import { globalOpsDataAccess } from '@/lib/server/dataaccess/dashboard/global-ops'
import { globalSearchDataAccess } from '@/lib/server/dataaccess/global-search'
import {
  globalAlertsQuerySchema,
  globalDashboardFiltersSchema,
  globalPeriodInputSchema,
} from '@/lib/server/routers/dashboard/global-ops-schemas'
import { createTRPCRouter, sharedReadProcedure } from '../trpc'

const globalSearchSchema = z.object({
  query: z.string().min(1).max(100),
})

export const globalOpsRouter = createTRPCRouter({
  getFilterOptions: sharedReadProcedure.query(async () => {
    return globalOpsDataAccess.getFilterOptions()
  }),

  getSnapshot: sharedReadProcedure
    .input(globalDashboardFiltersSchema.optional())
    .query(async ({ input }) => {
      return globalOpsDataAccess.getSnapshot(input ?? {})
    }),

  getPeriod: sharedReadProcedure.input(globalPeriodInputSchema).query(async ({ input }) => {
    return globalOpsDataAccess.getPeriod(input)
  }),

  getAlerts: sharedReadProcedure.input(globalAlertsQuerySchema).query(async ({ input }) => {
    const snapshot = await globalOpsDataAccess.getSnapshot({})
    let alerts = snapshot.alerts
    if (input.level !== 'all') {
      alerts = alerts.filter((a) => a.level === input.level)
    }
    if (input.type !== 'all') {
      alerts = alerts.filter((a) => a.type === input.type)
    }
    return alerts
  }),
})

export const dashboardRouter = createTRPCRouter({
  globalSearch: sharedReadProcedure.input(globalSearchSchema).query(async ({ input }) => {
    return globalSearchDataAccess.search(input.query)
  }),
  globalOps: globalOpsRouter,
})
