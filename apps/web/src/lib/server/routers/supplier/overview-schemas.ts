import { z } from 'zod'

export const overviewFiltersSchema = z.object({
  region: z.string().default('all'),
  supplierId: z.string().default('all'),
  cardType: z.string().default('all'),
  poolCode: z.string().default('all'),
})

export const gpuResourceTrendSchema = z.object({
  range: z.enum(['24h', '7d', '30d']).default('24h'),
})
