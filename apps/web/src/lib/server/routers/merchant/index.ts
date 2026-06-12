import { TRPCError } from '@trpc/server'
import { assertMerchantInScope } from '@/lib/server/auth/merchant-data-scope'
import { merchantActivityDataAccess } from '@/lib/server/dataaccess/merchant/merchant-activity'
import { merchantAccountManagerDataAccess } from '@/lib/server/dataaccess/merchant/merchant-account-manager'
import { merchantContactsDataAccess } from '@/lib/server/dataaccess/merchant/merchant-contacts'
import { merchantDataAccess } from '@/lib/server/dataaccess/merchant/merchant'
import { merchantConsumptionDataAccess } from '@/lib/server/dataaccess/merchant/merchant-consumption'
import { merchantPlatformSyncDataAccess } from '@/lib/server/dataaccess/merchant/merchant-platform-sync'
import { merchantPricingDataAccess } from '@/lib/server/dataaccess/merchant/merchant-pricing'
import { merchantRechargeDataAccess } from '@/lib/server/dataaccess/merchant/merchant-recharge'
import { merchantRegionDataAccess } from '@/lib/server/dataaccess/merchant/merchant-region'
import {
  resolveMerchantIdForContact,
  resolveMerchantIdForRecharge,
} from '@/lib/server/dataaccess/merchant/merchant-scope-helpers'
import { staffDataAccess } from '@/lib/server/dataaccess/crm/staff'
import { SuanliMerchantOpenApiError } from '@/lib/server/integrations/suanli-merchant-api'
import {
  adminProcedure,
  createTRPCRouter,
  merchantScopedProcedure,
  merchantWriteProcedure,
} from '../trpc'
import {
  merchantActivityCreateSchema,
  merchantActivityListSchema,
  merchantChangeAccountManagerSchema,
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
import {
  entityContactDeleteSchema,
  entityContactSetPrimarySchema,
  entityContactUpdateSchema,
  merchantContactCreateSchema,
  merchantContactListSchema,
} from '../shared/entity-contact-schemas'

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
  list: merchantScopedProcedure.input(merchantListSchema.optional()).query(async ({ input, ctx }) => {
    return merchantDataAccess.list(ctx.merchantScope, input)
  }),

  getById: merchantScopedProcedure.input(merchantIdSchema).query(async ({ input, ctx }) => {
    const row = await merchantDataAccess.getById(ctx.merchantScope, input.id)
    if (!row) {
      throw new TRPCError({ code: 'NOT_FOUND', message: '商户不存在' })
    }
    return row
  }),

  listAccountManagerFilterOptions: adminProcedure.query(async ({ ctx }) => {
    const [staff, currentUserStaffId] = await Promise.all([
      merchantAccountManagerDataAccess.listAccountManagerFilterOptions(),
      staffDataAccess.resolveStaffIdForAuthUser(ctx.user),
    ])
    return { staff, currentUserStaffId }
  }),

  getAccountManagerAssignment: merchantScopedProcedure
    .input(merchantIdSchema)
    .query(async ({ input, ctx }) => {
      await assertMerchantInScope(ctx.merchantScope, input.id)
      return merchantDataAccess.getAccountManager(input.id)
    }),

  changeAccountManager: adminProcedure
    .input(merchantChangeAccountManagerSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const createdByStaffId = await staffDataAccess.resolveStaffIdForAuthUser(ctx.user)
        await merchantAccountManagerDataAccess.change({
          merchantId: input.merchantId,
          staffId: input.staffId,
          effectiveFrom: input.effectiveFrom,
          remark: input.remark,
          createdByStaffId,
        })
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : '设置客户经理失败',
        })
      }
    }),

  update: merchantWriteProcedure.input(merchantUpdateSchema).mutation(async ({ input, ctx }) => {
    const { id, ...data } = input
    await assertMerchantInScope(ctx.merchantScope, id)
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
    list: merchantScopedProcedure.input(merchantIdSchema).query(async ({ input, ctx }) => {
      await assertMerchantInScope(ctx.merchantScope, input.id)
      return merchantDataAccess.listTenantsByMerchantId(input.id)
    }),
  }),

  activity: createTRPCRouter({
    list: merchantScopedProcedure.input(merchantActivityListSchema).query(async ({ input, ctx }) => {
      await assertMerchantInScope(ctx.merchantScope, input.merchantId)
      return merchantActivityDataAccess.listByMerchantId(input)
    }),

    createComment: merchantWriteProcedure
      .input(merchantActivityCreateSchema)
      .mutation(async ({ input, ctx }) => {
        await assertMerchantInScope(ctx.merchantScope, input.merchantId)
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
    list: merchantScopedProcedure.input(merchantRechargeListSchema).query(async ({ input, ctx }) => {
      await assertMerchantInScope(ctx.merchantScope, input.merchantId)
      return merchantRechargeDataAccess.listByMerchantId(input.merchantId)
    }),

    create: merchantWriteProcedure.input(merchantRechargeCreateSchema).mutation(async ({ input, ctx }) => {
      const { merchantId, files, ...data } = input
      await assertMerchantInScope(ctx.merchantScope, merchantId)
      try {
        return await merchantRechargeDataAccess.create(merchantId, { ...data, files }, ctx.user)
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : '创建失败',
        })
      }
    }),

    update: merchantWriteProcedure.input(merchantRechargeUpdateSchema).mutation(async ({ input, ctx }) => {
      const { rechargeId, files, keepAttachmentIds, ...data } = input
      const merchantId = await resolveMerchantIdForRecharge(rechargeId)
      if (!merchantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '充值记录不存在' })
      }
      await assertMerchantInScope(ctx.merchantScope, merchantId)
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

    auditList: merchantScopedProcedure.input(merchantRechargeAuditSchema).query(async ({ input, ctx }) => {
      if (input.rechargeId) {
        const merchantId = await resolveMerchantIdForRecharge(input.rechargeId)
        if (!merchantId) return []
        await assertMerchantInScope(ctx.merchantScope, merchantId)
        return merchantRechargeDataAccess.listAuditByRechargeId(input.rechargeId)
      }
      if (input.merchantId) {
        await assertMerchantInScope(ctx.merchantScope, input.merchantId)
        return merchantRechargeDataAccess.listAuditByMerchantId(input.merchantId, input.limit ?? 20)
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
    list: merchantScopedProcedure.input(merchantRegionListSchema).query(async ({ input, ctx }) => {
      await assertMerchantInScope(ctx.merchantScope, input.merchantId)
      try {
        return await merchantRegionDataAccess.listByMerchantId(input.merchantId)
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : '加载区域失败',
        })
      }
    }),

    listAvailableDatacenters: merchantScopedProcedure
      .input(merchantRegionListSchema)
      .query(async ({ input, ctx }) => {
        await assertMerchantInScope(ctx.merchantScope, input.merchantId)
        try {
          return await merchantRegionDataAccess.listAvailableDatacenters(input.merchantId)
        } catch (error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error instanceof Error ? error.message : '加载机房列表失败',
          })
        }
      }),

    create: merchantWriteProcedure.input(merchantRegionCreateSchema).mutation(async ({ input, ctx }) => {
      const { merchantId, ...data } = input
      await assertMerchantInScope(ctx.merchantScope, merchantId)
      try {
        return await merchantRegionDataAccess.create(merchantId, data, ctx.user)
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : '添加区域失败',
        })
      }
    }),

    updateCardTypes: merchantWriteProcedure
      .input(merchantRegionUpdateCardTypesSchema)
      .mutation(async ({ input, ctx }) => {
        const { merchantId, regionId, enabledCardTypeIds } = input
        await assertMerchantInScope(ctx.merchantScope, merchantId)
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
    list: merchantScopedProcedure.input(merchantPricingListSchema).query(async ({ input, ctx }) => {
      await assertMerchantInScope(ctx.merchantScope, input.merchantId)
      try {
        return await merchantPricingDataAccess.listByMerchantId(input.merchantId)
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : '加载进货价失败',
        })
      }
    }),

    getRegionForm: merchantScopedProcedure
      .input(merchantRegionPricingFormSchema)
      .query(async ({ input, ctx }) => {
        await assertMerchantInScope(ctx.merchantScope, input.merchantId)
        try {
          return await merchantPricingDataAccess.getRegionForm(input)
        } catch (error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error instanceof Error ? error.message : '加载区域进货价失败',
          })
        }
      }),

    batchUpsertForRegion: merchantWriteProcedure
      .input(merchantRegionPricingBatchUpsertSchema)
      .mutation(async ({ input, ctx }) => {
        await assertMerchantInScope(ctx.merchantScope, input.merchantId)
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
    daily: merchantScopedProcedure.input(merchantConsumptionDailySchema).query(async ({ input, ctx }) => {
      await assertMerchantInScope(ctx.merchantScope, input.merchantId)
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

    summary: merchantScopedProcedure.input(merchantConsumptionQuerySchema).query(async ({ input, ctx }) => {
      await assertMerchantInScope(ctx.merchantScope, input.merchantId)
      try {
        return await merchantConsumptionDataAccess.getSummary(input.merchantId, input.usageMonth)
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : '加载消耗概览失败',
        })
      }
    }),

    tenantRank: merchantScopedProcedure.input(merchantConsumptionQuerySchema).query(async ({ input, ctx }) => {
      await assertMerchantInScope(ctx.merchantScope, input.merchantId)
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

  contacts: createTRPCRouter({
    list: merchantScopedProcedure.input(merchantContactListSchema).query(async ({ input, ctx }) => {
      await assertMerchantInScope(ctx.merchantScope, input.merchantId)
      return merchantContactsDataAccess.list(input.merchantId)
    }),
    create: merchantWriteProcedure.input(merchantContactCreateSchema).mutation(async ({ input, ctx }) => {
      const { merchantId, ...data } = input
      await assertMerchantInScope(ctx.merchantScope, merchantId)
      try {
        return await merchantContactsDataAccess.create({ merchantId, data })
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : '创建失败',
        })
      }
    }),
    update: merchantWriteProcedure.input(entityContactUpdateSchema).mutation(async ({ input, ctx }) => {
      const merchantId = await resolveMerchantIdForContact(input.id)
      if (!merchantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '联系人不存在' })
      }
      await assertMerchantInScope(ctx.merchantScope, merchantId)
      try {
        return await merchantContactsDataAccess.update(input)
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : '更新失败',
        })
      }
    }),
    delete: merchantWriteProcedure.input(entityContactDeleteSchema).mutation(async ({ input, ctx }) => {
      const merchantId = await resolveMerchantIdForContact(input.id)
      if (!merchantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '联系人不存在' })
      }
      await assertMerchantInScope(ctx.merchantScope, merchantId)
      try {
        return await merchantContactsDataAccess.delete(input)
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : '删除失败',
        })
      }
    }),
    setPrimary: merchantWriteProcedure.input(entityContactSetPrimarySchema).mutation(async ({ input, ctx }) => {
      const merchantId = await resolveMerchantIdForContact(input.id)
      if (!merchantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '联系人不存在' })
      }
      await assertMerchantInScope(ctx.merchantScope, merchantId)
      try {
        return await merchantContactsDataAccess.setPrimary(input)
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : '设置主联系人失败',
        })
      }
    }),
  }),
})
