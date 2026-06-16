import { z } from 'zod'

export const devicePlatformProbeListSchema = z.object({
  search: z.string().optional(),
  consistencyFlag: z
    .enum([
      'consistent',
      'missing_platform',
      'unexpected_platform',
      'multi_channel_conflict',
      'not_evaluated',
      'missing_crm',
    ])
    .optional(),
  probeStatus: z
    .enum([
      'no_internal_ip',
      'dc_unmapped',
      'platform_absent',
      'proxy_only',
      'k8s_only',
      'bare_metal_only',
      'proxy_and_k8s',
      'proxy_and_bare_metal',
      'k8s_and_bare_metal',
      'all_matched',
      'ambiguous',
    ])
    .optional(),
  recordKind: z.enum(['crm_inventory', 'platform_orphan']).optional(),
  needsActionOnly: z.boolean().optional(),
  orphansOnly: z.boolean().optional(),
  snapshotHour: z.string().datetime().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
})

export type DevicePlatformProbeListInput = z.infer<typeof devicePlatformProbeListSchema>
