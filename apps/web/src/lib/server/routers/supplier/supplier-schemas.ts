import { z } from 'zod'

const supplierStatusSchema = z.enum(['negotiating', 'cooperating', 'suspended', 'terminated'])
const cooperationModeSchema = z.enum([
  'card_time',
  'revenue_share',
  'tiered_card_time',
  'tiered_revenue_share',
])

const supplierFormSchema = z.object({
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

export const supplierCreateSchema = supplierFormSchema

export const supplierUpdateSchema = supplierFormSchema.extend({
  id: z.string().min(1),
})

export const supplierListSchema = z
  .object({
    externalTenantId: z.string().trim().min(1).optional(),
  })
  .optional()
