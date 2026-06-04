import { z } from 'zod'
import { PROJECT_STAGE_VALUES } from '@/lib/types/crm'

export const projectStageSchema = z.enum(PROJECT_STAGE_VALUES)

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

export const staffDepartmentSchema = z.enum([
  '中台',
  '运营中心',
  '产品',
  '研发',
  '运维',
  '销售',
  '市场',
])

export const staffPositionSchema = z.enum(['经理', '员工', '高管'])

export const tenantProjectImportFormSchema = z.object({
  stage: projectStageSchema,
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
  stage: projectStageSchema,
  status: z.enum(['active', 'paused', 'completed']).optional(),
  businessLineId: z.string().min(1),
  monthlyBudget: z.number().optional(),
  startDate: z.string().min(1),
  endDate: z.string().optional(),
  revenueDepartment: staffDepartmentSchema,
  staff: projectStaffSchema,
})

const effectiveDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '请选择有效的生效日期')

export const changeProjectAccountManagerSchema = z.object({
  projectId: z.string().min(1),
  staffId: z.string().min(1),
  effectiveFrom: effectiveDateSchema,
  remark: z.string().max(500).optional(),
})

export const changeProjectRevenueDepartmentSchema = z.object({
  projectId: z.string().min(1),
  department: staffDepartmentSchema,
  effectiveFrom: effectiveDateSchema,
  remark: z.string().max(500).optional(),
})

export const staffAppRoleSchema = z.enum(['admin', 'user', 'member'])

export const staffUpsertSchema = z
  .object({
    displayName: z.string().min(1),
    mobile: z.string().min(1),
    email: z.string().nullable().optional(),
    employeeNo: z.string().nullable().optional(),
    status: z.string(),
    department: staffDepartmentSchema.nullable().optional(),
    position: staffPositionSchema.nullable().optional(),
    roles: z.array(staffAppRoleSchema).optional().default([]),
    isDefaultPreSales: z.boolean().optional().default(false),
    isDefaultAccountManager: z.boolean().optional().default(false),
    isDefaultDeliveryManager: z.boolean().optional().default(false),
    isDefaultProjectManager: z.boolean().optional().default(false),
    authUserId: z.string().nullable().optional(),
    createLoginAccount: z.boolean().optional().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.roles.length > 0 && !data.email?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: '选择了角色时必须填写邮箱',
        path: ['email'],
      })
    }
  })

export const staffListSchema = z
  .object({
    search: z.string().optional(),
    status: z.string().optional(),
    department: z.string().optional(),
    position: staffPositionSchema.optional(),
  })
  .optional()

const billingTenantDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional()

export const billingTenantInternalSettingSchema = z
  .object({
    type: z.enum(['internal', 'external']),
    internalEffectiveFrom: billingTenantDateSchema,
    internalEffectiveTo: billingTenantDateSchema,
  })
  .superRefine((data, ctx) => {
    if (data.type !== 'internal') return
    const from = data.internalEffectiveFrom?.trim()
    const to = data.internalEffectiveTo?.trim()
    if (from && to && from > to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '收入排除开始日期不能晚于结束日期',
        path: ['internalEffectiveTo'],
      })
    }
  })

export const billingTenantUpdateSchema = z.object({
  tenant: z.object({
    name: z.string().min(1),
    phone: z.string().optional(),
    status: z.enum(['active', 'inactive', 'suspended']),
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
