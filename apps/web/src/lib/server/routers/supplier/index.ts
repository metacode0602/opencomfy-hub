import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { datacenterImportDataAccess } from '@/lib/server/dataaccess/supplier/datacenter-import'
import { supplierImportDataAccess } from '@/lib/server/dataaccess/supplier/supplier-import'
import { suppliersDataAccess } from '@/lib/server/dataaccess/supplier/suppliers'
import { supplierError } from '@/lib/server/dataaccess/supplier/logger'
import { adminProcedure, createTRPCRouter, protectedProcedure } from '../trpc'

const importFileSchema = z.object({
  fileName: z.string().min(1),
  fileBase64: z.string().min(1),
})

function mapImportError(error: unknown): never {
  if (error instanceof Error) {
    const message = error.message
    if (
      message.includes('不能超过') ||
      message.includes('仅支持') ||
      message.includes('至少需要') ||
      message.includes('无效') ||
      message.includes('不存在') ||
      message.includes('无法解析')
    ) {
      throw new TRPCError({ code: 'BAD_REQUEST', message })
    }
    supplierError('supplier-router', 'import failed', error)
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message })
  }
  throw error
}

export const supplierRouter = createTRPCRouter({
  list: protectedProcedure.query(async () => {
    try {
      return await suppliersDataAccess.list()
    } catch (e) {
      mapImportError(e)
    }
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      try {
        const row = await suppliersDataAccess.getById(input.id)
        if (!row) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '供应商不存在' })
        }
        return row
      } catch (e) {
        mapImportError(e)
      }
    }),

  listDataCenters: protectedProcedure
    .input(z.object({ supplierId: z.string() }))
    .query(async ({ input }) => {
      try {
        await suppliersDataAccess.assertSupplierExists(input.supplierId)
        return await suppliersDataAccess.listDataCentersBySupplier(input.supplierId)
      } catch (e) {
        mapImportError(e)
      }
    }),

  listGpuInventory: protectedProcedure
    .input(z.object({ supplierId: z.string() }))
    .query(async ({ input }) => {
      try {
        await suppliersDataAccess.assertSupplierExists(input.supplierId)
        return await suppliersDataAccess.listGpuInventoryBySupplier(input.supplierId)
      } catch (e) {
        mapImportError(e)
      }
    }),

  listContracts: protectedProcedure
    .input(z.object({ supplierId: z.string() }))
    .query(async ({ input }) => {
      try {
        await suppliersDataAccess.assertSupplierExists(input.supplierId)
        return await suppliersDataAccess.listContractsBySupplier(input.supplierId)
      } catch (e) {
        mapImportError(e)
      }
    }),

  listBills: protectedProcedure
    .input(z.object({ supplierId: z.string() }))
    .query(async ({ input }) => {
      try {
        await suppliersDataAccess.assertSupplierExists(input.supplierId)
        return await suppliersDataAccess.listBillsBySupplier(input.supplierId)
      } catch (e) {
        mapImportError(e)
      }
    }),

  listPricingRecords: protectedProcedure
    .input(z.object({ supplierId: z.string() }))
    .query(async ({ input }) => {
      try {
        await suppliersDataAccess.assertSupplierExists(input.supplierId)
        return await suppliersDataAccess.listPricingRecordsBySupplier(input.supplierId)
      } catch (e) {
        mapImportError(e)
      }
    }),

  listPricingHistory: protectedProcedure
    .input(z.object({ supplierId: z.string() }))
    .query(async ({ input }) => {
      try {
        await suppliersDataAccess.assertSupplierExists(input.supplierId)
        return await suppliersDataAccess.listPricingHistoryBySupplier(input.supplierId)
      } catch (e) {
        mapImportError(e)
      }
    }),

  listActiveGpuCardTypes: protectedProcedure.query(async () => {
    try {
      return await suppliersDataAccess.listActiveGpuCardTypes()
    } catch (e) {
      mapImportError(e)
    }
  }),

  import: createTRPCRouter({
    preview: adminProcedure
      .input(
        importFileSchema.extend({
          defaultBusinessManagerStaffId: z.string().min(1),
        }),
      )
      .mutation(async ({ input }) => {
        try {
          return await supplierImportDataAccess.preview(input)
        } catch (e) {
          mapImportError(e)
        }
      }),

    commit: adminProcedure
      .input(
        importFileSchema.extend({
          defaultBusinessManagerStaffId: z.string().min(1),
        }),
      )
      .mutation(async ({ input }) => {
        try {
          return await supplierImportDataAccess.commit(input)
        } catch (e) {
          mapImportError(e)
        }
      }),
  }),

  datacenterImport: createTRPCRouter({
    preview: adminProcedure
      .input(importFileSchema.extend({ supplierId: z.string().min(1) }))
      .mutation(async ({ input }) => {
        try {
          return await datacenterImportDataAccess.preview(input)
        } catch (e) {
          mapImportError(e)
        }
      }),

    commit: adminProcedure
      .input(importFileSchema.extend({ supplierId: z.string().min(1) }))
      .mutation(async ({ input }) => {
        try {
          return await datacenterImportDataAccess.commit(input)
        } catch (e) {
          mapImportError(e)
        }
      }),
  }),
})
