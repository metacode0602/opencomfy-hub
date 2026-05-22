import { z } from 'zod'
import { PLATFORM_DATETIME_REGEX } from '@/lib/platform-pricing/datetime'

const pricingModeSchema = z.enum([
  'card_time',
  'revenue_share',
  'tiered_card_time',
  'tiered_revenue_share',
])

const pricingTierSchema = z.object({
  tierOrder: z.number().int().positive(),
  thresholdFromHours: z.number().min(0),
  thresholdToHours: z.number().min(0).nullable().optional(),
  unitPricePerHour: z.number().positive().optional(),
  revenueSharePercent: z.number().min(0).max(100).optional(),
})

export const unitCostListSchema = z
  .object({
    supplierId: z.string().optional(),
  })
  .optional()

export const unitCostUpsertSchema = z.object({
  supplierId: z.string().min(1),
  dataCenterId: z.string().min(1),
  gpuCardTypeId: z.string().min(1),
  pricingMode: pricingModeSchema,
  unitPricePerHour: z.number().positive().optional(),
  revenueSharePercent: z.number().min(0).max(100).optional(),
  pricingTiers: z.array(pricingTierSchema).optional(),
  effectiveFrom: z
    .string()
    .regex(PLATFORM_DATETIME_REGEX, '生效时间格式须为 yyyy-MM-dd HH:mm:ss'),
  effectiveTo: z
    .string()
    .regex(PLATFORM_DATETIME_REGEX, '结束时间格式须为 yyyy-MM-dd HH:mm:ss')
    .nullable()
    .optional(),
})

export const unitCostUpdateSchema = unitCostUpsertSchema
  .omit({
    supplierId: true,
    dataCenterId: true,
    gpuCardTypeId: true,
  })
  .extend({
    recordId: z.string().min(1),
    reason: z.string().trim().max(2000).optional(),
  })
