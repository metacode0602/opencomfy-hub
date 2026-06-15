import { z } from 'zod'

export const bareMetalOrderListSchema = z.object({
  search: z.string().optional(),
  platformOrderId: z.string().optional(),
  tenantId: z.string().optional(),
  projectId: z.string().optional(),
  dataCenterId: z.string().optional(),
  status: z.string().optional(),
  orderMark: z.enum(['online', 'offline', 'all']).optional(),
  source: z.string().optional(),
  orderedFrom: z.string().optional(),
  orderedTo: z.string().optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
})

export const offlineBareMetalOrderPreviewSchema = z.object({
  projectId: z.string().min(1),
  tenantId: z.string().min(1),
  fileName: z.string().min(1),
  fileBase64: z.string().min(1),
})

export const offlineBareMetalOrderCommitSchema = z.object({
  previewToken: z.string().min(1),
})
