import { staffDataAccess } from '@/lib/server/dataaccess/crm/staff'
import {
  commissionDeriveDataAccess,
  derivePlatformCostCommissionPhase,
  financeBillingPeriodsDataAccess,
  financePersonalIncomeDataAccess,
  FinanceError,
} from '@/lib/server/dataaccess/finance'
import { SLOT_TO_FILE_TYPE } from '@/lib/server/dataaccess/finance/constants'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { adminProcedure, createTRPCRouter } from '../trpc'

async function resolveFinanceActorId(user: { id: string; email?: string | null }) {
  return staffDataAccess.resolveStaffIdForAuthUser(user)
}

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
  periodCode: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, '账期编码格式应为 YYYY-MM'),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ignoreListPriceWindows: z.boolean().optional().default(false),
})

const importSchema = z.object({
  billingPeriodId: z.string(),
  slot: z.enum([
    'customer',
    'baremetal',
    'tenantBill',
    'personalTenantBill',
    'personalBaremetal',
  ]),
  fileName: z.string(),
  /** base64 encoded file content */
  fileBase64: z.string().min(1),
  windowId: z.string().optional(),
  preserveIncomeDerived: z.boolean().optional(),
})

const allocationItemSchema = z.object({
  tenantPlatformId: z.string(),
  tenantId: z.string(),
  projectId: z.string(),
  allocationPercent: z.string(),
})

export const financeRouter = createTRPCRouter({
  periods: createTRPCRouter({
    list: adminProcedure.query(async () => {
      try {
        return await financeBillingPeriodsDataAccess.list()
      } catch (e) {
        mapFinanceError(e)
      }
    }),

    getById: adminProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        try {
          return await financeBillingPeriodsDataAccess.getById(input.id)
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    getBundle: adminProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        try {
          return await financeBillingPeriodsDataAccess.getBundle(input.id)
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    listCostSourceLines: adminProcedure
      .input(z.object({ billingPeriodId: z.string() }))
      .query(async ({ input }) => {
        try {
          return await financeBillingPeriodsDataAccess.listCostSourceLines(
            input.billingPeriodId,
          )
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    listProjectCostMetadata: adminProcedure
      .input(
        z.object({
          tenantPlatformIds: z.array(z.string()).max(2000),
          settlementMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
        }),
      )
      .query(async ({ input }) => {
        try {
          return await financeBillingPeriodsDataAccess.listProjectCostMetadata(input)
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    saveProjectCostSnapshots: adminProcedure
      .input(
        z.object({
          billingPeriodId: z.string(),
          tenantPlatformIds: z.array(z.string()).max(2000).optional(),
          allProjects: z.boolean().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const savedByStaffId = await resolveFinanceActorId(ctx.user)
          return await financeBillingPeriodsDataAccess.saveProjectCostSnapshots({
            ...input,
            savedByStaffId,
          })
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    listImportTenantBindings: adminProcedure
      .input(
        z.object({
          billingPeriodId: z.string(),
          tenantType: z.enum(['all', 'internal', 'external']).optional(),
          customerType: z.enum(['all', 'B', 'C']).optional(),
          staffId: z.string().optional(),
          department: z.string().optional(),
          projectLinked: z.enum(['all', 'with_project', 'without_project']).optional(),
        }),
      )
      .query(async ({ input }) => {
        try {
          const { billingPeriodId, ...filters } = input
          return await financeBillingPeriodsDataAccess.listImportTenantBindings(
            billingPeriodId,
            filters,
          )
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
        const actorId = await resolveFinanceActorId(ctx.user)
        return await financeBillingPeriodsDataAccess.importExcelFile({
          billingPeriodId: input.billingPeriodId,
          fileType,
          fileName: input.fileName,
          buffer,
          actorId,
          windowId: input.windowId,
          preserveIncomeDerived: input.preserveIncomeDerived,
        })
      } catch (e) {
        mapFinanceError(e)
      }
    }),

    computeIncome: adminProcedure
      .input(z.object({ billingPeriodId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const actorId = await resolveFinanceActorId(ctx.user)
          return await financeBillingPeriodsDataAccess.computeBillingPeriodIncome({
            billingPeriodId: input.billingPeriodId,
            actorId,
          })
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    validateSingleIncome: adminProcedure
      .input(z.object({ billingPeriodId: z.string() }))
      .query(async ({ input }) => {
        try {
          return await financeBillingPeriodsDataAccess.validateSingleIncome(
            input.billingPeriodId,
          )
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    previewSingleIncome: adminProcedure
      .input(z.object({ billingPeriodId: z.string() }))
      .query(async ({ input }) => {
        try {
          return await financeBillingPeriodsDataAccess.previewSinglePeriodIncome(
            input.billingPeriodId,
          )
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    computeSingleIncome: adminProcedure
      .input(z.object({ billingPeriodId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const actorId = await resolveFinanceActorId(ctx.user)
          return await financeBillingPeriodsDataAccess.computeSinglePeriodIncome({
            billingPeriodId: input.billingPeriodId,
            actorId,
          })
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    computeCost: adminProcedure
      .input(z.object({ billingPeriodId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const actorId = await resolveFinanceActorId(ctx.user)
          return await financeBillingPeriodsDataAccess.computeBillingPeriodCost({
            billingPeriodId: input.billingPeriodId,
            actorId,
          })
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    prepareRegenerateCost: adminProcedure
      .input(z.object({ billingPeriodId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const actorId = await resolveFinanceActorId(ctx.user)
          return await financeBillingPeriodsDataAccess.prepareRegenerateCost(
            input.billingPeriodId,
            actorId,
          )
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    regenerateCost: adminProcedure
      .input(z.object({ billingPeriodId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const actorId = await resolveFinanceActorId(ctx.user)
          return await financeBillingPeriodsDataAccess.regenerateCost({
            billingPeriodId: input.billingPeriodId,
            actorId,
          })
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    previewBaremetalFromDb: adminProcedure
      .input(z.object({ billingPeriodId: z.string() }))
      .query(async ({ input }) => {
        try {
          return await financeBillingPeriodsDataAccess.previewBaremetalFromDb(
            input.billingPeriodId,
          )
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    importBaremetalFromDb: adminProcedure
      .input(
        z.object({
          billingPeriodId: z.string(),
          preserveIncomeDerived: z.boolean().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const actorId = await resolveFinanceActorId(ctx.user)
          return await financeBillingPeriodsDataAccess.importBaremetalFromDb({
            billingPeriodId: input.billingPeriodId,
            actorId,
            preserveIncomeDerived: input.preserveIncomeDerived,
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
          const actorId = await resolveFinanceActorId(ctx.user)
          await financeBillingPeriodsDataAccess.saveCostAllocations({
            ...input,
            actorId,
          })
          return { ok: true }
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    listTenantBindings: adminProcedure
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
          const actorId = await resolveFinanceActorId(ctx.user)
          await financeBillingPeriodsDataAccess.publish(input.billingPeriodId, actorId)
          return { ok: true }
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    unpublish: adminProcedure
      .input(z.object({ billingPeriodId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const actorId = await resolveFinanceActorId(ctx.user)
          await financeBillingPeriodsDataAccess.unpublish(input.billingPeriodId, actorId)
          return { ok: true }
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    regenerate: adminProcedure
      .input(z.object({ billingPeriodId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const actorId = await resolveFinanceActorId(ctx.user)
          return await financeBillingPeriodsDataAccess.regenerate(
            input.billingPeriodId,
            actorId,
          )
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    void: adminProcedure
      .input(z.object({ billingPeriodId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const actorId = await resolveFinanceActorId(ctx.user)
          return await financeBillingPeriodsDataAccess.voidPeriod(
            input.billingPeriodId,
            actorId,
          )
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    detectPriceWindows: adminProcedure
      .input(
        z.object({
          periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        }),
      )
      .query(async ({ input }) => {
        try {
          return await financeBillingPeriodsDataAccess.detectPriceWindows(input)
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    validate: adminProcedure
      .input(
        z.object({
          billingPeriodId: z.string(),
          costMode: z.enum(['create', 'regenerate']).optional(),
        }),
      )
      .query(async ({ input }) => {
        try {
          return await financeBillingPeriodsDataAccess.validatePeriod(
            input.billingPeriodId,
            { costMode: input.costMode },
          )
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    downloadImportErrorReport: adminProcedure
      .input(
        z.object({
          billingPeriodId: z.string(),
          slot: z.enum([
            'customer',
            'baremetal',
            'tenantBill',
            'personalTenantBill',
            'personalBaremetal',
          ]),
          windowId: z.string().optional(),
        }),
      )
      .query(async ({ input }) => {
        try {
          return await financeBillingPeriodsDataAccess.downloadImportErrorReport(input)
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    applyBalanceCardHoursAdjustment: adminProcedure
      .input(
        z.object({
          costId: z.string(),
          adjustmentHours: z.number(),
          reason: z.string().min(1),
          unitPricePerHour: z.number().positive().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const actorId = await resolveFinanceActorId(ctx.user)
          return await financeBillingPeriodsDataAccess.applyBalanceCardHoursAdjustment(
            {
              ...input,
              actorId,
            },
          )
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    saveSupplementary: adminProcedure
      .input(
        z.object({
          billingPeriodId: z.string(),
          items: z.array(
            z.object({
              incomeRowId: z.string(),
              supplementaryConsumption: z.string(),
            }),
          ),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const actorId = await resolveFinanceActorId(ctx.user)
          await financeBillingPeriodsDataAccess.saveSupplementary({
            ...input,
            actorId,
          })
          return { ok: true }
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    getPersonalBundle: adminProcedure
      .input(z.object({ billingPeriodId: z.string() }))
      .query(async ({ input }) => {
        try {
          return await financePersonalIncomeDataAccess.getPersonalBundle(
            input.billingPeriodId,
          )
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    validatePersonalIncome: adminProcedure
      .input(z.object({ billingPeriodId: z.string() }))
      .query(async ({ input }) => {
        try {
          return await financePersonalIncomeDataAccess.validatePersonalIncome(
            input.billingPeriodId,
          )
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    computePersonalIncome: adminProcedure
      .input(z.object({ billingPeriodId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const actorId = await resolveFinanceActorId(ctx.user)
          return await financePersonalIncomeDataAccess.computePersonalIncome({
            billingPeriodId: input.billingPeriodId,
            actorId,
          })
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    purgePersonalIncome: adminProcedure
      .input(z.object({ billingPeriodId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const actorId = await resolveFinanceActorId(ctx.user)
          return await financePersonalIncomeDataAccess.purgePersonalIncome(
            input.billingPeriodId,
            actorId,
          )
        } catch (e) {
          mapFinanceError(e)
        }
      }),
  }),

  commissionDerive: createTRPCRouter({
    run: adminProcedure
      .input(z.object({ billingPeriodId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const actorId = await resolveFinanceActorId(ctx.user)
          return await derivePlatformCostCommissionPhase({
            billingPeriodId: input.billingPeriodId,
            actorId,
          })
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    getByPeriod: adminProcedure
      .input(z.object({ billingPeriodId: z.string() }))
      .query(async ({ input }) => {
        try {
          return await commissionDeriveDataAccess.getByPeriod(input.billingPeriodId)
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    getAmPhaseSummary: adminProcedure
      .input(
        z.object({
          billingPeriodId: z.string(),
          staffId: z.string().optional(),
        }),
      )
      .query(async ({ input }) => {
        try {
          return await commissionDeriveDataAccess.getAmPhaseSummary(
            input.billingPeriodId,
            input.staffId,
          )
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    getDeptPhaseSummary: adminProcedure
      .input(
        z.object({
          billingPeriodId: z.string(),
          dept: z.enum(['市场', '中台']),
        }),
      )
      .query(async ({ input }) => {
        try {
          return await commissionDeriveDataAccess.getDeptPhaseSummary(
            input.billingPeriodId,
            input.dept,
          )
        } catch (e) {
          mapFinanceError(e)
        }
      }),

    listProjectLines: adminProcedure
      .input(
        z.object({
          billingPeriodId: z.string(),
          projectId: z.string().optional(),
        }),
      )
      .query(async ({ input }) => {
        try {
          return await commissionDeriveDataAccess.listProjectLines(
            input.billingPeriodId,
            input.projectId,
          )
        } catch (e) {
          mapFinanceError(e)
        }
      }),
  }),
})
