import { z } from 'zod'

export const supplierActivityListSchema = z.object({
  supplierId: z.string().min(1),
  limit: z.number().int().positive().max(200).optional(),
})

export const supplierActivityCreateSchema = z.object({
  supplierId: z.string().min(1),
  comment: z.string().max(5000).default(''),
  files: z
    .array(
      z.object({
        fileName: z.string().min(1).max(255),
        mimeType: z.string().max(128).default('application/octet-stream'),
        fileBase64: z.string().min(1),
      }),
    )
    .max(5)
    .default([]),
})
