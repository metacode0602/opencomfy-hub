import { financeBillingPeriodsDataAccess, FinanceError } from '@/lib/server/dataaccess/finance'
import { SLOT_TO_FILE_TYPE } from '@/lib/server/dataaccess/finance/constants'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { adminProcedure, createTRPCRouter, protectedProcedure } from '../trpc'

function mapFinanceError(error: unknown): never {
  if (error instanceof FinanceError) {
    const codeMap = {
      NOT_FOUND: 'NOT_FOUND',
      CONFLICT: 'CONFLICT',
      BAD_REQUEST: 'BAD_REQUEST',
      PRECONDITION_FAILED: 'PRECONDITION_FAILED',
      UNPROCESSABLE: 'UNPROCESSABLE_CONTENT',
    } as const
    throw new TRPCError({
      code: codeMap[error.code] ?? 'INTERNAL_SERVER_ERROR',
      message: error.message,
    })
  }
  throw error
}

const periodCreateSchema = z.object({
  periodCode: z.string().min(1),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const importSchema = z.object({
  billingPeriodId: z.string(),
  slot: z.enum(['customer', 'baremetal', 'tenantBill']),
  fileName: z.string(),
  /** base64 encoded file content */
  fileBase64: z.string().min(1),
})

const allocationItemSchema = z.object({
  tenantPlatformId: z.string(),
  tenantId: z.string(),
  projectId: z.string(),
  allocationPercent: z.string(),
})

export const financeRouter = createTRPCRouter({
  periods: createTRPCRouter({
    list: protectedProcedure.query(async () => {
      try {
        return await financeBillingPeriodsDataAccess.list()
      } catch (e) {
        mapFinanceError(e)
      }
    }),

    getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        try {
          return await financeBillingPeriodsDataAccess.getById(input.id)
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    getBundle: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        try {
          return await financeBillingPeriodsDataAccess.getBundle(input.id)
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    create: adminProcedure.input(periodCreateSchema).mutation(async ({ input }) => {
      try {
        return await financeBillingPeriodsDataAccess.create(input)
      } catch (e) {
        mapFinanceError(e)
      }
    }),

    importFile: adminProcedure.input(importSchema).mutation(async ({ input, ctx }) => {
      try {
        const buffer = Buffer.from(input.fileBase64, 'base64')
        const fileType = SLOT_TO_FILE_TYPE[input.slot]
        return await financeBillingPeriodsDataAccess.importExcelFile({
          billingPeriodId: input.billingPeriodId,
          fileType,
          fileName: input.fileName,
          buffer,
          actorId: ctx.user.id,
        })
      } catch (e) {
        mapFinanceError(e)
      }
    }),

    compute: adminProcedure
      .input(z.object({ billingPeriodId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await financeBillingPeriodsDataAccess.computeBillingPeriod({
            billingPeriodId: input.billingPeriodId,
            actorId: ctx.user.id,
          })
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    saveAllocations: adminProcedure
      .input(
        z.object({
          billingPeriodId: z.string(),
          allocations: z.array(allocationItemSchema),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          await financeBillingPeriodsDataAccess.saveCostAllocations({
            ...input,
            actorId: ctx.user.id,
          })
          return { ok: true }
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    listTenantBindings: protectedProcedure
      .input(z.object({ billingPeriodId: z.string() }))
      .query(async ({ input }) => {
        try {
          return await financeBillingPeriodsDataAccess.listTenantProjectBindings(
            input.billingPeriodId,
          )
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    publish: adminProcedure
      .input(z.object({ billingPeriodId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          await financeBillingPeriodsDataAccess.publish(
            input.billingPeriodId,
            ctx.user.id,
          )
          return { ok: true }
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    unpublish: adminProcedure
      .input(z.object({ billingPeriodId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          await financeBillingPeriodsDataAccess.unpublish(
            input.billingPeriodId,
            ctx.user.id,
          )
          return { ok: true }
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    regenerate: adminProcedure
      .input(z.object({ billingPeriodId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await financeBillingPeriodsDataAccess.regenerate(
            input.billingPeriodId,
            ctx.user.id,
          )
        } catch (e) {
          mapFinanceError(e)
        }
      }),
  }),
})
