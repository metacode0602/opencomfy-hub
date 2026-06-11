import { z } from 'zod'

export const entityContactFieldsSchema = z
  .object({
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
    title: z.string().trim().max(64).optional().default(''),
    remark: z.string().trim().optional().default(''),
    isPrimary: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    if (!data.phone && !data.email && !data.wechatId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '请至少填写手机号、邮箱或微信号中的一项',
        path: ['phone'],
      })
    }
  })

export const entityContactOwnerIdSchema = z.object({
  ownerId: z.string().min(1),
})

export const entityContactCreateSchema = entityContactFieldsSchema.extend({
  ownerId: z.string().min(1),
})

export const entityContactUpdateSchema = z.object({
  id: z.string().min(1),
  data: entityContactFieldsSchema,
})

export const entityContactDeleteSchema = z.object({
  id: z.string().min(1),
})

export const entityContactSetPrimarySchema = z.object({
  id: z.string().min(1),
})

export const customerContactListSchema = z.object({ customerId: z.string().min(1) })
export const customerContactCreateSchema = entityContactFieldsSchema.extend({
  customerId: z.string().min(1),
})

export const tenantContactListSchema = z.object({ tenantId: z.string().min(1) })
export const tenantContactCreateSchema = entityContactFieldsSchema.extend({
  tenantId: z.string().min(1),
})

export const merchantContactListSchema = z.object({ merchantId: z.string().min(1) })
export const merchantContactCreateSchema = entityContactFieldsSchema.extend({
  merchantId: z.string().min(1),
})
