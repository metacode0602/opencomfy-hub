import { createTRPCRouter, protectedProcedure, adminProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { customersDataAccess } from '@/lib/server/dataaccess/crm/customers'
import { projectsDataAccess } from '@/lib/server/dataaccess/crm/projects'
import { staffDataAccess } from '@/lib/server/dataaccess/crm/staff'
import { contractsDataAccess } from '@/lib/server/dataaccess/crm/contracts'
import { billingDataAccess } from '@/lib/server/dataaccess/crm/billing'
import { dashboardDataAccess } from '@/lib/server/dataaccess/crm/dashboard'
import { calendarDataAccess } from '@/lib/server/dataaccess/crm/calendar'
import { businessLinesDataAccess } from '@/lib/server/dataaccess/crm/business-lines'
import { projectTagsDataAccess } from '@/lib/server/dataaccess/crm/project-tags'
import { billingTenantsDataAccess } from '@/lib/server/dataaccess/crm/billing-tenants'
import { tenantBillingListsDataAccess } from '@/lib/server/dataaccess/crm/tenant-billing-lists'
import { platformTenantImportDataAccess } from '@/lib/server/dataaccess/crm/platform-tenant-import'
import { tenantProjectImportDataAccess } from '@/lib/server/dataaccess/crm/tenant-project-import'
import {
  SuanliBillingApiError,
  tenantBillingImportDataAccess,
} from '@/lib/server/dataaccess/crm/tenant-billing-import'
import { SuanliOpenApiError } from '@/lib/server/integrations/suanli-tenant-api'
import { PLATFORM_TENANT_IMPORT_MAX_IDS } from '@/lib/crm/platform-tenant-import-utils'
import {
  billingTenantUpdateSchema,
  customerUpsertSchema,
  platformImportCommitItemSchema,
  projectUpsertSchema,
  staffUpsertSchema,
  staffListSchema,
  tenantProjectImportFormSchema,
} from './schemas'

function mapPlatformImportError(e: unknown): never {
  if (e instanceof SuanliOpenApiError) {
    throw new TRPCError({
      code: e.code === '401' || e.code === '403' ? 'UNAUTHORIZED' : 'BAD_REQUEST',
      message: e.message,
    })
  }
  if (e instanceof Error) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: e.message })
  }
  throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '平台租户导入失败' })
}

function mapBillingImportError(e: unknown): never {
  if (e instanceof SuanliBillingApiError) {
    throw new TRPCError({
      code: e.code === '401' || e.code === '403' ? 'UNAUTHORIZED' : 'BAD_REQUEST',
      message: e.message,
    })
  }
  if (e instanceof Error) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: e.message })
  }
  throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '账单同步失败' })
}

const billingImportDateSchema = z.object({
  tenantId: z.string().min(1),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

const listFilterSchema = z.object({
  search: z.string().optional(),
  type: z.enum(['B', 'C', 'all']).optional(),
  status: z.string().optional(),
})

const projectFilterSchema = z.object({
  search: z.string().optional(),
  stage: z.string().optional(),
  status: z.string().optional(),
})

export const crmRouter = createTRPCRouter({
  customers: createTRPCRouter({
    list: protectedProcedure.input(listFilterSchema.optional()).query(({ input }) =>
      customersDataAccess.list(input),
    ),
    getById: protectedProcedure.input(z.object({ id: z.string() })).query(({ input }) =>
      customersDataAccess.getById(input.id),
    ),
    create: adminProcedure.input(customerUpsertSchema).mutation(({ input }) =>
      customersDataAccess.create(input),
    ),
    update: adminProcedure
      .input(z.object({ id: z.string(), data: customerUpsertSchema }))
      .mutation(({ input }) => customersDataAccess.update(input.id, input.data)),
    listProjects: protectedProcedure
      .input(z.object({ customerId: z.string() }))
      .query(({ input }) => projectsDataAccess.listByCustomerId(input.customerId)),
    listRecharges: protectedProcedure
      .input(z.object({ customerId: z.string() }))
      .query(({ input }) => billingDataAccess.listRechargesByCustomer(input.customerId)),
    listConsumptions: protectedProcedure
      .input(z.object({ customerId: z.string() }))
      .query(({ input }) => billingDataAccess.listConsumptionsByCustomer(input.customerId)),
    listCoupons: protectedProcedure
      .input(z.object({ customerId: z.string() }))
      .query(({ input }) => billingDataAccess.listCouponsByCustomer(input.customerId)),
    listContracts: protectedProcedure
      .input(z.object({ customerId: z.string() }))
      .query(({ input }) => contractsDataAccess.listByCustomerId(input.customerId)),
    listTenants: protectedProcedure
      .input(z.object({ customerId: z.string() }))
      .query(({ input }) => billingDataAccess.listTenantsByCustomer(input.customerId)),
  }),

  projects: createTRPCRouter({
    list: protectedProcedure.input(projectFilterSchema.optional()).query(({ input }) =>
      projectsDataAccess.list(input),
    ),
    getById: protectedProcedure.input(z.object({ id: z.string() })).query(({ input }) =>
      projectsDataAccess.getById(input.id),
    ),
    create: adminProcedure.input(projectUpsertSchema).mutation(({ input }) =>
      projectsDataAccess.create(input),
    ),
    update: adminProcedure
      .input(z.object({ id: z.string(), data: projectUpsertSchema }))
      .mutation(({ input }) => projectsDataAccess.update(input.id, input.data)),
    updateStage: adminProcedure
      .input(z.object({ id: z.string(), stage: z.enum(['lead', 'testing', 'converted']) }))
      .mutation(({ input }) => projectsDataAccess.updateStage(input.id, input.stage)),
    stageCounts: protectedProcedure.query(() => projectsDataAccess.countByStage()),
    listActivities: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(({ input }) => billingDataAccess.listActivitiesByProject(input.projectId)),
    listConsumptions: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(({ input }) => billingDataAccess.listConsumptionsByProject(input.projectId)),
    listDailyConsumptions: protectedProcedure
      .input(
        z.object({
          projectId: z.string(),
          productLine: z.string().optional(),
        }),
      )
      .query(({ input }) =>
        billingDataAccess.listDailyConsumptionsByProject(input.projectId, {
          productLine: input.productLine,
        }),
      ),
    listTasks: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(({ input }) => billingDataAccess.listTasksByProject(input.projectId)),
    listOrders: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(({ input }) => billingDataAccess.listOrdersByProject(input.projectId)),
    listCoupons: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(({ input }) => billingDataAccess.listCouponsByProject(input.projectId)),
    listRecharges: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(({ input }) => billingDataAccess.listRechargesByProject(input.projectId)),
    listBills: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(({ input }) => billingDataAccess.listBillsByProject(input.projectId)),
    previewTenantProjectImport: adminProcedure
      .input(
        z.object({
          rawTenantIds: z.string(),
          form: tenantProjectImportFormSchema,
        }),
      )
      .mutation(async ({ input }) => {
        try {
          return await tenantProjectImportDataAccess.preview(input)
        } catch (e) {
          mapPlatformImportError(e)
        }
      }),
    commitTenantProjectImport: adminProcedure
      .input(z.object({ previewId: z.string().uuid() }))
      .mutation(async ({ input }) => {
        try {
          return await tenantProjectImportDataAccess.commit(input.previewId)
        } catch (e) {
          if (e instanceof Error) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: e.message })
          }
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '导入租户项目失败' })
        }
      }),
  }),

  tenants: createTRPCRouter({
    list: protectedProcedure
      .input(z.object({ search: z.string().optional() }).optional())
      .query(({ input }) => billingTenantsDataAccess.list(input)),
    getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(({ input }) => billingTenantsDataAccess.getById(input.id)),
    update: adminProcedure
      .input(z.object({ id: z.string(), data: billingTenantUpdateSchema }))
      .mutation(({ input }) => billingTenantsDataAccess.update(input.id, input.data)),
    previewPlatformImport: adminProcedure
      .input(
        z.object({
          platformTenantIds: z
            .array(z.string().regex(/^\d+$/))
            .min(1)
            .max(PLATFORM_TENANT_IMPORT_MAX_IDS),
        }),
      )
      .mutation(async ({ input }) => {
        try {
          return await platformTenantImportDataAccess.preview(input.platformTenantIds)
        } catch (e) {
          mapPlatformImportError(e)
        }
      }),
    commitPlatformImport: adminProcedure
      .input(z.object({ items: z.array(platformImportCommitItemSchema).min(1) }))
      .mutation(async ({ input }) => {
        try {
          return await platformTenantImportDataAccess.commit(input.items)
        } catch (e) {
          mapPlatformImportError(e)
        }
      }),
    fetchBillingImportPreview: adminProcedure
      .input(billingImportDateSchema)
      .mutation(async ({ input }) => {
        try {
          return await tenantBillingImportDataAccess.fetchPreview(input)
        } catch (e) {
          mapBillingImportError(e)
        }
      }),
    commitBillingImport: adminProcedure
      .input(z.object({ previewId: z.string().uuid() }))
      .mutation(async ({ input }) => {
        try {
          return await tenantBillingImportDataAccess.commitImport(input.previewId)
        } catch (e) {
          mapBillingImportError(e)
        }
      }),
    directBillingImport: adminProcedure
      .input(billingImportDateSchema)
      .mutation(async ({ input }) => {
        try {
          return await tenantBillingImportDataAccess.directImport(input)
        } catch (e) {
          mapBillingImportError(e)
        }
      }),
    listRecharges: protectedProcedure
      .input(z.object({ tenantId: z.string().min(1) }))
      .query(({ input }) => tenantBillingListsDataAccess.listRecharges(input.tenantId)),
    listMonthlyBills: protectedProcedure
      .input(z.object({ tenantId: z.string().min(1) }))
      .query(({ input }) => tenantBillingListsDataAccess.listMonthlyBills(input.tenantId)),
    getMonthlyBillDetails: protectedProcedure
      .input(z.object({ billId: z.string().min(1) }))
      .query(({ input }) => tenantBillingListsDataAccess.getMonthlyBillDetails(input.billId)),
    listMetalOrders: protectedProcedure
      .input(z.object({ tenantId: z.string().min(1) }))
      .query(({ input }) => tenantBillingListsDataAccess.listMetalOrders(input.tenantId)),
    listReservedPackOrders: protectedProcedure
      .input(z.object({ tenantId: z.string().min(1) }))
      .query(({ input }) => tenantBillingListsDataAccess.listReservedPackOrders(input.tenantId)),
  }),

  projectTags: createTRPCRouter({
    list: protectedProcedure.query(() => projectTagsDataAccess.listAll()),
    listByProject: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(({ input }) => projectTagsDataAccess.listByProjectId(input.projectId)),
    create: adminProcedure
      .input(z.object({ name: z.string().min(1).max(128) }))
      .mutation(({ input }) => projectTagsDataAccess.create(input.name)),
    setForProject: adminProcedure
      .input(z.object({ projectId: z.string(), tagIds: z.array(z.string()) }))
      .mutation(({ input }) =>
        projectTagsDataAccess.setForProject(input.projectId, input.tagIds),
      ),
  }),

  staff: createTRPCRouter({
    list: protectedProcedure
      .input(staffListSchema)
      .query(({ input }) => staffDataAccess.list(input ?? {})),
    listActive: protectedProcedure.query(() => staffDataAccess.listActive()),
    getById: protectedProcedure.input(z.object({ id: z.string() })).query(({ input }) =>
      staffDataAccess.getById(input.id),
    ),
    create: adminProcedure.input(staffUpsertSchema).mutation(({ input }) =>
      staffDataAccess.create(input),
    ),
    update: adminProcedure
      .input(z.object({ id: z.string(), data: staffUpsertSchema }))
      .mutation(({ input }) => staffDataAccess.update(input.id, input.data)),
    delete: adminProcedure.input(z.object({ id: z.string() })).mutation(({ input }) =>
      staffDataAccess.delete(input.id),
    ),
    listAssignments: protectedProcedure
      .input(z.object({ staffId: z.string() }))
      .query(({ input }) => staffDataAccess.listAssignments(input.staffId)),
  }),

  businessLines: createTRPCRouter({
    listActive: protectedProcedure.query(() => businessLinesDataAccess.listActive()),
  }),

  contracts: createTRPCRouter({
    list: protectedProcedure.query(() => contractsDataAccess.list()),
  }),

  dashboard: createTRPCRouter({
    summary: protectedProcedure.query(() => dashboardDataAccess.summary()),
    recentProjects: protectedProcedure.query(() => dashboardDataAccess.recentProjects()),
    recentActivities: protectedProcedure.query(() => dashboardDataAccess.recentActivities()),
    pendingBills: protectedProcedure.query(() => dashboardDataAccess.pendingBills()),
  }),

  analytics: createTRPCRouter({
    consumptionTrend: protectedProcedure.query(() => dashboardDataAccess.consumptionTrend()),
    productLineBreakdown: protectedProcedure.query(() =>
      dashboardDataAccess.productLineBreakdown(),
    ),
  }),

  calendar: createTRPCRouter({
    listActivities: protectedProcedure
      .input(z.object({ from: z.string().optional(), to: z.string().optional() }).optional())
      .query(({ input }) => calendarDataAccess.listActivities(input)),
    listActivityTypes: protectedProcedure.query(() => calendarDataAccess.listActivityTypes()),
  }),
})
