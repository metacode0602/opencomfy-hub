import { z } from 'zod'
import { DATACENTER_SCALE_OPTIONS } from '@/lib/types/datacenter-create'

export const datacenterCreateSchema = z.object({
  supplierId: z.string().min(1),
  name: z.string().trim().min(1, '请填写机房名称'),
  code: z.string().trim().optional(),
  address: z.string().trim().optional(),
  description: z.string().trim().optional(),
  location: z.string().trim().optional(),
  containerInstanceRegion: z.string().trim().optional(),
  bareMetalRegion: z.string().trim().optional(),
  scale: z.enum(DATACENTER_SCALE_OPTIONS, { message: '请选择规模' }),
  publicIpCount: z.number().int().min(0).optional(),
  internalNetworkCidr: z.string().trim().optional(),
  status: z.enum(['online', 'offline', 'maintenance']).default('offline'),
  networkFee: z.number().min(0).default(0),
  managementNodeFee: z.number().min(0).default(0),
  externalOnboardingId: z.string().trim().optional(),
})
