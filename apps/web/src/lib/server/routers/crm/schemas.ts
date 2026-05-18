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

export const customerUpsertSchema = z.object({
  name: z.string().min(1),
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

export const projectStaffSchema = z.object({
  preSalesStaffId: z.string().min(1),
  accountManagerStaffId: z.string().min(1),
  deliveryManagerStaffId: z.string().min(1),
  projectManagerStaffId: z.string().min(1),
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

export const staffUpsertSchema = z.object({
  displayName: z.string().min(1),
  mobile: z.string().min(1),
  email: z.string().nullable().optional(),
  employeeNo: z.string().nullable().optional(),
  status: z.string(),
  department: z.string().nullable().optional(),
})
