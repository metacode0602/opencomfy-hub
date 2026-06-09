import { z } from 'zod'

const supplierOpsEngineerFieldsSchema = z.object({
  name: z.string().trim().min(1, '请填写姓名').max(128),
  phone: z.string().trim().max(32).optional().default(''),
  email: z
    .string()
    .trim()
    .max(255)
    .optional()
    .default('')
    .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
      message: '请填写有效的邮箱地址',
    }),
  wechatId: z.string().trim().max(128).optional().default(''),
})

export const supplierOpsEngineerListSchema = z.union([
  z.object({ supplierId: z.string() }),
  z.object({ dataCenterId: z.string() }),
])

export const supplierOpsEngineerCreateSchema = supplierOpsEngineerFieldsSchema.extend({
  dataCenterId: z.string(),
})

export const supplierOpsEngineerUpdateSchema = z.object({
  id: z.string(),
  data: supplierOpsEngineerFieldsSchema,
})

export const supplierOpsEngineerDeleteSchema = z.object({
  id: z.string(),
})
