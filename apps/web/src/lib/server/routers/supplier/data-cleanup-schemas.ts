import { z } from 'zod'

export const supplierDataCleanupModeSchema = z.enum([
  'full',
  'business_batches_only',
  'scoped',
])

export const supplierDataCleanupPreviewSchema = z.object({
  mode: supplierDataCleanupModeSchema,
  supplierId: z.string().min(1).optional(),
  dataCenterId: z.string().min(1).optional(),
  includeOpsUploadBatch: z.boolean().optional(),
})

export const supplierDataCleanupExecuteSchema = supplierDataCleanupPreviewSchema.extend({
  confirmToken: z.literal('DELETE'),
  acknowledged: z.literal(true),
  approvalTicketNo: z.string().trim().optional(),
})

export type SupplierDataCleanupMode = z.infer<typeof supplierDataCleanupModeSchema>
export type SupplierDataCleanupPreviewInput = z.infer<typeof supplierDataCleanupPreviewSchema>
export type SupplierDataCleanupExecuteInput = z.infer<typeof supplierDataCleanupExecuteSchema>
