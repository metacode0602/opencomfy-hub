import { z } from 'zod'

import { DEVICE_RETIRE_REASON_OPTIONS } from '@/lib/types/device-retire'

const retireReasonValues = DEVICE_RETIRE_REASON_OPTIONS.map((o) => o.value) as [
  (typeof DEVICE_RETIRE_REASON_OPTIONS)[number]['value'],
  ...(typeof DEVICE_RETIRE_REASON_OPTIONS)[number]['value'][],
]

export const deviceRetireMetaSchema = z.object({
  reason: z.enum(retireReasonValues),
  expectedCompletionDate: z.string().min(1),
  remark: z.string().max(2000).optional(),
})

export const deviceRetireFileSchema = z.object({
  dataCenterId: z.string().min(1),
  fileName: z.string().min(1),
  fileBase64: z.string().min(1),
})

export const deviceRetireRequestSchema = z.object({
  supplierId: z.string().min(1),
  meta: deviceRetireMetaSchema,
  files: z.array(deviceRetireFileSchema).min(1),
})
