import { router, adminProcedure, supplyProcedure } from '../trpc'
import { z } from 'zod'
import {
  getFeishuClientPublicConfig,
  loadFeishuRuntimeConfig,
} from '@/lib/server/integrations/feishu/config'
import { retryFeishuApprovalForBatch } from '@/lib/server/dataaccess/integrations/feishu/create-batch-approval'
import { feishuBitableSyncDataAccess } from '@/lib/server/dataaccess/integrations/feishu/bitable-sync-config'
import {
  previewFeishuBitableSync,
  runFeishuBitableSync,
} from '@/lib/server/jobs/feishu-bitable-sync/run-bitable-sync'
import { TRPCError } from '@trpc/server'

const syncKindSchema = z.enum(['device_inventory', 'device_changelog'])

const fieldMappingSchema = z.record(z.string(), z.string())

const upsertBitableSyncConfigSchema = z.object({
  id: z.string().optional(),
  supplierId: z.string().min(1),
  dataCenterId: z.string().min(1),
  syncKind: syncKindSchema,
  appToken: z.string().min(1),
  tableId: z.string().min(1),
  viewId: z.string().optional().nullable(),
  fieldMappingJson: fieldMappingSchema,
  filterFormula: z.string().optional().nullable(),
  cronExpr: z.string().optional(),
  autoCommit: z.boolean().optional(),
  enabled: z.boolean().optional(),
})

export const integrationFeishuRouter = router({
  getClientConfig: supplyProcedure.query(() => {
    const config = loadFeishuRuntimeConfig()
    return getFeishuClientPublicConfig(config)
  }),

  retryBatchApproval: supplyProcedure
    .input(z.object({ batchId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const config = loadFeishuRuntimeConfig()
      if (!config?.enabled) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: '飞书集成未配置' })
      }
      return retryFeishuApprovalForBatch(input.batchId)
    }),

  bitableSync: router({
    listConfigs: supplyProcedure
      .input(
        z
          .object({
            supplierId: z.string().optional(),
            dataCenterId: z.string().optional(),
          })
          .optional(),
      )
      .query(({ input }) => feishuBitableSyncDataAccess.listConfigs(input)),

    getConfig: supplyProcedure
      .input(z.object({ id: z.string().min(1) }))
      .query(async ({ input }) => {
        const config = await feishuBitableSyncDataAccess.getConfig(input.id)
        if (!config) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '同步配置不存在' })
        }
        return config
      }),

    upsertConfig: adminProcedure
      .input(upsertBitableSyncConfigSchema)
      .mutation(({ input }) => feishuBitableSyncDataAccess.upsertConfig(input)),

    deleteConfig: adminProcedure
      .input(z.object({ id: z.string().min(1) }))
      .mutation(({ input }) => feishuBitableSyncDataAccess.deleteConfig(input.id)),

    listTableFields: adminProcedure
      .input(
        z.object({
          appToken: z.string().min(1),
          tableId: z.string().min(1),
          syncKind: syncKindSchema,
        }),
      )
      .mutation(({ input }) => feishuBitableSyncDataAccess.listBitableTableFields(input)),

    preview: adminProcedure
      .input(z.object({ configId: z.string().min(1) }))
      .mutation(({ input }) => previewFeishuBitableSync(input.configId)),

    runNow: adminProcedure
      .input(
        z.object({
          configId: z.string().min(1),
          forceFullSync: z.boolean().optional(),
        }),
      )
      .mutation(({ input }) =>
        runFeishuBitableSync({
          configId: input.configId,
          trigger: 'manual',
          forceFullSync: input.forceFullSync,
        }),
      ),

    listJobRuns: supplyProcedure
      .input(
        z
          .object({
            configId: z.string().optional(),
            limit: z.number().int().min(1).max(100).optional(),
            offset: z.number().int().min(0).optional(),
          })
          .optional(),
      )
      .query(({ input }) => feishuBitableSyncDataAccess.listJobRuns(input)),
  }),
})
