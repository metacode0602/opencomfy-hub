import { z } from 'zod'

export const platformProductLineSchema = z.enum([
  'elastic_service',
  'cloud_vm',
  'bare_metal',
  'job',
  'spot',
])

export const platformBillingUnitSchema = z.enum(['hour', 'day', 'week', 'month'])

export const platformPriceStatusSchema = z.enum(['draft', 'active', 'archived'])

import { PLATFORM_DATETIME_REGEX } from '@/lib/platform-pricing/datetime'

export const platformPriceUpsertSchema = z.object({
  gpuCardTypeId: z.string().min(1),
  productLine: platformProductLineSchema,
  billingUnit: platformBillingUnitSchema.default('hour'),
  sellPrice: z.number().positive('销售单价须大于 0'),
  effectiveFrom: z
    .string()
    .regex(PLATFORM_DATETIME_REGEX, '生效时间格式须为 yyyy-MM-dd HH:mm:ss'),
  status: platformPriceStatusSchema.default('active'),
  remark: z.string().trim().max(2000).optional(),
})

export const platformPriceUpdateSchema = platformPriceUpsertSchema.extend({
  recordId: z.string().min(1),
})
