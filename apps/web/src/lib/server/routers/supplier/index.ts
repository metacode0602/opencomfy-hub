import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { datacenterImportDataAccess } from '@/lib/server/dataaccess/supplier/datacenter-import'
import { deviceImportDataAccess } from '@/lib/server/dataaccess/supplier/device-import'
import { deviceRetireDataAccess } from '@/lib/server/dataaccess/supplier/device-retire'
import { platformDatacenterImportDataAccess } from '@/lib/server/dataaccess/supplier/platform-datacenter-import'
import { platformSupplierImportDataAccess } from '@/lib/server/dataaccess/supplier/platform-supplier-import'
import { physicalDevicesDataAccess } from '@/lib/server/dataaccess/supplier/physical-devices'
import { supplierImportDataAccess } from '@/lib/server/dataaccess/supplier/supplier-import'
import { suppliersDataAccess } from '@/lib/server/dataaccess/supplier/suppliers'
import { supplierError } from '@/lib/server/dataaccess/supplier/logger'
import { SuanliSupplyOpenApiError } from '@/lib/server/integrations/suanli-supply-api'
import { PLATFORM_DATACENTER_IMPORT_MAX_TENANT_IDS } from '@/lib/supplier/platform-datacenter-import-utils'
import { PLATFORM_SUPPLIER_TYPES } from '@/lib/supplier/platform-supplier-import-utils'
import {
  deviceChangelogRowSchema,
  deviceImportCommitBaseSchema,
  deviceInventoryRowSchema,
  faultRecordsRowSchema,
} from '@/lib/server/routers/supplier/device-import-schemas'
import { deviceRetireRequestSchema } from '@/lib/server/routers/supplier/device-retire-schemas'
import { adminProcedure, createTRPCRouter, protectedProcedure } from '../trpc'

const importFileSchema = z.object({
  fileName: z.string().min(1),
  fileBase64: z.string().min(1),
})

const platformSupplierSearchSchema = z.object({
  types: z.enum(PLATFORM_SUPPLIER_TYPES),
  name: z.string(),
  defaultBusinessManagerStaffId: z.string().min(1),
})

const platformDatacenterSearchSchema = z.object({
  tenantIds: z
    .array(z.string().regex(/^\d+$/))
    .max(PLATFORM_DATACENTER_IMPORT_MAX_TENANT_IDS),
  name: z.string(),
})

function mapImportError(error: unknown): never {
  if (error instanceof SuanliSupplyOpenApiError) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: error.message })
  }
  if (error instanceof Error) {
    const message = error.message
    if (
      message.includes('不能超过') ||
      message.includes('仅支持') ||
      message.includes('至少需要') ||
      message.includes('请至少输入') ||
      message.includes('单次最多') ||
      message.includes('无效') ||
      message.includes('不存在') ||
      message.includes('无法解析') ||
      message.includes('请先') ||
      message.includes('没有可入库') ||
      message.includes('没有可导入') ||
      message.includes('没有通过校验') ||
      message.includes('外网IP') ||
      message.includes('期望完成日期') ||
      message.includes('已在线') ||
      message.includes('不属于') ||
      message.includes('拉取') ||
      message.includes('OpenAPI') ||
      message.includes('算算力')
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

  listPhysicalDevices: protectedProcedure
    .input(z.object({ supplierId: z.string().optional() }))
    .query(async ({ input }) => {
      try {
        if (input.supplierId) {
          await suppliersDataAccess.assertSupplierExists(input.supplierId)
        }
        return await physicalDevicesDataAccess.list({ supplierId: input.supplierId })
      } catch (e) {
        mapImportError(e)
      }
    }),

  getPhysicalDeviceStats: protectedProcedure
    .input(z.object({ supplierId: z.string().optional() }))
    .query(async ({ input }) => {
      try {
        if (input.supplierId) {
          await suppliersDataAccess.assertSupplierExists(input.supplierId)
        }
        return await physicalDevicesDataAccess.getStats({ supplierId: input.supplierId })
      } catch (e) {
        mapImportError(e)
      }
    }),

  markPhysicalDeviceOnline: adminProcedure
    .input(z.object({ deviceId: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      try {
        return await physicalDevicesDataAccess.markOnline({
          deviceId: input.deviceId,
          operatorName: ctx.user.name ?? ctx.user.email ?? '运营',
        })
      } catch (e) {
        mapImportError(e)
      }
    }),

  deviceImport: createTRPCRouter({
    getContext: protectedProcedure
      .input(z.object({ supplierId: z.string().min(1) }))
      .query(async ({ input }) => {
        try {
          return await deviceImportDataAccess.getContext(input.supplierId)
        } catch (e) {
          mapImportError(e)
        }
      }),

    commitInventory: adminProcedure
      .input(
        deviceImportCommitBaseSchema.extend({
          dataCenterId: z.string().min(1),
          rows: z.array(deviceInventoryRowSchema).min(1),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          return await deviceImportDataAccess.commitInventory({
            ...input,
            operatorName: ctx.user.name ?? ctx.user.email ?? '运营',
          })
        } catch (e) {
          mapImportError(e)
        }
      }),

    commitChangelog: adminProcedure
      .input(
        deviceImportCommitBaseSchema.extend({
          dataCenterId: z.string().min(1),
          rows: z.array(deviceChangelogRowSchema).min(1),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          return await deviceImportDataAccess.commitChangelog({
            ...input,
            operatorName: ctx.user.name ?? ctx.user.email ?? '运营',
          })
        } catch (e) {
          mapImportError(e)
        }
      }),

    commitFaultRecords: adminProcedure
      .input(
        deviceImportCommitBaseSchema.extend({
          rows: z.array(faultRecordsRowSchema).min(1),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          return await deviceImportDataAccess.commitFaultRecords({
            ...input,
            operatorName: ctx.user.name ?? ctx.user.email ?? '运营',
          })
        } catch (e) {
          mapImportError(e)
        }
      }),
  }),

  deviceRetire: createTRPCRouter({
    listBatches: protectedProcedure
      .input(
        z
          .object({
            supplierId: z.string().optional(),
            importStatus: z.string().optional(),
            search: z.string().optional(),
          })
          .optional(),
      )
      .query(async ({ input }) => {
        try {
          return await deviceRetireDataAccess.listBatches(input)
        } catch (e) {
          mapImportError(e)
        }
      }),

    getBatchById: protectedProcedure
      .input(z.object({ id: z.string().min(1) }))
      .query(async ({ input }) => {
        try {
          const batch = await deviceRetireDataAccess.getBatchById(input.id)
          if (!batch) {
            throw new TRPCError({ code: 'NOT_FOUND', message: '下架批次不存在' })
          }
          return batch
        } catch (e) {
          mapImportError(e)
        }
      }),

    getContext: protectedProcedure
      .input(z.object({ supplierId: z.string().min(1) }))
      .query(async ({ input }) => {
        try {
          return await deviceRetireDataAccess.getContext(input.supplierId)
        } catch (e) {
          mapImportError(e)
        }
      }),

    preview: adminProcedure.input(deviceRetireRequestSchema).mutation(async ({ input }) => {
      try {
        return await deviceRetireDataAccess.preview(input)
      } catch (e) {
        mapImportError(e)
      }
    }),

    commit: adminProcedure.input(deviceRetireRequestSchema).mutation(async ({ input, ctx }) => {
      try {
        return await deviceRetireDataAccess.commit({
          ...input,
          operatorStaffId: ctx.user.id,
          operatorName: ctx.user.name ?? ctx.user.email ?? '运营',
        })
      } catch (e) {
        mapImportError(e)
      }
    }),
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
      .input(importFileSchema.extend({ supplierId: z.string().min(1).optional() }))
      .mutation(async ({ input }) => {
        try {
          return await datacenterImportDataAccess.preview(input)
        } catch (e) {
          mapImportError(e)
        }
      }),

    commit: adminProcedure
      .input(importFileSchema.extend({ supplierId: z.string().min(1).optional() }))
      .mutation(async ({ input }) => {
        try {
          return await datacenterImportDataAccess.commit(input)
        } catch (e) {
          mapImportError(e)
        }
      }),
  }),

  platformImport: createTRPCRouter({
    preview: adminProcedure
      .input(platformSupplierSearchSchema)
      .mutation(async ({ input }) => {
        try {
          return await platformSupplierImportDataAccess.preview(input)
        } catch (e) {
          mapImportError(e)
        }
      }),

    commit: adminProcedure
      .input(platformSupplierSearchSchema)
      .mutation(async ({ input }) => {
        try {
          return await platformSupplierImportDataAccess.commit(input)
        } catch (e) {
          mapImportError(e)
        }
      }),
  }),

  platformDatacenterImport: createTRPCRouter({
    preview: adminProcedure
      .input(platformDatacenterSearchSchema)
      .mutation(async ({ input }) => {
        try {
          return await platformDatacenterImportDataAccess.preview(input)
        } catch (e) {
          mapImportError(e)
        }
      }),

    commit: adminProcedure
      .input(platformDatacenterSearchSchema)
      .mutation(async ({ input }) => {
        try {
          return await platformDatacenterImportDataAccess.commit(input)
        } catch (e) {
          mapImportError(e)
        }
      }),
  }),
})
