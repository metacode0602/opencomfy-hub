import { z } from 'zod'

export const merchantListSchema = z.object({
  search: z.string().max(200).optional(),
  accountManagerStaffId: z.string().min(1).optional(),
})

export const merchantIdSchema = z.object({
  id: z.string().min(1),
})

export const merchantUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(255),
  companyFullName: z.string().min(1).max(512),
  unifiedSocialCreditCode: z.string().regex(/^[0-9A-Z]{18}$/),
  merchantMark: z.string().max(128).optional(),
  accessMode: z.enum(['oem', 'api', 'iframe']),
  type: z.enum(['platform_direct', 'partner']),
  status: z.enum(['active', 'inactive', 'suspended']),
  remark: z.string().max(5000).optional(),
})

export const merchantActivityListSchema = z.object({
  merchantId: z.string().min(1),
  limit: z.number().int().positive().max(200).optional(),
})

export const merchantActivityCreateSchema = z.object({
  merchantId: z.string().min(1),
  comment: z.string().max(5000).default(''),
  files: z
    .array(
      z.object({
        fileName: z.string().min(1).max(255),
        mimeType: z.string().max(128).default('application/octet-stream'),
        fileBase64: z.string().min(1),
      }),
    )
    .max(5)
    .default([]),
})

const rechargeFileSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().max(128),
  fileBase64: z.string().min(1),
})

export const merchantRechargeListSchema = z.object({
  merchantId: z.string().min(1),
})

export const merchantRechargeCreateSchema = z.object({
  merchantId: z.string().min(1),
  amount: z.number().positive(),
  paymentMethod: z.string().min(1).max(32),
  status: z.enum(['pending', 'completed', 'cancelled']),
  transactionId: z.string().max(128).optional(),
  rechargeDate: z.string().min(1),
  remark: z.string().max(5000).optional(),
  files: z.array(rechargeFileSchema).min(1).max(5),
})

export const merchantRechargeUpdateSchema = z.object({
  rechargeId: z.string().min(1),
  amount: z.number().positive(),
  paymentMethod: z.string().min(1).max(32),
  status: z.enum(['pending', 'completed', 'cancelled']),
  transactionId: z.string().max(128).optional(),
  rechargeDate: z.string().min(1),
  remark: z.string().max(5000).optional(),
  keepAttachmentIds: z.array(z.string()).default([]),
  files: z.array(rechargeFileSchema).max(5).default([]),
})

export const merchantRechargeAuditSchema = z.object({
  merchantId: z.string().min(1).optional(),
  rechargeId: z.string().min(1).optional(),
  limit: z.number().int().positive().max(200).optional(),
})

export const merchantSyncPreviewSchema = z.object({}).optional()

export const merchantSyncCommitSchema = z.object({
  previewId: z.string().min(1),
})

export const merchantRegionListSchema = z.object({
  merchantId: z.string().min(1),
})

export const merchantRegionCreateSchema = z.object({
  merchantId: z.string().min(1),
  dataCenterId: z.string().min(1),
  effectiveFrom: z.string().min(1),
  displayName: z.string().max(255).optional(),
  status: z.enum(['open', 'closed', 'maintenance']),
  /** null = 不限配额（写入 -1） */
  availableGpuQuota: z.number().int().nullable(),
})

export const merchantRegionUpdateCardTypesSchema = z.object({
  merchantId: z.string().min(1),
  regionId: z.string().min(1),
  enabledCardTypeIds: z.array(z.string().min(1)).min(1),
})

export const merchantConsumptionQuerySchema = z.object({
  merchantId: z.string().min(1),
  usageMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
})

export const merchantConsumptionDailySchema = merchantConsumptionQuerySchema.extend({
  recentDays: z.number().int().positive().max(366).optional(),
})

const merchantPricingProductLineSchema = z.enum([
  'elastic_service',
  'cloud_vm',
  'job',
  'spot',
])

export const merchantRegionPricingFormSchema = z.object({
  merchantId: z.string().min(1),
  dataCenterId: z.string().min(1),
  gpuCardTypeIds: z.array(z.string().min(1)),
  effectiveFrom: z.string().min(1),
})

export const merchantRegionPricingBatchUpsertSchema = z.object({
  merchantId: z.string().min(1),
  dataCenterId: z.string().min(1),
  effectiveFrom: z.string().min(1),
  items: z
    .array(
      z.object({
        gpuCardTypeId: z.string().min(1),
        productLine: merchantPricingProductLineSchema,
        billingUnit: z.enum(['hour']).default('hour'),
        purchasePrice: z.number().min(0),
      }),
    )
    .min(1),
})

export const merchantPricingListSchema = z.object({
  merchantId: z.string().min(1),
})

export const merchantChangeAccountManagerSchema = z.object({
  merchantId: z.string().min(1),
  staffId: z.string().min(1),
  effectiveFrom: z.string().min(1),
  remark: z.string().max(500).optional(),
})
