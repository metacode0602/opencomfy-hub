import { z } from 'zod'
import { PLATFORM_DATETIME_REGEX } from '@/lib/platform-pricing/datetime'
import { validateRevenueShareRatioContractTiers } from '@/lib/supplier/revenue-share-ratio-tiers'

const pricingModeSchema = z.enum([
  'card_time',
  'revenue_share',
  'tiered_card_time',
  'tiered_revenue_share',
])

const billingUnitSchema = z.enum(['hour', 'month'])

const pricingTierSchema = z.object({
  tierOrder: z.number().int().positive(),
  tierBasis: z.enum(['hours', 'ratio_band']).optional(),
  thresholdFromHours: z.number().min(0).optional(),
  thresholdToHours: z.number().min(0).nullable().optional(),
  dealToListRatioMin: z.number().min(0).optional(),
  dealToListRatioMax: z.number().min(0).nullable().optional(),
  unitPricePerHour: z.number().positive().optional(),
  revenueSharePercent: z.number().min(0).optional(),
})

type PricingPayload = {
  pricingMode: z.infer<typeof pricingModeSchema>
  billingUnit?: z.infer<typeof billingUnitSchema>
  unitPrice?: number
  unitPricePerHour?: number
  cardsPerMachine?: number
  revenueSharePercent?: number
  pricingTiers?: z.infer<typeof pricingTierSchema>[]
}

function refinePricingPayload(data: PricingPayload, ctx: z.RefinementCtx) {
  const {
    pricingMode,
    billingUnit = 'hour',
    unitPrice,
    unitPricePerHour,
    cardsPerMachine,
    revenueSharePercent,
    pricingTiers,
  } = data

  if (pricingMode === 'tiered_revenue_share') {
    const tiers = pricingTiers ?? []
    if (tiers.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '阶梯分成须至少配置一档',
        path: ['pricingTiers'],
      })
      return
    }
    const ratioError = validateRevenueShareRatioContractTiers(tiers)
    if (ratioError) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: ratioError,
        path: ['pricingTiers'],
      })
    }
    return
  }

  if (pricingMode === 'tiered_card_time') {
    const tiers = pricingTiers ?? []
    if (tiers.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '阶梯卡时须至少配置一档',
        path: ['pricingTiers'],
      })
    }
    return
  }

  if (pricingMode === 'revenue_share') {
    if (revenueSharePercent == null || revenueSharePercent <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '请填写有效的分成比例',
        path: ['revenueSharePercent'],
      })
    }
    return
  }

  if (billingUnit === 'month') {
    if (unitPrice == null || unitPrice <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '请填写有效的月租金额',
        path: ['unitPrice'],
      })
    }
    if (cardsPerMachine != null && (cardsPerMachine <= 0 || !Number.isInteger(cardsPerMachine))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '每台卡数须为正整数',
        path: ['cardsPerMachine'],
      })
    }
    return
  }

  const hourly = unitPrice ?? unitPricePerHour
  if (hourly == null || hourly <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '请填写有效的卡时单价',
      path: ['unitPricePerHour'],
    })
  }
}

export const unitCostListSchema = z
  .object({
    supplierId: z.string().optional(),
  })
  .optional()

const unitCostUpsertBaseSchema = z.object({
  supplierId: z.string().min(1),
  dataCenterId: z.string().min(1),
  gpuCardTypeId: z.string().min(1),
  pricingMode: pricingModeSchema,
  billingUnit: billingUnitSchema.optional(),
  unitPrice: z.number().positive().optional(),
  unitPricePerHour: z.number().positive().optional(),
  cardsPerMachine: z.number().int().positive().optional(),
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

export const unitCostUpsertSchema = unitCostUpsertBaseSchema.superRefine(refinePricingPayload)

export const unitCostUpdateSchema = z
  .object({
    recordId: z.string().min(1),
    pricingMode: pricingModeSchema,
    billingUnit: billingUnitSchema.optional(),
    unitPrice: z.number().positive().optional(),
    unitPricePerHour: z.number().positive().optional(),
    cardsPerMachine: z.number().int().positive().optional(),
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
    reason: z.string().trim().max(2000).optional(),
  })
  .superRefine(refinePricingPayload)
