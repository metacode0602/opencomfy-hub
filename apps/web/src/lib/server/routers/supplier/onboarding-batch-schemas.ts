import { z } from 'zod'

export const onboardingBatchPlanLineSchema = z.object({
  gpuCardTypeId: z.string().optional(),
  gpuCardTypeCode: z.string().trim().min(1, '请选择卡型'),
  cooperationType: z.enum(['idle_time', 'whole_rent']),
  plannedQuantity: z.number().int().positive('数量须为正整数'),
})

export const onboardingBatchCreateSchema = z
  .object({
    batchKind: z.enum(['online', 'order_access']),
    supplierId: z.string().min(1),
    dataCenterId: z.string().min(1),
    contractId: z.string().optional(),
    accessMethod: z.string().min(1),
    plannedReadyAt: z.string().optional(),
    onlineReason: z.string().optional(),
    orderNo: z.string().optional(),
    remark: z.string().optional(),
    uploadList: z.boolean().default(false),
    workOrderNo: z.string().trim().min(1, '请填写飞书审批工单号'),
    planLines: z.array(onboardingBatchPlanLineSchema).min(1, '请至少添加一行上架计划'),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>()
    for (let i = 0; i < data.planLines.length; i++) {
      const line = data.planLines[i]!
      const key = `${line.gpuCardTypeCode}::${line.cooperationType}`
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '卡型与合作类型组合在本批次内不可重复',
          path: ['planLines', i],
        })
      }
      seen.add(key)
    }
    if (data.batchKind === 'online' && !data.onlineReason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '请选择上架原因',
        path: ['onlineReason'],
      })
    }
    if (data.batchKind === 'order_access') {
      if (!data.orderNo?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '请填写订单编号',
          path: ['orderNo'],
        })
      }
      if (!data.remark?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '请填写备注',
          path: ['remark'],
        })
      }
    }
  })

export const plannedBatchKindFilterSchema = z.enum([
  'all',
  'online',
  'order_access',
  'device_retire',
])

export const onboardingBatchListSchema = z.object({
  batchKind: plannedBatchKindFilterSchema,
  search: z.string().optional(),
  batchStatus: z.string().optional(),
  importStatus: z.string().optional(),
  supplierId: z.string().optional(),
})

export const onboardingBatchListBySupplierSchema = z.object({
  supplierId: z.string().min(1),
})

export const onboardingBatchParseListSchema = z.object({
  batchId: z.string().min(1),
  fileName: z.string().min(1),
  csvText: z.string().min(1),
})

export const onboardingBatchCommitListSchema = z.object({
  batchId: z.string().min(1),
})

export const onboardingBatchAdjustPlanSchema = z.object({
  batchId: z.string().min(1),
  reason: z.string().trim().min(4, '请填写调整原因（至少 4 字）'),
  effectiveAt: z.string().datetime().optional(),
  planLines: z.array(onboardingBatchPlanLineSchema).min(1, '请至少保留一行计划'),
  plannedReadyAt: z.string().optional(),
  batchStatus: z.string().optional(),
})

export const onboardingBatchProgressEventsSchema = z.object({
  batchId: z.string().min(1),
})

export const onboardingBatchAdjustHistorySchema = z.object({
  batchId: z.string().min(1),
})

export const onboardingBatchCompleteSchema = z.object({
  batchId: z.string().min(1),
  remark: z.string().trim().optional(),
})

export const onboardingBatchVoidSchema = z.object({
  batchId: z.string().min(1),
  reason: z.string().trim().min(4, '请填写作废原因（至少 4 字）'),
})
