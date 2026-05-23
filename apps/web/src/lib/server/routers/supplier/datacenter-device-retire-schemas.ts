import { z } from 'zod'

import { DEVICE_RETIRE_REASON_OPTIONS } from '@/lib/types/device-retire'
import { RETIRE_ACTION_TYPE_OPTIONS } from '@/lib/types/datacenter-device-retire'
import { onboardingBatchPlanLineSchema } from '@/lib/server/routers/supplier/onboarding-batch-schemas'

const retireReasonValues = DEVICE_RETIRE_REASON_OPTIONS.map((o) => o.value) as [
  (typeof DEVICE_RETIRE_REASON_OPTIONS)[number]['value'],
  ...(typeof DEVICE_RETIRE_REASON_OPTIONS)[number]['value'][],
]

const retireActionTypeValues = RETIRE_ACTION_TYPE_OPTIONS.map((o) => o.value) as [
  (typeof RETIRE_ACTION_TYPE_OPTIONS)[number]['value'],
  ...(typeof RETIRE_ACTION_TYPE_OPTIONS)[number]['value'][],
]

export const datacenterRetireMetaSchema = z.object({
  reason: z.enum(retireReasonValues),
  retireActionType: z.enum(retireActionTypeValues).optional(),
  expectedCompletionDate: z.string().min(1, '请选择期望完成日期'),
  workOrderNo: z.string().trim().min(1, '请填写飞书审批工单号'),
  remark: z.string().max(2000).optional(),
})

export const datacenterRetireListFileSchema = z.object({
  fileName: z.string().min(1),
  fileBase64: z.string().min(1),
})

export const datacenterRetireRequestSchema = z
  .object({
    dataCenterId: z.string().min(1),
    meta: datacenterRetireMetaSchema,
    planLines: z.array(onboardingBatchPlanLineSchema).default([]),
    uploadList: z.boolean().default(false),
    listFile: datacenterRetireListFileSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const isClosure = data.meta.reason === 'dc_closure'

    if (isClosure) {
      if (data.planLines.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '机房裁撤不需要下架计划行',
          path: ['planLines'],
        })
      }
      if (data.uploadList) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '机房裁撤不需要上传清单',
          path: ['uploadList'],
        })
      }
      return
    }

    if (data.planLines.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '请至少添加一行下架计划',
        path: ['planLines'],
      })
    }

    if (!data.meta.retireActionType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '请选择下架计划类型',
        path: ['meta', 'retireActionType'],
      })
    }

    const seen = new Set<string>()
    for (let i = 0; i < data.planLines.length; i++) {
      const line = data.planLines[i]!
      const key = `${line.gpuCardTypeCode}::${line.cooperationType}`
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '卡型与合作类型组合不可重复',
          path: ['planLines', i],
        })
      }
      seen.add(key)
    }

    if (data.uploadList && !data.listFile) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '请上传下架清单',
        path: ['listFile'],
      })
    }
  })

export const datacenterRetireContextSchema = z.object({
  dataCenterId: z.string().min(1),
})
