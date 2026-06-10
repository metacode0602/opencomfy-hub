import { TRPCError } from '@trpc/server'
import { merchantActivityDataAccess } from '@/lib/server/dataaccess/merchant/merchant-activity'
import { merchantDataAccess } from '@/lib/server/dataaccess/merchant/merchant'
import { merchantConsumptionDataAccess } from '@/lib/server/dataaccess/merchant/merchant-consumption'
import { merchantPlatformSyncDataAccess } from '@/lib/server/dataaccess/merchant/merchant-platform-sync'
import { merchantPricingDataAccess } from '@/lib/server/dataaccess/merchant/merchant-pricing'
import { merchantRechargeDataAccess } from '@/lib/server/dataaccess/merchant/merchant-recharge'
import { merchantRegionDataAccess } from '@/lib/server/dataaccess/merchant/merchant-region'
import { SuanliMerchantOpenApiError } from '@/lib/server/integrations/suanli-merchant-api'
import { adminProcedure, createTRPCRouter } from '../trpc'
import {
  merchantActivityCreateSchema,
  merchantActivityListSchema,
  merchantConsumptionDailySchema,
  merchantConsumptionQuerySchema,
  merchantIdSchema,
  merchantListSchema,
  merchantRechargeAuditSchema,
  merchantRechargeCreateSchema,
  merchantRechargeListSchema,
  merchantRechargeUpdateSchema,
  merchantRegionCreateSchema,
  merchantRegionListSchema,
  merchantRegionUpdateCardTypesSchema,
  merchantRegionPricingBatchUpsertSchema,
  merchantRegionPricingFormSchema,
  merchantPricingListSchema,
  merchantSyncCommitSchema,
  merchantSyncPreviewSchema,
  merchantUpdateSchema,
} from './schemas'

function mapMerchantSyncError(error: unknown): TRPCError {
  if (error instanceof SuanliMerchantOpenApiError) {
    return new TRPCError({ code: 'BAD_GATEWAY', message: error.message })
  }
  return new TRPCError({
    code: 'BAD_REQUEST',
    message: error instanceof Error ? error.message : '操作失败',
  })
}

export const merchantRouter = createTRPCRouter({
  list: adminProcedure.input(merchantListSchema.optional()).query(async ({ input }) => {
    return merchantDataAccess.list(input)
  }),

  getById: adminProcedure.input(merchantIdSchema).query(async ({ input }) => {
    const row = await merchantDataAccess.getById(input.id)
    if (!row) {
      throw new TRPCError({ code: 'NOT_FOUND', message: '商户不存在' })
    }
    return row
  }),

  update: adminProcedure.input(merchantUpdateSchema).mutation(async ({ input, ctx }) => {
    const { id, ...data } = input
    try {
      return await merchantDataAccess.update(id, data, ctx.user)
    } catch (error) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: error instanceof Error ? error.message : '更新失败',
      })
    }
  }),

  tenant: createTRPCRouter({
    list: adminProcedure.input(merchantIdSchema).query(async ({ input }) => {
      return merchantDataAccess.listTenantsByMerchantId(input.id)
    }),
  }),

  activity: createTRPCRouter({
    list: adminProcedure.input(merchantActivityListSchema).query(async ({ input }) => {
      return merchantActivityDataAccess.listByMerchantId(input)
    }),

    createComment: adminProcedure
      .input(merchantActivityCreateSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          return await merchantActivityDataAccess.createComment({
            merchantId: input.merchantId,
            comment: input.comment,
            files: input.files,
            user: ctx.user,
          })
        } catch (error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error instanceof Error ? error.message : '发送失败',
          })
        }
      }),
  }),

  recharge: createTRPCRouter({
    list: adminProcedure.input(merchantRechargeListSchema).query(async ({ input }) => {
      return merchantRechargeDataAccess.listByMerchantId(input.merchantId)
    }),

    create: adminProcedure.input(merchantRechargeCreateSchema).mutation(async ({ input, ctx }) => {
      const { merchantId, files, ...data } = input
      try {
        return await merchantRechargeDataAccess.create(merchantId, { ...data, files }, ctx.user)
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : '创建失败',
        })
      }
    }),

    update: adminProcedure.input(merchantRechargeUpdateSchema).mutation(async ({ input, ctx }) => {
      const { rechargeId, files, keepAttachmentIds, ...data } = input
      try {
        return await merchantRechargeDataAccess.update(
          rechargeId,
          { ...data, files, keepAttachmentIds },
          ctx.user,
        )
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : '更新失败',
        })
      }
    }),

    auditList: adminProcedure.input(merchantRechargeAuditSchema).query(async ({ input }) => {
      if (input.rechargeId) {
        return merchantRechargeDataAccess.listAuditByRechargeId(input.rechargeId)
      }
      if (input.merchantId) {
        return merchantRechargeDataAccess.listAuditByMerchantId(
          input.merchantId,
          input.limit ?? 20,
        )
      }
      return []
    }),
  }),

  sync: createTRPCRouter({
    preview: adminProcedure.input(merchantSyncPreviewSchema).mutation(async () => {
      try {
        return await merchantPlatformSyncDataAccess.preview()
      } catch (error) {
        throw mapMerchantSyncError(error)
      }
    }),

    commit: adminProcedure.input(merchantSyncCommitSchema).mutation(async ({ input }) => {
      try {
        return await merchantPlatformSyncDataAccess.commit(input.previewId)
      } catch (error) {
        throw mapMerchantSyncError(error)
      }
    }),
  }),

  region: createTRPCRouter({
    list: adminProcedure.input(merchantRegionListSchema).query(async ({ input }) => {
      try {
        return await merchantRegionDataAccess.listByMerchantId(input.merchantId)
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : '加载区域失败',
        })
      }
    }),

    listAvailableDatacenters: adminProcedure
      .input(merchantRegionListSchema)
      .query(async ({ input }) => {
        try {
          return await merchantRegionDataAccess.listAvailableDatacenters(input.merchantId)
        } catch (error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error instanceof Error ? error.message : '加载机房列表失败',
          })
        }
      }),

    create: adminProcedure.input(merchantRegionCreateSchema).mutation(async ({ input, ctx }) => {
      const { merchantId, ...data } = input
      try {
        return await merchantRegionDataAccess.create(merchantId, data, ctx.user)
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : '添加区域失败',
        })
      }
    }),

    updateCardTypes: adminProcedure
      .input(merchantRegionUpdateCardTypesSchema)
      .mutation(async ({ input, ctx }) => {
        const { merchantId, regionId, enabledCardTypeIds } = input
        try {
          return await merchantRegionDataAccess.updateEnabledCardTypes(
            merchantId,
            regionId,
            enabledCardTypeIds,
            ctx.user,
          )
        } catch (error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error instanceof Error ? error.message : '更新卡型配置失败',
          })
        }
      }),
  }),

  pricing: createTRPCRouter({
    list: adminProcedure.input(merchantPricingListSchema).query(async ({ input }) => {
      try {
        return await merchantPricingDataAccess.listByMerchantId(input.merchantId)
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : '加载进货价失败',
        })
      }
    }),

    getRegionForm: adminProcedure
      .input(merchantRegionPricingFormSchema)
      .query(async ({ input }) => {
        try {
          return await merchantPricingDataAccess.getRegionForm(input)
        } catch (error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error instanceof Error ? error.message : '加载区域进货价失败',
          })
        }
      }),

    batchUpsertForRegion: adminProcedure
      .input(merchantRegionPricingBatchUpsertSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          await merchantPricingDataAccess.batchUpsertForRegion(input, ctx.user)
        } catch (error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error instanceof Error ? error.message : '保存进货价失败',
          })
        }
      }),
  }),

  consumption: createTRPCRouter({
    daily: adminProcedure.input(merchantConsumptionDailySchema).query(async ({ input }) => {
      try {
        return await merchantConsumptionDataAccess.getDailyByMerchantId(input.merchantId, {
          usageMonth: input.usageMonth,
          recentDays: input.recentDays,
        })
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : '加载消耗明细失败',
        })
      }
    }),

    summary: adminProcedure.input(merchantConsumptionQuerySchema).query(async ({ input }) => {
      try {
        return await merchantConsumptionDataAccess.getSummary(
          input.merchantId,
          input.usageMonth,
        )
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : '加载消耗概览失败',
        })
      }
    }),

    tenantRank: adminProcedure.input(merchantConsumptionQuerySchema).query(async ({ input }) => {
      try {
        return await merchantConsumptionDataAccess.listTenantRankByMerchantId(
          input.merchantId,
          input.usageMonth,
        )
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : '加载租户消耗排行失败',
        })
      }
    }),
  }),
})
