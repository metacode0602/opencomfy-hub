import { z } from 'zod'

export const faultIncidentListSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['all', '处理中', '已关闭']).optional(),
  supplierId: z.string().optional(),
})

export const faultIncidentCreateSchema = z.object({
  supplierId: z.string().min(1),
  title: z.string().trim().min(1, '请填写标题'),
  severity: z.enum(['P1', 'P2', 'P3', 'P4']),
  deviceId: z.string().optional().nullable(),
  computeNodeId: z.string().optional().nullable(),
})

export const faultIncidentCloseSchema = z.object({
  incidentId: z.string().min(1),
  resolution: z.string().optional().nullable(),
})
