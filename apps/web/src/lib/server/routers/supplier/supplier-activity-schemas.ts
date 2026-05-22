import { z } from 'zod'

export const supplierActivityListSchema = z.object({
  supplierId: z.string().min(1),
  limit: z.number().int().positive().max(200).optional(),
})
