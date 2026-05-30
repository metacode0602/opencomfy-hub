import { z } from 'zod'

const gpuCardTypeManufacturerSchema = z.enum(['NVIDIA', 'AMD', 'Intel', 'Huawei', 'Other'])

/** 字母、数字开头；可含字母、数字、下划线、连字符（允许纯数字） */
export const gpuCardTypeCodePattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/

const gpuCardTypeCodeSchema = z
  .string()
  .trim()
  .min(1, '请填写卡型编码')
  .max(64)
  .regex(gpuCardTypeCodePattern, '卡型编码仅可包含字母、数字、下划线与连字符')

export const gpuCardTypeUpsertSchema = z.object({
  code: gpuCardTypeCodeSchema,
  name: z.string().trim().min(1, '请填写卡型名称').max(128),
  manufacturer: gpuCardTypeManufacturerSchema,
  memoryGB: z.number().int().positive('请填写有效的显存容量（GB）'),
  tdpWatts: z.number().int().positive('请填写有效的 TDP（W）').optional(),
  computeCapability: z.string().trim().max(64).optional(),
  deviceRole: z.enum(['compute', 'infra']).optional(),
})

export const gpuCardTypeUpdateSchema = gpuCardTypeUpsertSchema.omit({ code: true })

export const gpuCardTypeListSchema = z
  .object({
    search: z.string().optional(),
    status: z.enum(['all', 'active', 'disabled']).optional(),
  })
  .optional()
