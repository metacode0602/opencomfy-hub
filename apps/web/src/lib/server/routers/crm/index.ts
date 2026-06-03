import { createTRPCRouter, protectedProcedure, adminProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { customersDataAccess } from '@/lib/server/dataaccess/crm/customers'
import { customerMergeDataAccess } from '@/lib/server/dataaccess/crm/customer-merge'
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
import { conversionQueryDataAccess } from '@/lib/server/dataaccess/crm/conversion-query'
import { tenantProjectCostDataAccess } from '@/lib/server/dataaccess/crm/tenant-project-cost'
import { projectActivitiesDataAccess } from '@/lib/server/dataaccess/crm/project-activities'
import { projectAccountManagerDataAccess } from '@/lib/server/dataaccess/crm/project-account-manager'
import { projectRevenueDepartmentDataAccess } from '@/lib/server/dataaccess/crm/project-revenue-department'
import {
  SuanliBillingApiError,
  tenantBillingImportDataAccess,
} from '@/lib/server/dataaccess/crm/tenant-billing-import'
import { billingScheduledSyncDataAccess } from '@/lib/server/dataaccess/crm/billing-scheduled-sync'
import { balanceSnapshotDataAccess } from '@/lib/server/dataaccess/crm/balance-snapshot'
import { SuanliOpenApiError } from '@/lib/server/integrations/suanli-tenant-api'
import { PLATFORM_TENANT_IMPORT_MAX_IDS } from '@/lib/crm/platform-tenant-import-utils'
import {
  billingTenantUpdateSchema,
  customerMergeSchema,
  customerUpsertSchema,
  platformImportCommitItemSchema,
  projectStageSchema,
  projectUpsertSchema,
  changeProjectAccountManagerSchema,
  changeProjectRevenueDepartmentSchema,
  staffDepartmentSchema,
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

const projectBillingSyncSchema = z.object({
  projectId: z.string().min(1),
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
  tagIds: z.array(z.string()).optional(),
  staffId: z.string().optional(),
  accountManagerStaffId: z.string().optional(),
  revenueDepartment: z.union([staffDepartmentSchema, z.literal('all')]).optional(),
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
    listDailyConsumptions: protectedProcedure
      .input(
        z.object({
          customerId: z.string(),
          productLine: z.string().optional(),
          usageMonth: z.string().optional(),
        }),
      )
      .query(({ input }) =>
        billingDataAccess.listDailyConsumptionsByCustomer(input.customerId, {
          productLine: input.productLine,
          usageMonth: input.usageMonth,
        }),
      ),
    listDailyConsumptionDetails: protectedProcedure
      .input(
        z.object({
          customerId: z.string(),
          tenantId: z.string(),
          usageDate: z.string(),
          productLine: z.string(),
        }),
      )
      .query(({ input }) =>
        billingDataAccess.listDailyConsumptionDetailsByCustomer(input.customerId, {
          tenantId: input.tenantId,
          usageDate: input.usageDate,
          productLine: input.productLine,
        }),
      ),
    consumptionTrend: protectedProcedure
      .input(
        z.object({
          customerId: z.string(),
          months: z.number().int().min(1).max(24).optional(),
        }),
      )
      .query(({ input }) =>
        billingDataAccess.consumptionTrendByCustomer(input.customerId, input.months),
      ),
    productLineBreakdown: protectedProcedure
      .input(
        z.object({
          customerId: z.string(),
          usageMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
        }),
      )
      .query(({ input }) =>
        billingDataAccess.productLineBreakdownByCustomer(input.customerId, input.usageMonth),
      ),
    listCoupons: protectedProcedure
      .input(z.object({ customerId: z.string() }))
      .query(({ input }) => billingDataAccess.listCouponsByCustomer(input.customerId)),
    listContracts: protectedProcedure
      .input(z.object({ customerId: z.string() }))
      .query(({ input }) => contractsDataAccess.listByCustomerId(input.customerId)),
    listTenants: protectedProcedure
      .input(z.object({ customerId: z.string() }))
      .query(({ input }) => billingDataAccess.listTenantsByCustomer(input.customerId)),
    previewMerge: adminProcedure.input(customerMergeSchema).query(({ input }) =>
      customerMergeDataAccess.previewMerge(input),
    ),
    merge: adminProcedure.input(customerMergeSchema).mutation(({ input }) =>
      customerMergeDataAccess.mergeCustomers(input),
    ),
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
      .input(z.object({ id: z.string(), stage: projectStageSchema }))
      .mutation(({ input }) => projectsDataAccess.updateStage(input.id, input.stage)),
    updateStatus: adminProcedure
      .input(z.object({ id: z.string(), status: z.enum(['active', 'paused', 'completed']) }))
      .mutation(({ input }) => projectsDataAccess.updateStatus(input.id, input.status)),
    stageCounts: protectedProcedure.query(() => projectsDataAccess.countByStage()),
    listStaffFilterOptions: protectedProcedure.query(async ({ ctx }) => {
      const [staff, currentUserStaffId] = await Promise.all([
        projectsDataAccess.listStaffFilterOptions(),
        staffDataAccess.resolveStaffIdForAuthUser(ctx.user),
      ])
      return { staff, currentUserStaffId }
    }),
    listAccountManagerFilterOptions: protectedProcedure.query(async ({ ctx }) => {
      const [staff, currentUserStaffId] = await Promise.all([
        projectsDataAccess.listAccountManagerFilterOptions(),
        staffDataAccess.resolveStaffIdForAuthUser(ctx.user),
      ])
      return { staff, currentUserStaffId }
    }),
    getAccountManagerAssignment: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(({ input }) => projectAccountManagerDataAccess.getCurrent(input.projectId)),
    changeAccountManager: adminProcedure
      .input(changeProjectAccountManagerSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          const createdBy = await staffDataAccess.resolveStaffIdForAuthUser(ctx.user)
          await projectAccountManagerDataAccess.change({
            ...input,
            createdBy,
          })
          return projectsDataAccess.getById(input.projectId)
        } catch (e) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: e instanceof Error ? e.message : '更新客户经理失败',
          })
        }
      }),
    getRevenueDepartmentAssignment: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(({ input }) => projectRevenueDepartmentDataAccess.getCurrent(input.projectId)),
    changeRevenueDepartment: adminProcedure
      .input(changeProjectRevenueDepartmentSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          const createdBy = await staffDataAccess.resolveStaffIdForAuthUser(ctx.user)
          await projectRevenueDepartmentDataAccess.change({
            ...input,
            createdBy,
          })
          return projectsDataAccess.getById(input.projectId)
        } catch (e) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: e instanceof Error ? e.message : '更新收入归属部门失败',
          })
        }
      }),
    listActivities: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(({ input }) => billingDataAccess.listActivitiesByProject(input.projectId)),
    createActivity: protectedProcedure
      .input(
        z.object({
          projectId: z.string(),
          comment: z.string().max(5000).default(''),
          files: z
            .array(
              z.object({
                fileName: z.string().min(1).max(255),
                mimeType: z.string().max(128).default('application/octet-stream'),
                fileBase64: z.string().min(1),
              }),
            )
            .max(5)
            .default([]),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          return await projectActivitiesDataAccess.createComment({
            projectId: input.projectId,
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
    updateActivity: protectedProcedure
      .input(
        z.object({
          projectId: z.string(),
          activityId: z.string(),
          comment: z.string().min(1).max(5000),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          return await projectActivitiesDataAccess.updateComment({
            projectId: input.projectId,
            activityId: input.activityId,
            comment: input.comment,
            user: ctx.user,
          })
        } catch (e) {
          if (e instanceof Error) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: e.message })
          }
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '更新评论失败' })
        }
      }),
    listConsumptions: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(({ input }) => billingDataAccess.listConsumptionsByProject(input.projectId)),
    listDailyConsumptions: protectedProcedure
      .input(
        z.object({
          projectId: z.string(),
          productLine: z.string().optional(),
          usageMonth: z.string().optional(),
        }),
      )
      .query(({ input }) =>
        billingDataAccess.listDailyConsumptionsByProject(input.projectId, {
          productLine: input.productLine,
          usageMonth: input.usageMonth,
        }),
      ),
    listBalanceSnapshots: protectedProcedure
      .input(
        z.object({
          projectId: z.string(),
          granularity: z.enum(['hour', 'day']),
          usageDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          usageDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        }),
      )
      .query(({ input }) =>
        balanceSnapshotDataAccess.listForProject(input.projectId, {
          granularity: input.granularity,
          usageDateFrom: input.usageDateFrom,
          usageDateTo: input.usageDateTo,
        }),
      ),
    listDailyConsumptionDetails: protectedProcedure
      .input(
        z.object({
          projectId: z.string(),
          tenantId: z.string(),
          usageDate: z.string(),
          productLine: z.string(),
        }),
      )
      .query(({ input }) =>
        billingDataAccess.listDailyConsumptionDetailsByProject(input.projectId, {
          tenantId: input.tenantId,
          usageDate: input.usageDate,
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
    queryConversion: adminProcedure
      .input(z.object({ rawTenantIds: z.string() }))
      .mutation(async ({ input }) => {
        try {
          return await conversionQueryDataAccess.query(input.rawTenantIds)
        } catch (e) {
          mapPlatformImportError(e)
        }
      }),
    commitConversion: adminProcedure
      .input(
        z.object({
          projectIds: z.array(z.string().min(1)).min(1),
          conversionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        }),
      )
      .mutation(async ({ input }) => {
        try {
          return await conversionQueryDataAccess.commit(input)
        } catch (e) {
          if (e instanceof Error) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: e.message })
          }
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '批量转正失败' })
        }
      }),
    listBillingTenants: protectedProcedure
      .input(z.object({ projectId: z.string().min(1) }))
      .query(({ input }) => projectsDataAccess.listBillingTenantsForProject(input.projectId)),
    syncBilling: adminProcedure
      .input(projectBillingSyncSchema)
      .mutation(async ({ input }) => {
        try {
          return await tenantBillingImportDataAccess.syncBillingForProject(input)
        } catch (e) {
          mapBillingImportError(e)
        }
      }),
  }),

  tenants: createTRPCRouter({
    list: protectedProcedure
      .input(
        z
          .object({
            search: z.string().optional(),
            tagId: z.string().optional(),
          })
          .optional(),
      )
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
    create: adminProcedure.input(staffUpsertSchema).mutation(({ input, ctx }) =>
      staffDataAccess.create(input, { operatorUserId: ctx.user.id }),
    ),
    update: adminProcedure
      .input(z.object({ id: z.string(), data: staffUpsertSchema }))
      .mutation(({ input, ctx }) =>
        staffDataAccess.update(input.id, input.data, { operatorUserId: ctx.user.id }),
      ),
    delete: adminProcedure.input(z.object({ id: z.string() })).mutation(({ input }) =>
      staffDataAccess.delete(input.id),
    ),
    linkAuthUser: adminProcedure
      .input(z.object({ staffId: z.string(), authUserId: z.string() }))
      .mutation(({ input, ctx }) =>
        staffDataAccess.linkAuthUser(input.staffId, input.authUserId, {
          operatorUserId: ctx.user.id,
        }),
      ),
    unlinkAuthUser: adminProcedure
      .input(z.object({ staffId: z.string() }))
      .mutation(({ input }) => staffDataAccess.unlinkAuthUser(input.staffId)),
    searchLinkableAuthUsers: adminProcedure
      .input(z.object({ query: z.string(), limit: z.number().int().min(1).max(50).optional() }))
      .query(({ input }) => staffDataAccess.searchLinkableAuthUsers(input.query, input.limit)),
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
    recentProjects: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(20).optional() }).optional())
      .query(({ input }) => dashboardDataAccess.recentProjects(input?.limit)),
    recentActivities: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(50).optional() }).optional())
      .query(({ input }) => dashboardDataAccess.recentActivities(input?.limit)),
    pendingBills: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(50).optional() }).optional())
      .query(({ input }) => dashboardDataAccess.pendingBills(input?.limit)),
  }),

  analytics: createTRPCRouter({
    consumptionTrend: protectedProcedure
      .input(z.object({ months: z.number().int().min(1).max(24).optional() }).optional())
      .query(({ input }) => dashboardDataAccess.consumptionTrend(input?.months)),
    productLineBreakdown: protectedProcedure
      .input(z.object({ usageMonth: z.string().regex(/^\d{4}-\d{2}$/).optional() }).optional())
      .query(({ input }) => dashboardDataAccess.productLineBreakdown(input?.usageMonth)),
  }),

  calendar: createTRPCRouter({
    listActivities: protectedProcedure
      .input(z.object({ from: z.string().optional(), to: z.string().optional() }).optional())
      .query(({ input }) => calendarDataAccess.listActivities(input)),
    listActivityTypes: protectedProcedure.query(() => calendarDataAccess.listActivityTypes()),
  }),

  tenantProjectCost: createTRPCRouter({
    getByProjectId: protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ input }) => {
        const context = await tenantProjectCostDataAccess.getContextByProjectId(input.projectId)
        if (!context) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '未找到项目或关联计费租户' })
        }
        return context
      }),
    savePresets: adminProcedure
      .input(
        z.object({
          tenantId: z.string(),
          allocations: z.array(
            z.object({
              projectId: z.string(),
              allocationPercent: z.string(),
            }),
          ),
          remark: z.string().max(500).optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const createdBy = await staffDataAccess.resolveStaffIdForAuthUser(ctx.user)
          await tenantProjectCostDataAccess.savePresets({
            tenantId: input.tenantId,
            allocations: input.allocations,
            remark: input.remark,
            createdBy,
          })
        } catch (e) {
          if (e instanceof Error) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: e.message })
          }
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '保存项目成本分成失败' })
        }
      }),
  }),

  billingSync: createTRPCRouter({
    getConfig: adminProcedure.query(() => billingScheduledSyncDataAccess.getConfig()),
    runNow: adminProcedure
      .input(
        z
          .object({
            projectIds: z.array(z.string()).optional(),
          })
          .optional(),
      )
      .mutation(async ({ input }) => billingScheduledSyncDataAccess.runNow(input)),
    listRuns: adminProcedure
      .input(
        z
          .object({
            limit: z.number().int().min(1).max(100).optional(),
            offset: z.number().int().min(0).optional(),
          })
          .optional(),
      )
      .query(({ input }) => billingScheduledSyncDataAccess.listRuns(input)),
    getRunById: adminProcedure
      .input(z.object({ id: z.string().min(1) }))
      .query(({ input }) => billingScheduledSyncDataAccess.getRunById(input.id)),
  }),

  balanceSnapshot: createTRPCRouter({
    getConfig: adminProcedure.query(() => balanceSnapshotDataAccess.getConfig()),
    runNow: adminProcedure
      .input(
        z
          .object({
            granularity: z.enum(['hour', 'day', 'all']).optional(),
          })
          .optional(),
      )
      .mutation(async ({ input }) => balanceSnapshotDataAccess.runNow(input)),
    listRuns: adminProcedure
      .input(
        z
          .object({
            limit: z.number().int().min(1).max(100).optional(),
            offset: z.number().int().min(0).optional(),
          })
          .optional(),
      )
      .query(({ input }) => balanceSnapshotDataAccess.listRuns(input)),
    getRunById: adminProcedure
      .input(z.object({ id: z.string().min(1) }))
      .query(({ input }) => balanceSnapshotDataAccess.getRunById(input.id)),
  }),
})
