import { z } from 'zod'

const contactSchema = z.object({
  name: z.string().min(1),
  title: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  wechat: z.string().optional(),
})

const gpuSnapshotInputSchema = z.object({
  cardType: z.string().min(1),
  total: z.number().int().min(0),
  idle: z.number().int().min(0),
  reserved: z.number().int().min(0).optional(),
  inUse: z.number().int().min(0).optional(),
  unitPrice: z.number().optional(),
  availableTime: z.string().optional(),
  notes: z.string().optional(),
})

export const supplyChainLeadListSchema = z.object({
  search: z.string().optional(),
  type: z.enum(['supplier', 'datacenter', 'all']).default('all'),
  status: z
    .enum(['new', 'contacting', 'evaluating', 'negotiating', 'converted', 'lost', 'all'])
    .default('all'),
  priority: z.enum(['high', 'medium', 'low', 'all']).default('all'),
  cardTypeNames: z.array(z.string()).optional(),
  ownerStaffId: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
})

export const supplyChainLeadCreateSchema = z.object({
  type: z.enum(['supplier', 'datacenter']),
  name: z.string().min(1),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  supplierNameText: z.string().optional(),
  dockingScope: z
    .enum(['spot_only', 'bare_metal_only', 'spot_and_bare_metal', 'normal'])
    .optional(),
  province: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  source: z.string().optional(),
  description: z.string().optional(),
  estimatedOnlineDate: z.string().optional(),
  resourceContact: contactSchema,
  businessContact: contactSchema.optional(),
  gpuSnapshots: z.array(gpuSnapshotInputSchema).optional(),
  tags: z.array(z.string()).optional(),
})

export const supplyChainLeadUpdateSchema = supplyChainLeadCreateSchema
  .omit({ type: true })
  .extend({
    leadId: z.string().min(1),
  })

export const supplyChainLeadUpdateStatusSchema = z.object({
  leadId: z.string().min(1),
  status: z.enum(['new', 'contacting', 'evaluating', 'negotiating', 'converted', 'lost']),
  lostReason: z.string().optional(),
})

export const supplyChainLeadActivityCreateSchema = z.object({
  leadId: z.string().min(1),
  description: z.string().min(1),
})

export const supplyChainLeadActivityUpdateSchema = z.object({
  activityId: z.string().min(1),
  description: z.string().min(1),
})
