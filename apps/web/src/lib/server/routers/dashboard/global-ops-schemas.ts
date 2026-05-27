import { z } from 'zod'

export const globalDashboardFiltersSchema = z.object({
  region: z.string().default('all'),
  cardType: z.string().default('all'),
  dataCenterId: z.string().optional(),
  supplierId: z.string().optional(),
})

export const globalAlertsQuerySchema = z.object({
  level: z.enum(['all', '严重', '警告', '提示']).default('all'),
  type: z.enum(['all', 'fault', 'network', 'shelving', 'pool']).default('all'),
})

export const globalPeriodInputSchema = z.object({
  granularity: z.enum(['day', 'hour']),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  comparePrevious: z.boolean().optional(),
  region: z.string().default('all'),
  cardType: z.string().default('all'),
  dataCenterId: z.string().optional(),
  supplierId: z.string().optional(),
})
