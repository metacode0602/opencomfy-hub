import { z } from 'zod'

export const overviewFiltersSchema = z.object({
  region: z.string().default('all'),
  supplierId: z.string().default('all'),
  cardType: z.string().default('all'),
  poolCode: z.string().default('all'),
})
