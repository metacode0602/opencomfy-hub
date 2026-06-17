import { router, adminProcedure, supplyProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import {
  getFeishuClientPublicConfig,
  loadFeishuRuntimeConfig,
} from '@/lib/server/integrations/feishu/config'
import { retryFeishuWorkOrderForBatch } from '@/lib/server/dataaccess/integrations/feishu/create-batch-work-order'
import { feishuBitableSyncDataAccess } from '@/lib/server/dataaccess/integrations/feishu/bitable-sync-config'
import {
  previewFeishuBitableSync,
  runFeishuBitableSync,
} from '@/lib/server/jobs/feishu-bitable-sync/run-bitable-sync'
import { handleFeishuBitableAutomationInbound } from '@/lib/server/dataaccess/integrations/feishu/bitable-automation-inbound-handler'
import { feishuWorkOrderConfigDataAccess } from '@/lib/server/dataaccess/integrations/feishu/work-order-config'
import { listFeishuBitableFields } from '@/lib/server/integrations/feishu/bitable-client'
import {
  buildFieldIdToNameMap,
  buildWorkOrderBitableRecordFields,
} from '@/lib/server/integrations/feishu/work-order-bitable-mapper'
import { resolveContainerInstanceRegion } from '@/lib/server/integrations/feishu/work-order-content-builder'
import { onboardingBatch } from '@workspace/db/schema'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'

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
  getClientConfig: supplyProcedure.query(async () => {
    const config = loadFeishuRuntimeConfig()
    const woConfig = await feishuWorkOrderConfigDataAccess.getConfig()
    return getFeishuClientPublicConfig(
      config,
      woConfig
        ? {
            enabled: woConfig.enabled,
            workOrderBackend: woConfig.workOrderBackend,
            inboundChannel: woConfig.inboundChannel,
          }
        : null,
    )
  }),

  retryBatchApproval: supplyProcedure
    .input(z.object({ batchId: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const config = loadFeishuRuntimeConfig()
      if (!config?.enabled) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: '飞书集成未配置' })
      }
      return retryFeishuWorkOrderForBatch(input.batchId)
    }),

  workOrder: router({
    getConfig: supplyProcedure.query(() => feishuWorkOrderConfigDataAccess.getConfig()),

    upsertConfig: adminProcedure
      .input(
        z.object({
          appToken: z.string().min(1),
          tableId: z.string().min(1),
          viewId: z.string().optional().nullable(),
          workOrderBackend: z.enum(['bitable', 'approval']).optional(),
          fieldMappingJson: z.record(z.string(), z.string()),
          defaultsJson: z.object({
            module: z.string().optional(),
            priority: z.string().optional(),
            category: z.string().optional(),
            initial_status: z.string().optional(),
            assignee_open_ids: z.array(z.string()).optional(),
          }),
          inboundChannel: z.enum(['event_subscription', 'bitable_automation', 'dual']).optional(),
          automationWebhookSecret: z.string().optional().nullable(),
          automationToken: z.string().optional().nullable(),
          inboundPolicyJson: z
            .object({
              timeline_on_every_sync: z.boolean().optional(),
              timeline_on_terminal_only: z.boolean().optional(),
              auto_sync_in_progress_status: z.boolean().optional(),
              dedupe_window_seconds: z.number().int().min(1).max(3600).optional(),
            })
            .optional(),
          enabled: z.boolean().optional(),
        }),
      )
      .mutation(({ input }) => feishuWorkOrderConfigDataAccess.upsertConfig(input)),

    previewAutomationInbound: adminProcedure
      .input(
        z.object({
          payload: z.object({
            record_id: z.string().min(1),
            ticket_no: z.string().optional(),
            work_order_status: z.string().min(1),
            previous_status: z.string().optional(),
            occurred_at: z.string().optional(),
            idempotency_key: z.string().optional(),
            fields: z.record(z.string(), z.unknown()),
          }),
          dryRun: z.boolean().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        if (input.dryRun) {
          const woConfig = await feishuWorkOrderConfigDataAccess.getConfig()
          return {
            ok: true,
            dryRun: true,
            inboundChannel: woConfig?.inboundChannel ?? null,
          }
        }
        const result = await handleFeishuBitableAutomationInbound(input.payload)
        return result
      }),

    listTableFields: adminProcedure
      .input(z.object({ appToken: z.string().min(1), tableId: z.string().min(1) }))
      .mutation(({ input }) => feishuWorkOrderConfigDataAccess.listTableFields(input)),

    previewPayload: adminProcedure
      .input(z.object({ batchId: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const woConfig = await feishuWorkOrderConfigDataAccess.getConfig()
        if (!woConfig) {
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: '请先保存工单映射配置' })
        }
        const runtime = loadFeishuRuntimeConfig()
        const [batch] = await db
          .select()
          .from(onboardingBatch)
          .where(eq(onboardingBatch.id, input.batchId))
          .limit(1)
        if (!batch) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '批次不存在' })
        }
        if (!runtime?.enabled) {
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message: '飞书集成未配置' })
        }
        const bitableFields = await listFeishuBitableFields(
          runtime,
          woConfig.appToken,
          woConfig.tableId,
        )
        const fieldIdToName = buildFieldIdToNameMap(
          bitableFields.map((field) => ({ fieldId: field.field_id, fieldName: field.field_name })),
        )
        const containerInstanceRegion = await resolveContainerInstanceRegion(batch.dataCenterId)
        const fields = buildWorkOrderBitableRecordFields({
          batch,
          mapping: woConfig.fieldMappingJson,
          defaults: woConfig.defaultsJson,
          submitterOpenId: runtime.defaultUserOpenId ?? null,
          appBaseUrl: runtime.appBaseUrl,
          fieldIdToName,
          containerInstanceRegion,
        })
        return { fields, batchCode: batch.batchCode }
      }),
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
