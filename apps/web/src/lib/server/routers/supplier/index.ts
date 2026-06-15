import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { unitCostsDataAccess } from '@/lib/server/dataaccess/unit-costs'
import { unitCostsError, unitCostsLog } from '@/lib/server/dataaccess/unit-costs/logger'
import { platformPricingDataAccess } from '@/lib/server/dataaccess/platform-pricing'
import { platformPricingError } from '@/lib/server/dataaccess/platform-pricing/logger'
import { gpuCardTypesDataAccess } from '@/lib/server/dataaccess/supplier/gpu-card-types'
import { datacenterImportDataAccess } from '@/lib/server/dataaccess/supplier/datacenter-import'
import { datacenterCreateDataAccess } from '@/lib/server/dataaccess/supplier/datacenter-create'
import { datacenterUpdateDataAccess } from '@/lib/server/dataaccess/supplier/datacenter-update'
import { deviceImportDataAccess } from '@/lib/server/dataaccess/supplier/device-import'
import { deviceRetireDataAccess } from '@/lib/server/dataaccess/supplier/device-retire'
import { onboardingBatchDataAccess } from '@/lib/server/dataaccess/supplier/onboarding-batch'
import { supplierOverviewDataAccess } from '@/lib/server/dataaccess/supplier/overview'
import { supplierActivityDataAccess } from '@/lib/server/dataaccess/supplier/supplier-activity'
import { platformDatacenterImportDataAccess } from '@/lib/server/dataaccess/supplier/platform-datacenter-import'
import { platformDatacenterBindDataAccess } from '@/lib/server/dataaccess/supplier/platform-datacenter-bind'
import { platformSupplierImportDataAccess } from '@/lib/server/dataaccess/supplier/platform-supplier-import'
import { platformSupplierBindDataAccess } from '@/lib/server/dataaccess/supplier/platform-supplier-bind'
import { physicalDevicesDataAccess } from '@/lib/server/dataaccess/supplier/physical-devices'
import { supplierImportDataAccess } from '@/lib/server/dataaccess/supplier/supplier-import'
import { staffDataAccess } from '@/lib/server/dataaccess/crm/staff'
import { suppliersDataAccess } from '@/lib/server/dataaccess/supplier/suppliers'
import { supplierOpsEngineersDataAccess } from '@/lib/server/dataaccess/supplier/supplier-ops-engineers'
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
import {
  datacenterRetireContextSchema,
  datacenterRetireListSampleSchema,
  datacenterRetireRequestSchema,
} from '@/lib/server/routers/supplier/datacenter-device-retire-schemas'
import { datacenterDeviceRetireDataAccess } from '@/lib/server/dataaccess/supplier/datacenter-device-retire'
import { internalTestHoldDataAccess } from '@/lib/server/dataaccess/supplier/internal-test-hold'
import { faultIncidentDataAccess } from '@/lib/server/dataaccess/supplier/fault-incident'
import {
  onboardingBatchAdjustHistorySchema,
  onboardingBatchAdjustPlanSchema,
  onboardingBatchCompleteSchema,
  onboardingBatchCommitListSchema,
  onboardingBatchCreateSchema,
  onboardingBatchListBySupplierSchema,
  onboardingBatchListSchema,
  onboardingBatchParseListSchema,
  onboardingBatchProgressEventsSchema,
  onboardingBatchDatacenterDevicesSchema,
  onboardingBatchVoidSchema,
} from '@/lib/server/routers/supplier/onboarding-batch-schemas'
import { supplierActivityListSchema, supplierActivityCreateSchema } from '@/lib/server/routers/supplier/supplier-activity-schemas'
import {
  gpuCardTypeListSchema,
  gpuCardTypeUpdateSchema,
  gpuCardTypeUpsertSchema,
} from '@/lib/server/routers/supplier/gpu-card-types-schemas'
import {
  platformPricePeriodCreateSchema,
  platformPricePeriodUpdateSchema,
  platformPriceUpdateSchema,
  platformPriceUpsertSchema,
} from '@/lib/server/routers/supplier/platform-pricing-schemas'
import {
  internalTestHoldCreateSchema,
  internalTestHoldEndSchema,
  internalTestHoldLinkDevicesSchema,
  internalTestHoldListSchema,
  internalTestHoldUnlinkDeviceSchema,
} from '@/lib/server/routers/supplier/internal-test-hold-schemas'
import {
  faultIncidentCloseSchema,
  faultIncidentCreateSchema,
  faultIncidentListSchema,
} from '@/lib/server/routers/supplier/fault-incident-schemas'
import { overviewFiltersSchema, gpuResourceTrendSchema } from '@/lib/server/routers/supplier/overview-schemas'
import { gpuResourceStatisticsDataAccess } from '@/lib/server/dataaccess/supplier/gpu-resource-statistics'
import { supplierListSchema, supplierCreateSchema, supplierUpdateSchema } from '@/lib/server/routers/supplier/supplier-schemas'
import {
  supplierOpsEngineerCreateSchema,
  supplierOpsEngineerDeleteSchema,
  supplierOpsEngineerListSchema,
  supplierOpsEngineerUpdateSchema,
} from '@/lib/server/routers/supplier/supplier-ops-engineer-schemas'
import { datacenterCreateSchema } from '@/lib/server/routers/supplier/datacenter-create-schemas'
import {
  datacenterUpdateSchema,
  datacenterUpdateStatusSchema,
} from '@/lib/server/routers/supplier/datacenter-update-schemas'
import {
  unitCostListSchema,
  unitCostUpdateSchema,
  unitCostUpsertSchema,
} from '@/lib/server/routers/supplier/unit-costs-schemas'
import { supplierDataCleanupDataAccess } from '@/lib/server/dataaccess/supplier/data-cleanup'
import {
  supplierDataCleanupExecuteSchema,
  supplierDataCleanupPreviewSchema,
} from '@/lib/server/routers/supplier/data-cleanup-schemas'
import { supplyChainLeadsDataAccess } from '@/lib/server/dataaccess/supplier/supply-chain-leads'
import { bareMetalOrderDataAccess } from '@/lib/server/dataaccess/supplier/bare-metal-order'
import { devicePlatformProbeDataAccess } from '@/lib/server/dataaccess/supplier/device-platform-probe'
import { runScheduledDevicePlatformProbe } from '@/lib/server/dataaccess/supplier/device-platform-probe-scheduled'
import {
  supplyChainLeadActivityCreateSchema,
  supplyChainLeadActivityUpdateSchema,
  supplyChainLeadCreateSchema,
  supplyChainLeadListSchema,
  supplyChainLeadUpdateSchema,
  supplyChainLeadUpdateStatusSchema,
} from '@/lib/server/routers/supplier/supply-chain-leads-schemas'
import {
  bareMetalOrderListSchema,
} from '@/lib/server/routers/supplier/bare-metal-order-schemas'
import { devicePlatformProbeListSchema } from '@/lib/server/routers/supplier/device-platform-probe-schemas'
import { adminProcedure, createTRPCRouter, supplyProcedure } from '../trpc'

const importFileSchema = z.object({
  fileName: z.string().min(1),
  fileBase64: z.string().min(1),
})

const platformSupplierSearchSchema = z.object({
  types: z.enum(PLATFORM_SUPPLIER_TYPES),
  name: z.string(),
  defaultBusinessManagerStaffId: z.string().min(1),
})

const platformSupplierBindSearchSchema = z.object({
  supplierId: z.string().min(1),
  query: z.string().trim().min(1, '请输入平台租户 ID 或名称'),
})

const platformSupplierBindCommitSchema = z.object({
  supplierId: z.string().min(1),
  applicationId: z.string().min(1),
})

const platformDatacenterSearchSchema = z.object({
  tenantIds: z
    .array(z.string().regex(/^\d+$/))
    .max(PLATFORM_DATACENTER_IMPORT_MAX_TENANT_IDS),
  name: z.string(),
})

const platformDatacenterBindSearchSchema = z.object({
  dataCenterId: z.string().min(1),
  query: z.string().trim().min(1, '请输入平台租户 ID、机房 ID 或名称'),
})

const platformDatacenterBindCommitSchema = z.object({
  dataCenterId: z.string().min(1),
  idcId: z.string().min(1),
})

function mapImportError(error: unknown): never {
  if (error instanceof TRPCError) {
    throw error
  }
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
      message.includes('算算力') ||
      message.includes('已存在') ||
      message.includes('无法禁用') ||
      message.includes('无法配置') ||
      message.includes('不可变更') ||
      message.includes('已有平台价') ||
      message.includes('请填写') ||
      message.includes('须晚于') ||
      message.includes('重叠') ||
      message.includes('阶梯') ||
      message.includes('成本配置') ||
      message.includes('不可变更') ||
      message.includes('清单行数') ||
      message.includes('显卡型号') ||
      message.includes('无法识别') ||
      message.includes('未填写') ||
      message.includes('卡型') ||
      message.includes('上架计划') ||
      message.includes('内部占用') ||
      message.includes('IP') ||
      message.includes('合作类型') ||
      message.includes('机房不一致') ||
      message.includes('工单号指向') ||
      message.includes('SN 已存在') ||
      message.includes('资产编号已存在') ||
      message.includes('唯一性冲突') ||
      message.includes('复制源') ||
      message.includes('结束时间') ||
      message.includes('Karmada') ||
      message.includes('标签值') ||
      message.includes('线索') ||
      message.includes('资源对接人') ||
      message.includes('对接范围') ||
      message.includes('活动不存在') ||
      message.includes('评论可编辑') ||
      message.includes('已转正线索不可编辑')
    ) {
      throw new TRPCError({ code: 'BAD_REQUEST', message })
    }
    supplierError('supplier-router', 'operation failed', error)
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '操作失败，请稍后重试' })
  }
  throw error
}

export const supplierRouter = createTRPCRouter({
  list: supplyProcedure.input(supplierListSchema).query(async ({ input }) => {
    try {
      return await suppliersDataAccess.list(input)
    } catch (e) {
      mapImportError(e)
    }
  }),

  getById: supplyProcedure
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

  listSupplierActivities: supplyProcedure
    .input(supplierActivityListSchema)
    .query(async ({ input }) => {
      try {
        await suppliersDataAccess.assertSupplierExists(input.supplierId)
        return await supplierActivityDataAccess.listBySupplierId(input)
      } catch (e) {
        mapImportError(e)
      }
    }),

  createSupplierActivity: supplyProcedure
    .input(supplierActivityCreateSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        await suppliersDataAccess.assertSupplierExists(input.supplierId)
        return await supplierActivityDataAccess.createComment({
          supplierId: input.supplierId,
          comment: input.comment,
          files: input.files,
          user: ctx.user,
        })
      } catch (e) {
        if (e instanceof Error) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message })
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '发布动态失败' })
      }
    }),

  update: supplyProcedure.input(supplierUpdateSchema).mutation(async ({ input }) => {
    try {
      return await suppliersDataAccess.update(input)
    } catch (e) {
      mapImportError(e)
    }
  }),

  create: supplyProcedure.input(supplierCreateSchema).mutation(async ({ input }) => {
    try {
      return await suppliersDataAccess.create(input)
    } catch (e) {
      mapImportError(e)
    }
  }),

  listOpsEngineers: supplyProcedure
    .input(supplierOpsEngineerListSchema)
    .query(async ({ input }) => {
      try {
        return await supplierOpsEngineersDataAccess.list(input)
      } catch (e) {
        if (e instanceof Error) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message })
        }
        mapImportError(e)
      }
    }),

  createOpsEngineer: supplyProcedure
    .input(supplierOpsEngineerCreateSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const staffId = await staffDataAccess.resolveStaffIdForAuthUser(ctx.user)
        return await supplierOpsEngineersDataAccess.create({
          ...input,
          operatorStaffId: staffId,
        })
      } catch (e) {
        if (e instanceof Error) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message })
        }
        mapImportError(e)
      }
    }),

  updateOpsEngineer: supplyProcedure
    .input(supplierOpsEngineerUpdateSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const staffId = await staffDataAccess.resolveStaffIdForAuthUser(ctx.user)
        return await supplierOpsEngineersDataAccess.update({
          id: input.id,
          ...input.data,
          operatorStaffId: staffId,
        })
      } catch (e) {
        if (e instanceof Error) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message })
        }
        mapImportError(e)
      }
    }),

  deleteOpsEngineer: supplyProcedure
    .input(supplierOpsEngineerDeleteSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const staffId = await staffDataAccess.resolveStaffIdForAuthUser(ctx.user)
        return await supplierOpsEngineersDataAccess.delete({
          id: input.id,
          operatorStaffId: staffId,
        })
      } catch (e) {
        if (e instanceof Error) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message })
        }
        mapImportError(e)
      }
    }),

  listDataCenters: supplyProcedure
    .input(z.object({ supplierId: z.string() }))
    .query(async ({ input }) => {
      try {
        await suppliersDataAccess.assertSupplierExists(input.supplierId)
        return await suppliersDataAccess.listDataCentersBySupplier(input.supplierId)
      } catch (e) {
        mapImportError(e)
      }
    }),

  createDataCenter: supplyProcedure
    .input(datacenterCreateSchema)
    .mutation(async ({ input }) => {
      try {
        await suppliersDataAccess.assertSupplierExists(input.supplierId)
        return await datacenterCreateDataAccess.create(input)
      } catch (e) {
        mapImportError(e)
      }
    }),

  updateDataCenter: supplyProcedure
    .input(datacenterUpdateSchema)
    .mutation(async ({ input }) => {
      try {
        return await datacenterUpdateDataAccess.update(input)
      } catch (e) {
        mapImportError(e)
      }
    }),

  updateDataCenterStatus: supplyProcedure
    .input(datacenterUpdateStatusSchema)
    .mutation(async ({ input }) => {
      try {
        return await datacenterUpdateDataAccess.updateStatus(input)
      } catch (e) {
        mapImportError(e)
      }
    }),

  listAllDataCenters: supplyProcedure
    .input(z.object({ supplierId: z.string().optional() }))
    .query(async ({ input }) => {
      try {
        if (input.supplierId) {
          await suppliersDataAccess.assertSupplierExists(input.supplierId)
        }
        return await suppliersDataAccess.listAllDataCenters({ supplierId: input.supplierId })
      } catch (e) {
        mapImportError(e)
      }
    }),

  getDataCenterStats: supplyProcedure
    .input(z.object({ supplierId: z.string().optional() }))
    .query(async ({ input }) => {
      try {
        if (input.supplierId) {
          await suppliersDataAccess.assertSupplierExists(input.supplierId)
        }
        return await suppliersDataAccess.getDataCenterStats({ supplierId: input.supplierId })
      } catch (e) {
        mapImportError(e)
      }
    }),

  getDataCenterDetail: supplyProcedure
    .input(z.object({ dataCenterId: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        const detail = await suppliersDataAccess.getDataCenterDetail(input.dataCenterId)
        if (!detail) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '机房不存在' })
        }
        return detail
      } catch (e) {
        mapImportError(e)
      }
    }),

  listGpuInventory: supplyProcedure
    .input(z.object({ supplierId: z.string().optional() }))
    .query(async ({ input }) => {
      try {
        if (input.supplierId) {
          await suppliersDataAccess.assertSupplierExists(input.supplierId)
        }
        return await suppliersDataAccess.listGpuInventory({ supplierId: input.supplierId })
      } catch (e) {
        mapImportError(e)
      }
    }),

  getGpuInventoryDetail: supplyProcedure
    .input(z.object({ inventoryId: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        const detail = await suppliersDataAccess.getGpuInventoryDetail(input.inventoryId)
        if (!detail) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '聚合库存不存在' })
        }
        return detail
      } catch (e) {
        mapImportError(e)
      }
    }),

  listContracts: supplyProcedure
    .input(z.object({ supplierId: z.string() }))
    .query(async ({ input }) => {
      try {
        await suppliersDataAccess.assertSupplierExists(input.supplierId)
        return await suppliersDataAccess.listContractsBySupplier(input.supplierId)
      } catch (e) {
        mapImportError(e)
      }
    }),

  listAllContracts: supplyProcedure.query(async () => {
    try {
      return await suppliersDataAccess.listAllContracts()
    } catch (e) {
      mapImportError(e)
    }
  }),

  listBills: supplyProcedure
    .input(z.object({ supplierId: z.string() }))
    .query(async ({ input }) => {
      try {
        await suppliersDataAccess.assertSupplierExists(input.supplierId)
        return await suppliersDataAccess.listBillsBySupplier(input.supplierId)
      } catch (e) {
        mapImportError(e)
      }
    }),

  listPricingRecords: supplyProcedure
    .input(z.object({ supplierId: z.string() }))
    .query(async ({ input }) => {
      try {
        await suppliersDataAccess.assertSupplierExists(input.supplierId)
        return await suppliersDataAccess.listPricingRecordsBySupplier(input.supplierId)
      } catch (e) {
        mapImportError(e)
      }
    }),

  listPricingHistory: supplyProcedure
    .input(z.object({ supplierId: z.string() }))
    .query(async ({ input }) => {
      try {
        await suppliersDataAccess.assertSupplierExists(input.supplierId)
        return await suppliersDataAccess.listPricingHistoryBySupplier(input.supplierId)
      } catch (e) {
        mapImportError(e)
      }
    }),

  listActiveGpuCardTypes: supplyProcedure.query(async () => {
    try {
      return await suppliersDataAccess.listActiveGpuCardTypes()
    } catch (e) {
      mapImportError(e)
    }
  }),

  listPhysicalDevices: supplyProcedure
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

  getPhysicalDeviceStats: supplyProcedure
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

  getPhysicalDeviceDetail: supplyProcedure
    .input(z.object({ deviceId: z.string().min(1) }))
    .query(async ({ input }) => {
      try {
        const detail = await physicalDevicesDataAccess.getDetail(input.deviceId)
        if (!detail) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '设备不存在' })
        }
        return detail
      } catch (e) {
        mapImportError(e)
      }
    }),

  markPhysicalDeviceOnline: supplyProcedure
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
    getContext: supplyProcedure
      .input(z.object({ supplierId: z.string().min(1) }))
      .query(async ({ input }) => {
        try {
          return await deviceImportDataAccess.getContext(input.supplierId)
        } catch (e) {
          mapImportError(e)
        }
      }),

    getGpuCardTypeIdByInternalIp: supplyProcedure
      .input(z.object({ supplierId: z.string().min(1) }))
      .query(async ({ input }) => {
        try {
          return await deviceImportDataAccess.getGpuCardTypeIdByInternalIp(input.supplierId)
        } catch (e) {
          mapImportError(e)
        }
      }),

    commitInventory: supplyProcedure
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

    commitChangelog: supplyProcedure
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

    commitFaultRecords: supplyProcedure
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
    listBatches: supplyProcedure
      .input(
        z
          .object({
            supplierId: z.string().optional(),
            dataCenterId: z.string().optional(),
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

    getBatchById: supplyProcedure
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

    getContext: supplyProcedure
      .input(z.object({ supplierId: z.string().min(1) }))
      .query(async ({ input }) => {
        try {
          return await deviceRetireDataAccess.getContext(input.supplierId)
        } catch (e) {
          mapImportError(e)
        }
      }),

    preview: supplyProcedure.input(deviceRetireRequestSchema).mutation(async ({ input }) => {
      try {
        return await deviceRetireDataAccess.preview(input)
      } catch (e) {
        mapImportError(e)
      }
    }),

    commit: supplyProcedure.input(deviceRetireRequestSchema).mutation(async ({ input, ctx }) => {
      try {
        const staffId = await staffDataAccess.resolveStaffIdForAuthUser(ctx.user)
        return await deviceRetireDataAccess.commit({
          ...input,
          operatorStaffId: staffId,
          operatorName: ctx.user.name ?? ctx.user.email ?? '运营',
        })
      } catch (e) {
        mapImportError(e)
      }
    }),

    getDatacenterContext: supplyProcedure
      .input(datacenterRetireContextSchema)
      .query(async ({ input }) => {
        try {
          return await datacenterDeviceRetireDataAccess.getContext(input.dataCenterId)
        } catch (e) {
          mapImportError(e)
        }
      }),

    getDatacenterRetireListSample: supplyProcedure
      .input(datacenterRetireListSampleSchema)
      .query(async ({ input }) => {
        try {
          return await datacenterDeviceRetireDataAccess.listRetireListSampleRows(
            input.dataCenterId,
            input.planLines,
          )
        } catch (e) {
          mapImportError(e)
        }
      }),

    previewDatacenter: supplyProcedure
      .input(datacenterRetireRequestSchema)
      .mutation(async ({ input }) => {
        try {
          return await datacenterDeviceRetireDataAccess.preview(input)
        } catch (e) {
          mapImportError(e)
        }
      }),

    commitDatacenter: supplyProcedure
      .input(datacenterRetireRequestSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          const staffId = await staffDataAccess.resolveStaffIdForAuthUser(ctx.user)
          return await datacenterDeviceRetireDataAccess.commit({
            ...input,
            operatorStaffId: staffId,
            operatorName: ctx.user.name ?? ctx.user.email ?? '运营',
          })
        } catch (e) {
          mapImportError(e)
        }
      }),
  }),

  onboardingBatch: createTRPCRouter({
    list: supplyProcedure.input(onboardingBatchListSchema).query(async ({ input }) => {
      try {
        return await onboardingBatchDataAccess.list(input)
      } catch (e) {
        mapImportError(e)
      }
    }),

    listBySupplier: supplyProcedure
      .input(onboardingBatchListBySupplierSchema)
      .query(async ({ input }) => {
        try {
          await suppliersDataAccess.assertSupplierExists(input.supplierId)
          return await onboardingBatchDataAccess.listBySupplierId(input.supplierId)
        } catch (e) {
          mapImportError(e)
        }
      }),

    getById: supplyProcedure
      .input(z.object({ id: z.string().min(1) }))
      .query(async ({ input }) => {
        try {
          const batch = await onboardingBatchDataAccess.getById(input.id)
          if (!batch) {
            throw new TRPCError({ code: 'NOT_FOUND', message: '接入批次不存在' })
          }
          return batch
        } catch (e) {
          mapImportError(e)
        }
      }),

    getProgress: supplyProcedure
      .input(z.object({ batchId: z.string().min(1) }))
      .query(async ({ input }) => {
        try {
          return await onboardingBatchDataAccess.getProgress(input.batchId)
        } catch (e) {
          mapImportError(e)
        }
      }),

    getDetailPage: supplyProcedure
      .input(z.object({ batchId: z.string().min(1) }))
      .query(async ({ input }) => {
        try {
          const detail = await onboardingBatchDataAccess.getDetailPage(input.batchId)
          if (!detail) {
            throw new TRPCError({ code: 'NOT_FOUND', message: '接入批次不存在' })
          }
          return detail
        } catch (e) {
          mapImportError(e)
        }
      }),

    listDatacenterUploadedDevices: supplyProcedure
      .input(onboardingBatchDatacenterDevicesSchema)
      .query(async ({ input }) => {
        try {
          const result = await onboardingBatchDataAccess.listDatacenterUploadedDevices(
            input.batchId,
          )
          if (!result) {
            throw new TRPCError({ code: 'NOT_FOUND', message: '接入批次不存在' })
          }
          return result
        } catch (e) {
          mapImportError(e)
        }
      }),

    create: supplyProcedure.input(onboardingBatchCreateSchema).mutation(async ({ input, ctx }) => {
      try {
        const staffId = await staffDataAccess.resolveStaffIdForAuthUser(ctx.user)
        return await onboardingBatchDataAccess.create({
          ...input,
          operatorStaffId: staffId,
        })
      } catch (e) {
        mapImportError(e)
      }
    }),

    parseList: supplyProcedure.input(onboardingBatchParseListSchema).mutation(async ({ input }) => {
      try {
        return await onboardingBatchDataAccess.parseList(input)
      } catch (e) {
        mapImportError(e)
      }
    }),

    commitList: supplyProcedure.input(onboardingBatchCommitListSchema).mutation(async ({ input, ctx }) => {
      try {
        const staffId = await staffDataAccess.resolveStaffIdForAuthUser(ctx.user)
        return await onboardingBatchDataAccess.commitList({
          ...input,
          operatorStaffId: staffId,
        })
      } catch (e) {
        mapImportError(e)
      }
    }),

    adjustPlan: supplyProcedure
      .input(onboardingBatchAdjustPlanSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          const staffId = await staffDataAccess.resolveStaffIdForAuthUser(ctx.user)
          const staff = staffId
            ? await staffDataAccess.getById(staffId).catch(() => null)
            : null
          return await onboardingBatchDataAccess.adjustPlan({
            ...input,
            operatorStaffId: staffId,
            operatorName: staff?.display_name ?? ctx.user.name ?? '运营',
          })
        } catch (e) {
          mapImportError(e)
        }
      }),

    listProgressEvents: supplyProcedure
      .input(onboardingBatchProgressEventsSchema)
      .query(async ({ input }) => {
        try {
          return await onboardingBatchDataAccess.listProgressEvents(input.batchId)
        } catch (e) {
          mapImportError(e)
        }
      }),

    listAdjustHistory: supplyProcedure
      .input(onboardingBatchAdjustHistorySchema)
      .query(async ({ input }) => {
        try {
          return await onboardingBatchDataAccess.listAdjustHistory(input.batchId)
        } catch (e) {
          mapImportError(e)
        }
      }),

    completeBatch: supplyProcedure
      .input(onboardingBatchCompleteSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          const staffId = await staffDataAccess.resolveStaffIdForAuthUser(ctx.user)
          const staff = staffId
            ? await staffDataAccess.getById(staffId).catch(() => null)
            : null
          return await onboardingBatchDataAccess.completeBatch({
            ...input,
            operatorStaffId: staffId,
            operatorName: staff?.display_name ?? ctx.user.name ?? '运营',
          })
        } catch (e) {
          mapImportError(e)
        }
      }),

    voidBatch: supplyProcedure
      .input(onboardingBatchVoidSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          const staffId = await staffDataAccess.resolveStaffIdForAuthUser(ctx.user)
          const staff = staffId
            ? await staffDataAccess.getById(staffId).catch(() => null)
            : null
          return await onboardingBatchDataAccess.voidBatch({
            ...input,
            operatorStaffId: staffId,
            operatorName: staff?.display_name ?? ctx.user.name ?? '运营',
          })
        } catch (e) {
          mapImportError(e)
        }
      }),
  }),

  faultIncident: createTRPCRouter({
    list: supplyProcedure.input(faultIncidentListSchema).query(async ({ input }) => {
      try {
        if (input?.supplierId) {
          await suppliersDataAccess.assertSupplierExists(input.supplierId)
        }
        return await faultIncidentDataAccess.list(input ?? {})
      } catch (e) {
        mapImportError(e)
      }
    }),

    create: supplyProcedure.input(faultIncidentCreateSchema).mutation(async ({ input, ctx }) => {
      try {
        await suppliersDataAccess.assertSupplierExists(input.supplierId)
        const staffId = await staffDataAccess.resolveStaffIdForAuthUser(ctx.user)
        return await faultIncidentDataAccess.create({
          ...input,
          operatorStaffId: staffId,
          operatorName: ctx.user.name ?? ctx.user.email ?? '运营',
        })
      } catch (e) {
        mapImportError(e)
      }
    }),

    close: supplyProcedure.input(faultIncidentCloseSchema).mutation(async ({ input, ctx }) => {
      try {
        const staffId = await staffDataAccess.resolveStaffIdForAuthUser(ctx.user)
        return await faultIncidentDataAccess.close({
          incidentId: input.incidentId,
          resolution: input.resolution,
          operatorStaffId: staffId,
          operatorName: ctx.user.name ?? ctx.user.email ?? '运营',
        })
      } catch (e) {
        mapImportError(e)
      }
    }),
  }),

  internalTestHold: createTRPCRouter({
    list: supplyProcedure.input(internalTestHoldListSchema).query(async ({ input }) => {
      try {
        return await internalTestHoldDataAccess.list(input ?? {})
      } catch (e) {
        mapImportError(e)
      }
    }),

    getById: supplyProcedure
      .input(z.object({ holdId: z.string().min(1) }))
      .query(async ({ input }) => {
        try {
          const hold = await internalTestHoldDataAccess.getById(input.holdId)
          if (!hold) {
            throw new TRPCError({ code: 'NOT_FOUND', message: '内部占用记录不存在' })
          }
          return hold
        } catch (e) {
          mapImportError(e)
        }
      }),

    create: supplyProcedure.input(internalTestHoldCreateSchema).mutation(async ({ input, ctx }) => {
      try {
        const staffId = await staffDataAccess.resolveStaffIdForAuthUser(ctx.user)
        return await internalTestHoldDataAccess.create({
          ...input,
          operatorStaffId: staffId,
        })
      } catch (e) {
        mapImportError(e)
      }
    }),

    end: supplyProcedure.input(internalTestHoldEndSchema).mutation(async ({ input }) => {
      try {
        return await internalTestHoldDataAccess.endHold(input.holdId)
      } catch (e) {
        mapImportError(e)
      }
    }),

    linkDevices: supplyProcedure
      .input(internalTestHoldLinkDevicesSchema)
      .mutation(async ({ input }) => {
        try {
          return await internalTestHoldDataAccess.linkDevices(input)
        } catch (e) {
          mapImportError(e)
        }
      }),

    unlinkDevice: supplyProcedure
      .input(internalTestHoldUnlinkDeviceSchema)
      .mutation(async ({ input }) => {
        try {
          await internalTestHoldDataAccess.unlinkDevice(input.holdId, input.linkId)
          return { ok: true as const }
        } catch (e) {
          mapImportError(e)
        }
      }),
  }),

  import: createTRPCRouter({
    preview: supplyProcedure
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

    commit: supplyProcedure
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
    preview: supplyProcedure
      .input(importFileSchema.extend({ supplierId: z.string().min(1).optional() }))
      .mutation(async ({ input }) => {
        try {
          return await datacenterImportDataAccess.preview(input)
        } catch (e) {
          mapImportError(e)
        }
      }),

    commit: supplyProcedure
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
    preview: supplyProcedure
      .input(platformSupplierSearchSchema)
      .mutation(async ({ input }) => {
        try {
          return await platformSupplierImportDataAccess.preview(input)
        } catch (e) {
          mapImportError(e)
        }
      }),

    commit: supplyProcedure
      .input(platformSupplierSearchSchema)
      .mutation(async ({ input }) => {
        try {
          return await platformSupplierImportDataAccess.commit(input)
        } catch (e) {
          mapImportError(e)
        }
      }),
  }),

  platformBind: createTRPCRouter({
    search: supplyProcedure
      .input(platformSupplierBindSearchSchema)
      .mutation(async ({ input }) => {
        try {
          return await platformSupplierBindDataAccess.search(input)
        } catch (e) {
          mapImportError(e)
        }
      }),

    bind: supplyProcedure
      .input(platformSupplierBindCommitSchema)
      .mutation(async ({ input }) => {
        try {
          return await platformSupplierBindDataAccess.bind(input)
        } catch (e) {
          mapImportError(e)
        }
      }),
  }),

  platformDatacenterImport: createTRPCRouter({
    preview: supplyProcedure
      .input(platformDatacenterSearchSchema)
      .mutation(async ({ input }) => {
        try {
          return await platformDatacenterImportDataAccess.preview(input)
        } catch (e) {
          mapImportError(e)
        }
      }),

    commit: supplyProcedure
      .input(platformDatacenterSearchSchema)
      .mutation(async ({ input }) => {
        try {
          return await platformDatacenterImportDataAccess.commit(input)
        } catch (e) {
          mapImportError(e)
        }
      }),
  }),

  platformDatacenterBind: createTRPCRouter({
    search: supplyProcedure
      .input(platformDatacenterBindSearchSchema)
      .mutation(async ({ input }) => {
        try {
          return await platformDatacenterBindDataAccess.search(input)
        } catch (e) {
          mapImportError(e)
        }
      }),

    bind: supplyProcedure
      .input(platformDatacenterBindCommitSchema)
      .mutation(async ({ input }) => {
        try {
          return await platformDatacenterBindDataAccess.bind(input)
        } catch (e) {
          mapImportError(e)
        }
      }),
  }),

  gpuCardTypes: createTRPCRouter({
    list: adminProcedure.input(gpuCardTypeListSchema).query(async ({ input }) => {
      try {
        return await gpuCardTypesDataAccess.list(input ?? {})
      } catch (e) {
        mapImportError(e)
      }
    }),

    listActive: adminProcedure.query(async () => {
      try {
        return await gpuCardTypesDataAccess.listActive()
      } catch (e) {
        mapImportError(e)
      }
    }),

    getById: adminProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        try {
          const row = await gpuCardTypesDataAccess.getById(input.id)
          if (!row) {
            throw new TRPCError({ code: 'NOT_FOUND', message: '卡型不存在' })
          }
          return row
        } catch (e) {
          mapImportError(e)
        }
      }),

    create: adminProcedure.input(gpuCardTypeUpsertSchema).mutation(async ({ input }) => {
      try {
        return await gpuCardTypesDataAccess.create(input)
      } catch (e) {
        mapImportError(e)
      }
    }),

    update: adminProcedure
      .input(z.object({ id: z.string(), data: gpuCardTypeUpdateSchema }))
      .mutation(async ({ input }) => {
        try {
          return await gpuCardTypesDataAccess.update(input.id, input.data)
        } catch (e) {
          mapImportError(e)
        }
      }),

    setStatus: adminProcedure
      .input(z.object({ id: z.string(), status: z.enum(['active', 'disabled']) }))
      .mutation(async ({ input }) => {
        try {
          return await gpuCardTypesDataAccess.setStatus(input.id, input.status)
        } catch (e) {
          mapImportError(e)
        }
      }),
  }),

  unitCosts: createTRPCRouter({
    listRecords: adminProcedure.input(unitCostListSchema).query(async ({ input }) => {
      try {
        return await unitCostsDataAccess.listRecords(input?.supplierId)
      } catch (e) {
        mapImportError(e)
      }
    }),

    listHistory: adminProcedure.input(unitCostListSchema).query(async ({ input }) => {
      try {
        return await unitCostsDataAccess.listHistory(input?.supplierId)
      } catch (e) {
        mapImportError(e)
      }
    }),

    create: adminProcedure.input(unitCostUpsertSchema).mutation(async ({ input, ctx }) => {
      try {
        const staffId = await staffDataAccess.resolveStaffIdForAuthUser(ctx.user)
        return await unitCostsDataAccess.createRecord({
          ...input,
          pricingMode: input.pricingMode,
          updatedByStaffId: staffId,
        })
      } catch (e) {
        mapImportError(e)
      }
    }),

    update: adminProcedure.input(unitCostUpdateSchema).mutation(async ({ input, ctx }) => {
      try {
        const row = await unitCostsDataAccess.getRecordById(input.recordId)
        if (!row) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '成本配置不存在' })
        }
        const staffId = await staffDataAccess.resolveStaffIdForAuthUser(ctx.user)
        unitCostsLog('router.update', 'unit cost update requested', {
          recordId: input.recordId,
          pricingMode: input.pricingMode,
          userId: ctx.user.id,
        })
        const updated = await unitCostsDataAccess.updateRecord({
          supplierId: row.supplierId,
          dataCenterId: row.dataCenterId,
          gpuCardTypeId: row.cardTypeId,
          pricingMode: input.pricingMode,
          billingUnit: input.billingUnit,
          unitPrice: input.unitPrice,
          unitPricePerHour: input.unitPricePerHour,
          cardsPerMachine: input.cardsPerMachine,
          revenueSharePercent: input.revenueSharePercent,
          pricingTiers: input.pricingTiers,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: input.effectiveTo,
          recordId: input.recordId,
          reason: input.reason,
          changedByStaffId: staffId,
        })
        return updated
      } catch (e) {
        unitCostsError('router.update', 'unit cost update failed', e, {
          recordId: input.recordId,
        })
        mapImportError(e)
      }
    }),
  }),

  overview: createTRPCRouter({
    getFilterOptions: supplyProcedure.query(async () => {
      try {
        return await supplierOverviewDataAccess.getFilterOptions()
      } catch (e) {
        supplierError('router.overview.getFilterOptions', 'failed', e)
        mapImportError(e)
      }
    }),

    getStats: supplyProcedure.input(overviewFiltersSchema).query(async ({ input }) => {
      try {
        return await supplierOverviewDataAccess.getStats(input)
      } catch (e) {
        supplierError('router.overview.getStats', 'failed', e, input)
        mapImportError(e)
      }
    }),

    getGpuResourceTrend: supplyProcedure
      .input(gpuResourceTrendSchema)
      .query(async ({ input }) => {
        try {
          return await gpuResourceStatisticsDataAccess.getTrend(input.range)
        } catch (e) {
          supplierError('router.overview.getGpuResourceTrend', 'failed', e, input)
          mapImportError(e)
        }
      }),

    getGpuRegionOverview: supplyProcedure.query(async () => {
      try {
        return await gpuResourceStatisticsDataAccess.getRegionOverview()
      } catch (e) {
        supplierError('router.overview.getGpuRegionOverview', 'failed', e)
        mapImportError(e)
      }
    }),

    getAdminStatisticsDataCount: supplyProcedure
      .input(overviewFiltersSchema.pick({ region: true }))
      .query(async ({ input }) => {
        try {
          return await gpuResourceStatisticsDataAccess.getAdminStatisticsDataCount(input.region)
        } catch (e) {
          supplierError('router.overview.getAdminStatisticsDataCount', 'failed', e, input)
          mapImportError(e)
        }
      }),
  }),

  platformPricing: createTRPCRouter({
    listPage: adminProcedure.query(async () => {
      try {
        return await platformPricingDataAccess.getListPage()
      } catch (e) {
        platformPricingError('router.listPage', 'failed', e)
        mapImportError(e)
      }
    }),

    listRecords: adminProcedure.query(async () => {
      try {
        return await platformPricingDataAccess.listRecords()
      } catch (e) {
        platformPricingError('router.listRecords', 'failed', e)
        mapImportError(e)
      }
    }),

    listRecordsForCardType: adminProcedure
      .input(z.object({ cardTypeId: z.string() }))
      .query(async ({ input }) => {
        try {
          return await platformPricingDataAccess.listRecordsForCardType(input.cardTypeId)
        } catch (e) {
          platformPricingError('router.listRecordsForCardType', 'failed', e, input)
          mapImportError(e)
        }
      }),

    getDetailPage: adminProcedure
      .input(z.object({ cardTypeId: z.string() }))
      .query(async ({ input }) => {
        try {
          const detail = await platformPricingDataAccess.getDetailPage(input.cardTypeId)
          if (!detail) {
            throw new TRPCError({ code: 'NOT_FOUND', message: '卡型不存在' })
          }
          return detail
        } catch (e) {
          platformPricingError('router.getDetailPage', 'failed', e, input)
          mapImportError(e)
        }
      }),

    listHistory: adminProcedure
      .input(z.object({ cardTypeId: z.string() }))
      .query(async ({ input }) => {
        try {
          return await platformPricingDataAccess.listHistory(input.cardTypeId)
        } catch (e) {
          platformPricingError('router.listHistory', 'failed', e, input)
          mapImportError(e)
        }
      }),

    create: adminProcedure.input(platformPriceUpsertSchema).mutation(async ({ ctx, input }) => {
      try {
        const staffId = await staffDataAccess.resolveStaffIdForAuthUser(ctx.user)
        return await platformPricingDataAccess.createPrice({
          ...input,
          changedByStaffId: staffId,
        })
      } catch (e) {
        platformPricingError('router.create', 'failed', e, { gpuCardTypeId: input.gpuCardTypeId })
        mapImportError(e)
      }
    }),

    update: adminProcedure.input(platformPriceUpdateSchema).mutation(async ({ ctx, input }) => {
      try {
        const staffId = await staffDataAccess.resolveStaffIdForAuthUser(ctx.user)
        return await platformPricingDataAccess.updatePrice({
          ...input,
          changedByStaffId: staffId,
        })
      } catch (e) {
        platformPricingError('router.update', 'failed', e, { recordId: input.recordId })
        mapImportError(e)
      }
    }),

    createPeriod: adminProcedure
      .input(platformPricePeriodCreateSchema)
      .mutation(async ({ ctx, input }) => {
        try {
          const staffId = await staffDataAccess.resolveStaffIdForAuthUser(ctx.user)
          return await platformPricingDataAccess.createPeriod({
            gpuCardTypeId: input.gpuCardTypeId,
            effectiveFrom: input.effectiveFrom,
            effectiveTo: input.effectiveTo ?? null,
            copyFromPeriodId: input.copyFromPeriodId,
            autoClosePreviousCurrent: input.autoClosePreviousCurrent,
            manualPrices: input.manualPrices,
            changedByStaffId: staffId,
          })
        } catch (e) {
          platformPricingError('router.createPeriod', 'failed', e, {
            gpuCardTypeId: input.gpuCardTypeId,
          })
          mapImportError(e)
        }
      }),

    updatePeriod: adminProcedure
      .input(platformPricePeriodUpdateSchema)
      .mutation(async ({ ctx, input }) => {
        try {
          const staffId = await staffDataAccess.resolveStaffIdForAuthUser(ctx.user)
          return await platformPricingDataAccess.updatePeriod({
            gpuCardTypeId: input.gpuCardTypeId,
            periodId: input.periodId,
            effectiveFrom: input.effectiveFrom,
            effectiveTo: input.effectiveTo ?? null,
            changedByStaffId: staffId,
          })
        } catch (e) {
          platformPricingError('router.updatePeriod', 'failed', e, {
            gpuCardTypeId: input.gpuCardTypeId,
            periodId: input.periodId,
          })
          mapImportError(e)
        }
      }),
  }),

  supplyChainLeads: createTRPCRouter({
    list: supplyProcedure.input(supplyChainLeadListSchema).query(async ({ input }) => {
      try {
        return await supplyChainLeadsDataAccess.list(input)
      } catch (e) {
        mapImportError(e)
      }
    }),

    stats: supplyProcedure.query(async () => {
      try {
        return await supplyChainLeadsDataAccess.stats()
      } catch (e) {
        mapImportError(e)
      }
    }),

    listCardTypeFilterOptions: supplyProcedure.query(async () => {
      try {
        return await supplyChainLeadsDataAccess.listCardTypeFilterOptions()
      } catch (e) {
        mapImportError(e)
      }
    }),

    getById: supplyProcedure
      .input(z.object({ id: z.string().min(1) }))
      .query(async ({ input }) => {
        try {
          const row = await supplyChainLeadsDataAccess.getById(input.id)
          if (!row) {
            throw new TRPCError({ code: 'NOT_FOUND', message: '线索不存在' })
          }
          return row
        } catch (e) {
          mapImportError(e)
        }
      }),

    create: supplyProcedure
      .input(supplyChainLeadCreateSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          return await supplyChainLeadsDataAccess.create(input, ctx.user)
        } catch (e) {
          mapImportError(e)
        }
      }),

    update: supplyProcedure
      .input(supplyChainLeadUpdateSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          const { leadId, ...data } = input
          return await supplyChainLeadsDataAccess.update(leadId, data, ctx.user)
        } catch (e) {
          mapImportError(e)
        }
      }),

    updateStatus: supplyProcedure
      .input(supplyChainLeadUpdateStatusSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          await supplyChainLeadsDataAccess.updateStatus(
            input.leadId,
            input.status,
            ctx.user,
            input.lostReason,
          )
          return { ok: true as const }
        } catch (e) {
          mapImportError(e)
        }
      }),

    listActivities: supplyProcedure
      .input(z.object({ leadId: z.string().min(1), limit: z.number().int().min(1).max(200).optional() }))
      .query(async ({ input }) => {
        try {
          return await supplyChainLeadsDataAccess.listActivities(input.leadId, input.limit)
        } catch (e) {
          mapImportError(e)
        }
      }),

    createActivity: supplyProcedure
      .input(supplyChainLeadActivityCreateSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          await supplyChainLeadsDataAccess.createActivity({
            leadId: input.leadId,
            description: input.description,
            user: ctx.user,
          })
          return { ok: true as const }
        } catch (e) {
          mapImportError(e)
        }
      }),

    updateActivity: supplyProcedure
      .input(supplyChainLeadActivityUpdateSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          await supplyChainLeadsDataAccess.updateActivity({
            activityId: input.activityId,
            description: input.description,
            user: ctx.user,
          })
          return { ok: true as const }
        } catch (e) {
          mapImportError(e)
        }
      }),
  }),

  bareMetalOrder: createTRPCRouter({
    list: supplyProcedure.input(bareMetalOrderListSchema).query(async ({ input }) => {
      try {
        return await bareMetalOrderDataAccess.list(input)
      } catch (e) {
        mapImportError(e)
      }
    }),

    getById: supplyProcedure
      .input(z.object({ id: z.string().min(1) }))
      .query(async ({ input }) => {
        try {
          const row = await bareMetalOrderDataAccess.getById(input.id)
          if (!row) {
            throw new TRPCError({ code: 'NOT_FOUND', message: '裸金属订单不存在' })
          }
          return row
        } catch (e) {
          mapImportError(e)
        }
      }),
  }),

  devicePlatformProbe: createTRPCRouter({
    getState: supplyProcedure.query(async () => {
      return devicePlatformProbeDataAccess.getState()
    }),

    list: supplyProcedure.input(devicePlatformProbeListSchema).query(async ({ input }) => {
      return devicePlatformProbeDataAccess.list(input)
    }),

    getById: supplyProcedure
      .input(z.object({ id: z.string().min(1) }))
      .query(async ({ input }) => {
        const row = await devicePlatformProbeDataAccess.getById(input.id)
        if (!row) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '探测记录不存在' })
        }
        return row
      }),

    runNow: adminProcedure.mutation(async () => {
      return runScheduledDevicePlatformProbe({ trigger: 'manual' })
    }),
  }),

  dataCleanup: createTRPCRouter({
    getCapabilities: adminProcedure.query(() => {
      return supplierDataCleanupDataAccess.getCapabilities()
    }),

    preview: adminProcedure.input(supplierDataCleanupPreviewSchema).query(async ({ input }) => {
      try {
        return await supplierDataCleanupDataAccess.preview(input)
      } catch (e) {
        if (e instanceof Error) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message })
        }
        mapImportError(e)
      }
    }),

    execute: adminProcedure
      .input(supplierDataCleanupExecuteSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          return await supplierDataCleanupDataAccess.execute(input, ctx.user.id)
        } catch (e) {
          if (e instanceof Error) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: e.message })
          }
          mapImportError(e)
        }
      }),
  }),
})
