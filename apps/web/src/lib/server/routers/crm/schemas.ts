import { z } from 'zod'

const expectedScaleSchema = z
  .object({
    cards: z.array(z.object({ cardTypeId: z.string(), cardCount: z.number() })),
    storage: z.object({
      enabled: z.boolean(),
      storageType: z.enum(['shared_storage', 'object_storage']),
      sizeGB: z.number(),
    }),
    productLines: z.object({
      bareMetal: z.number(),
      elasticService: z.number(),
      job: z.number(),
    }),
  })
  .nullable()
  .optional()

export const platformImportCustomerSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('existing'),
    customerId: z.string().min(1),
  }),
  z.object({
    mode: z.literal('create'),
    name: z.string().min(1),
    type: z.enum(['B', 'C']),
    contactPerson: z.string().optional(),
    contactPhone: z.string().optional(),
  }),
])

export const platformImportCommitItemSchema = z.object({
  platformTenantId: z.string().regex(/^\d+$/),
  customer: platformImportCustomerSchema.optional(),
})

export const customerUpsertSchema = z
  .object({
    name: z.string(),
    shortName: z.string().optional(),
    type: z.enum(['B', 'C']),
    status: z.enum(['active', 'inactive', 'suspended']).optional(),
    contactPerson: z.string(),
    contactPhone: z.string(),
    contactEmail: z.string(),
    industry: z.string(),
    address: z.string(),
    certCode: z.string().optional(),
    salesManagerId: z.string().optional(),
    expectedScale: expectedScaleSchema,
  })
  .refine((data) => data.name.trim() || (data.shortName?.trim() ?? ''), {
    message: '客户名称与客户简称不能同时为空',
    path: ['name'],
  })

export const projectStaffSchema = z.object({
  preSalesStaffId: z.string(),
  accountManagerStaffId: z.string().min(1),
  deliveryManagerStaffId: z.string().min(1),
  projectManagerStaffId: z.string(),
})

export const tenantProjectImportFormSchema = z.object({
  stage: z.enum(['lead', 'testing', 'converted']),
  businessLineId: z.string().min(1),
  preSalesStaffId: z.string(),
  accountManagerStaffId: z.string().min(1),
  deliveryManagerStaffId: z.string().min(1),
  projectManagerStaffId: z.string(),
  tagId: z.string(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '请选择有效的开始日期'),
})

export const projectUpsertSchema = z.object({
  customerId: z.string().min(1),
  primaryTenantId: z.string().optional(),
  name: z.string().min(1),
  description: z.string(),
  stage: z.enum(['lead', 'testing', 'converted']),
  status: z.enum(['active', 'paused', 'completed']).optional(),
  businessLineId: z.string().min(1),
  monthlyBudget: z.number().optional(),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  staff: projectStaffSchema,
})

export const staffDepartmentSchema = z.enum([
  '中台',
  '运营中心',
  '产品',
  '研发',
  '运维',
  '销售',
])

export const staffAppRoleSchema = z.enum(['admin', 'user', 'member'])

export const staffUpsertSchema = z.object({
  displayName: z.string().min(1),
  mobile: z.string().min(1),
  email: z.string().nullable().optional(),
  employeeNo: z.string().nullable().optional(),
  status: z.string(),
  department: staffDepartmentSchema.nullable().optional(),
  position: z.string().nullable().optional(),
  roles: z.array(staffAppRoleSchema).optional().default([]),
  isDefaultPreSales: z.boolean().optional().default(false),
  isDefaultAccountManager: z.boolean().optional().default(false),
  isDefaultDeliveryManager: z.boolean().optional().default(false),
  isDefaultProjectManager: z.boolean().optional().default(false),
  authUserId: z.string().nullable().optional(),
  createLoginAccount: z.boolean().optional().default(true),
})

export const staffListSchema = z
  .object({
    search: z.string().optional(),
    status: z.string().optional(),
    department: z.string().optional(),
    position: z.string().optional(),
  })
  .optional()

export const billingTenantUpdateSchema = z.object({
  tenant: z.object({
    name: z.string().min(1),
    phone: z.string().optional(),
    status: z.enum(['active', 'inactive', 'suspended']),
    type: z.enum(['internal', 'external']),
    balance: z.number(),
    overdueAt: z.string().nullable().optional(),
    creditLimit: z.number().nullable().optional(),
    isDefault: z.boolean(),
  }),
  customer: z.object({
    type: z.enum(['B', 'C']),
    contactPerson: z.string(),
    contactPhone: z.string(),
    contactEmail: z.string(),
    status: z.enum(['active', 'inactive', 'suspended']),
  }),
})

export const customerMergeSchema = z.object({
  targetCustomerId: z.string().min(1),
  sourceCustomerIds: z.array(z.string().min(1)).min(1),
  defaultTenantId: z.string().min(1).optional(),
})
