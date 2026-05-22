import { z } from 'zod'

const supplierStatusSchema = z.enum(['negotiating', 'cooperating', 'suspended', 'terminated'])
const cooperationModeSchema = z.enum(['card_time', 'revenue_share'])

export const supplierUpdateSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1, '请填写供应商全称'),
    shortName: z.string().trim().min(1, '请填写简称'),
    status: supplierStatusSchema,
    cooperationMode: cooperationModeSchema,
    revenueShareRatio: z.number().positive().max(100).optional(),
    businessManagerStaffId: z.string().min(1, '请选择商务经理'),
    contactPerson: z.string().trim().min(1, '请填写联系人'),
    contactPhone: z.string().trim().min(1, '请填写联系电话'),
    contactEmail: z.string().trim().min(1, '请填写联系邮箱'),
    address: z.string().trim().min(1, '请填写地址'),
    bankAccount: z.string().trim().optional(),
    bankName: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.cooperationMode === 'revenue_share' && data.revenueShareRatio == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '分成模式请填写有效的分成比例（1-100）',
        path: ['revenueShareRatio'],
      })
    }
  })

export const supplierListSchema = z
  .object({
    externalTenantId: z.string().trim().min(1).optional(),
  })
  .optional()
