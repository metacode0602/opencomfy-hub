import {
  createTRPCRouter,
  adminProcedure,
  crmScopedProcedure,
  crmWriteProcedure,
  sharedReadProcedure,
} from '../trpc'
import {
  assertCustomerInScope,
  assertProjectInScope,
  assertTenantInScope,
  resolveCrmDataScope,
} from '@/lib/server/auth/crm-data-scope'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { customersDataAccess } from '@/lib/server/dataaccess/crm/customers'
import { customerMergeDataAccess } from '@/lib/server/dataaccess/crm/customer-merge'
import { customerContactsDataAccess } from '@/lib/server/dataaccess/crm/customer-contacts'
import { tenantContactsDataAccess } from '@/lib/server/dataaccess/crm/tenant-contacts'
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
import { tenantProjectQueryDataAccess } from '@/lib/server/dataaccess/crm/tenant-project-query'
import { tenantRechargeBalanceQueryDataAccess } from '@/lib/server/dataaccess/crm/tenant-recharge-balance-query'
import { tenantProjectCostDataAccess } from '@/lib/server/dataaccess/crm/tenant-project-cost'
import { listProjectMonthlyCostSnapshots } from '@/lib/server/dataaccess/finance/list-project-monthly-cost-snapshots'
import { projectActivitiesDataAccess } from '@/lib/server/dataaccess/crm/project-activities'
import { projectAccountManagerDataAccess } from '@/lib/server/dataaccess/crm/project-account-manager'
import { projectStaffAssignmentDataAccess } from '@/lib/server/dataaccess/crm/project-staff-assignment'
import { projectRevenueDepartmentDataAccess } from '@/lib/server/dataaccess/crm/project-revenue-department'
import { projectOpportunitySourceDataAccess } from '@/lib/server/dataaccess/crm/project-opportunity-source'
import { projectConversionSettingDataAccess } from '@/lib/server/dataaccess/crm/project-conversion-setting'
import { projectCommissionPhaseDataAccess } from '@/lib/server/dataaccess/crm/project-commission-phase'
import { bareMetalOrderOfflineImportDataAccess } from '@/lib/server/dataaccess/crm/bare-metal-order-offline-import'
import { bareMetalOrderDataAccess } from '@/lib/server/dataaccess/supplier/bare-metal-order'
import { bareMetalOrderSyncSettingsDataAccess } from '@/lib/server/dataaccess/supplier/bare-metal-order-sync-settings'
import {
  SuanliBillingApiError,
  tenantBillingImportDataAccess,
} from '@/lib/server/dataaccess/crm/tenant-billing-import'
import { billingScheduledSyncDataAccess } from '@/lib/server/dataaccess/crm/billing-scheduled-sync'
import { balanceSnapshotDataAccess } from '@/lib/server/dataaccess/crm/balance-snapshot'
import { tenantBlacklistDataAccess } from '@/lib/server/dataaccess/crm/tenant-blacklist'
import {
  customerIdentitySyncDataAccess,
  EnterpriseAuthApiError,
} from '@/lib/server/dataaccess/crm/customer-identity-sync'
import { TenantBlacklistApiError } from '@/lib/server/integrations/tenant-blacklist-api'
import { SuanliOpenApiError } from '@/lib/server/integrations/suanli-tenant-api'
import { MAX_BLACKLIST_SAFETY_DAYS } from '@/lib/crm/tenant-blacklist-utils'
import { PLATFORM_TENANT_IMPORT_MAX_IDS } from '@/lib/crm/platform-tenant-import-utils'
import {
  billingTenantInternalSettingSchema,
  billingTenantUpdateSchema,
  customerMergeSchema,
  customerUpsertSchema,
  platformImportCommitItemSchema,
  projectStageSchema,
  projectUpsertSchema,
  changeProjectAccountManagerSchema,
  listProjectStaffAssignmentHistorySchema,
  changeProjectRevenueDepartmentSchema,
  changeProjectOpportunitySourceSchema,
  setProjectConversionSettingSchema,
  staffDepartmentSchema,
  staffUpsertSchema,
  staffListSchema,
  tenantProjectImportFormSchema,
} from './schemas'
import {
  customerContactCreateSchema,
  customerContactListSchema,
  entityContactDeleteSchema,
  entityContactSetPrimarySchema,
  entityContactUpdateSchema,
  tenantContactCreateSchema,
  tenantContactListSchema,
} from '../shared/entity-contact-schemas'

function mapContactMutationError(e: unknown): never {
  if (e instanceof Error) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: e.message })
  }
  throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '操作失败' })
}

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

function mapEnterpriseAuthError(e: unknown): never {
  if (e instanceof EnterpriseAuthApiError) {
    throw new TRPCError({
      code: e.code === '401' || e.code === '403' ? 'UNAUTHORIZED' : 'BAD_REQUEST',
      message: e.message,
    })
  }
  if (e instanceof Error) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: e.message })
  }
  throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '企业实名同步失败' })
}

function mapTenantBlacklistError(e: unknown): never {
  if (e instanceof TenantBlacklistApiError) {
    throw new TRPCError({
      code: e.code === '401' || e.code === '403' ? 'UNAUTHORIZED' : 'BAD_REQUEST',
      message: e.message,
    })
  }
  if (e instanceof Error) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: e.message })
  }
  throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '租户黑名单同步失败' })
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
    list: crmScopedProcedure.input(listFilterSchema.optional()).query(({ input, ctx }) =>
      customersDataAccess.list(input, ctx.crmScope),
    ),
    getById: crmScopedProcedure.input(z.object({ id: z.string() })).query(({ input, ctx }) =>
      customersDataAccess.getById(input.id, ctx.crmScope),
    ),
    create: crmWriteProcedure.input(customerUpsertSchema).mutation(({ input }) =>
      customersDataAccess.create(input),
    ),
    update: crmWriteProcedure
      .input(z.object({ id: z.string(), data: customerUpsertSchema }))
      .mutation(async ({ input, ctx }) => {
        await assertCustomerInScope(ctx.crmScope, input.id)
        return customersDataAccess.update(input.id, input.data)
      }),
    listProjects: crmScopedProcedure
      .input(z.object({ customerId: z.string() }))
      .query(async ({ input, ctx }) => {
        await assertCustomerInScope(ctx.crmScope, input.customerId)
        return projectsDataAccess.listByCustomerId(input.customerId, ctx.crmScope)
      }),
    listRecharges: crmScopedProcedure
      .input(z.object({ customerId: z.string() }))
      .query(({ input }) => billingDataAccess.listRechargesByCustomer(input.customerId)),
    listDailyConsumptions: crmScopedProcedure
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
    listDailyConsumptionDetails: crmScopedProcedure
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
    consumptionTrend: crmScopedProcedure
      .input(
        z.object({
          customerId: z.string(),
          months: z.number().int().min(1).max(24).optional(),
        }),
      )
      .query(({ input }) =>
        billingDataAccess.consumptionTrendByCustomer(input.customerId, input.months),
      ),
    productLineBreakdown: crmScopedProcedure
      .input(
        z.object({
          customerId: z.string(),
          usageMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
        }),
      )
      .query(({ input }) =>
        billingDataAccess.productLineBreakdownByCustomer(input.customerId, input.usageMonth),
      ),
    listCoupons: crmScopedProcedure
      .input(z.object({ customerId: z.string() }))
      .query(({ input }) => billingDataAccess.listCouponsByCustomer(input.customerId)),
    listContracts: crmScopedProcedure
      .input(z.object({ customerId: z.string() }))
      .query(({ input }) => contractsDataAccess.listByCustomerId(input.customerId)),
    listTenants: crmScopedProcedure
      .input(z.object({ customerId: z.string() }))
      .query(({ input }) => billingDataAccess.listTenantsByCustomer(input.customerId)),
    previewMerge: adminProcedure.input(customerMergeSchema).query(({ input }) =>
      customerMergeDataAccess.previewMerge(input),
    ),
    merge: adminProcedure.input(customerMergeSchema).mutation(({ input }) =>
      customerMergeDataAccess.mergeCustomers(input),
    ),
    previewIdentitySync: adminProcedure.query(async () => {
      try {
        return await customerIdentitySyncDataAccess.previewSync()
      } catch (e) {
        mapEnterpriseAuthError(e)
      }
    }),
    applyIdentitySync: adminProcedure
      .input(z.object({ customerIds: z.array(z.string().min(1)).min(1) }))
      .mutation(async ({ input }) => {
        try {
          return await customerIdentitySyncDataAccess.applySync(input)
        } catch (e) {
          mapEnterpriseAuthError(e)
        }
      }),
    contacts: createTRPCRouter({
      list: crmScopedProcedure.input(customerContactListSchema).query(async ({ input, ctx }) => {
        await assertCustomerInScope(ctx.crmScope, input.customerId)
        return customerContactsDataAccess.list(input.customerId)
      }),
      create: crmWriteProcedure
        .input(customerContactCreateSchema)
        .mutation(async ({ input, ctx }) => {
          await assertCustomerInScope(ctx.crmScope, input.customerId)
          const { customerId, ...data } = input
          try {
            return await customerContactsDataAccess.create({ customerId, data })
          } catch (e) {
            mapContactMutationError(e)
          }
        }),
      update: crmWriteProcedure.input(entityContactUpdateSchema).mutation(async ({ input }) => {
        try {
          return await customerContactsDataAccess.update(input)
        } catch (e) {
          mapContactMutationError(e)
        }
      }),
      delete: crmWriteProcedure.input(entityContactDeleteSchema).mutation(async ({ input }) => {
        try {
          return await customerContactsDataAccess.delete(input)
        } catch (e) {
          mapContactMutationError(e)
        }
      }),
      setPrimary: crmWriteProcedure
        .input(entityContactSetPrimarySchema)
        .mutation(async ({ input }) => {
          try {
            return await customerContactsDataAccess.setPrimary(input)
          } catch (e) {
            mapContactMutationError(e)
          }
        }),
    }),
  }),

  projects: createTRPCRouter({
    list: crmScopedProcedure.input(projectFilterSchema.optional()).query(({ input, ctx }) =>
      projectsDataAccess.list(input, ctx.crmScope),
    ),
    getById: crmScopedProcedure.input(z.object({ id: z.string() })).query(({ input, ctx }) =>
      projectsDataAccess.getById(input.id, ctx.crmScope),
    ),
    create: adminProcedure.input(projectUpsertSchema).mutation(async ({ input, ctx }) => {
      const crmScope = await resolveCrmDataScope(ctx.user)
      await assertCustomerInScope(crmScope, input.customerId)
      return projectsDataAccess.create(input)
    }),
    update: crmWriteProcedure
      .input(z.object({ id: z.string(), data: projectUpsertSchema }))
      .mutation(async ({ input, ctx }) => {
        await assertProjectInScope(ctx.crmScope, input.id)
        await assertCustomerInScope(ctx.crmScope, input.data.customerId)
        return projectsDataAccess.update(input.id, input.data)
      }),
    updateStage: crmWriteProcedure
      .input(z.object({ id: z.string(), stage: projectStageSchema }))
      .mutation(async ({ input, ctx }) => {
        await assertProjectInScope(ctx.crmScope, input.id)
        return projectsDataAccess.updateStage(input.id, input.stage)
      }),
    updateStatus: crmWriteProcedure
      .input(z.object({ id: z.string(), status: z.enum(['active', 'paused', 'completed']) }))
      .mutation(async ({ input, ctx }) => {
        await assertProjectInScope(ctx.crmScope, input.id)
        return projectsDataAccess.updateStatus(input.id, input.status)
      }),
    stageCounts: crmScopedProcedure.query(({ ctx }) =>
      projectsDataAccess.countByStage(ctx.crmScope),
    ),
    listStaffFilterOptions: crmScopedProcedure.query(async ({ ctx }) => {
      const [staff, currentUserStaffId] = await Promise.all([
        projectsDataAccess.listStaffFilterOptions(),
        staffDataAccess.resolveStaffIdForAuthUser(ctx.user),
      ])
      return { staff, currentUserStaffId }
    }),
    listAccountManagerFilterOptions: crmScopedProcedure.query(async ({ ctx }) => {
      const [staff, currentUserStaffId] = await Promise.all([
        projectsDataAccess.listAccountManagerFilterOptions(),
        staffDataAccess.resolveStaffIdForAuthUser(ctx.user),
      ])
      return { staff, currentUserStaffId }
    }),
    getAccountManagerAssignment: crmScopedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(({ input }) => projectAccountManagerDataAccess.getCurrent(input.projectId)),
    listStaffAssignmentHistory: crmScopedProcedure
      .input(listProjectStaffAssignmentHistorySchema)
      .query(async ({ input, ctx }) => {
        await assertProjectInScope(ctx.crmScope, input.projectId)
        return projectStaffAssignmentDataAccess.listHistory(input.projectId, input.roleType)
      }),
    changeAccountManager: crmWriteProcedure
      .input(changeProjectAccountManagerSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          await assertProjectInScope(ctx.crmScope, input.projectId)
          const createdBy = await staffDataAccess.resolveStaffIdForAuthUser(ctx.user)
          await projectAccountManagerDataAccess.change({
            ...input,
            createdBy,
          })
          return projectsDataAccess.getById(input.projectId, ctx.crmScope)
        } catch (e) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: e instanceof Error ? e.message : '更新客户经理失败',
          })
        }
      }),
    getRevenueDepartmentAssignment: crmScopedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(({ input }) => projectRevenueDepartmentDataAccess.getCurrent(input.projectId)),
    changeRevenueDepartment: crmWriteProcedure
      .input(changeProjectRevenueDepartmentSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          await assertProjectInScope(ctx.crmScope, input.projectId)
          const createdBy = await staffDataAccess.resolveStaffIdForAuthUser(ctx.user)
          await projectRevenueDepartmentDataAccess.change({
            ...input,
            createdBy,
          })
          return projectsDataAccess.getById(input.projectId, ctx.crmScope)
        } catch (e) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: e instanceof Error ? e.message : '更新收入归属部门失败',
          })
        }
      }),
    getOpportunitySourceAssignment: crmScopedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(({ input }) => projectOpportunitySourceDataAccess.getCurrent(input.projectId)),
    changeOpportunitySource: crmWriteProcedure
      .input(changeProjectOpportunitySourceSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          await assertProjectInScope(ctx.crmScope, input.projectId)
          const createdBy = await staffDataAccess.resolveStaffIdForAuthUser(ctx.user)
          await projectOpportunitySourceDataAccess.change({
            ...input,
            createdBy,
          })
          return projectsDataAccess.getById(input.projectId, ctx.crmScope)
        } catch (e) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: e instanceof Error ? e.message : '更新商机来源失败',
          })
        }
      }),
    getConversionSetting: crmScopedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(({ input }) => projectConversionSettingDataAccess.getByProjectId(input.projectId)),
    hasRechargeOnConversionDate: crmScopedProcedure
      .input(
        z.object({
          projectId: z.string().min(1),
          conversionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        }),
      )
      .query(({ input }) =>
        projectConversionSettingDataAccess.hasRechargeOnDate(
          input.projectId,
          input.conversionDate,
        ),
      ),
    setConversionSetting: crmWriteProcedure
      .input(setProjectConversionSettingSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          await assertProjectInScope(ctx.crmScope, input.projectId)
          const createdBy = await staffDataAccess.resolveStaffIdForAuthUser(ctx.user)
          await projectConversionSettingDataAccess.set({
            ...input,
            createdBy,
          })
          return projectsDataAccess.getById(input.projectId, ctx.crmScope)
        } catch (e) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: e instanceof Error ? e.message : '项目激励开始设置失败',
          })
        }
      }),
    getCommissionPhase: crmScopedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(({ input }) => projectCommissionPhaseDataAccess.resolve(input.projectId)),
    listActivities: crmScopedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(({ input }) => billingDataAccess.listActivitiesByProject(input.projectId)),
    createActivity: crmWriteProcedure
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
          await assertProjectInScope(ctx.crmScope, input.projectId)
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
    updateActivity: crmWriteProcedure
      .input(
        z.object({
          projectId: z.string(),
          activityId: z.string(),
          comment: z.string().min(1).max(5000),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          await assertProjectInScope(ctx.crmScope, input.projectId)
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
    listConsumptions: crmScopedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(({ input }) => billingDataAccess.listConsumptionsByProject(input.projectId)),
    listDailyConsumptions: crmScopedProcedure
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
    listBalanceSnapshots: crmScopedProcedure
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
    listMonthlyCostSnapshots: crmScopedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ input, ctx }) => {
        await assertProjectInScope(ctx.crmScope, input.projectId)
        return listProjectMonthlyCostSnapshots(input.projectId)
      }),
    listDailyConsumptionDetails: crmScopedProcedure
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
    listTasks: crmScopedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(({ input }) => billingDataAccess.listTasksByProject(input.projectId)),
    listOrders: crmScopedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(({ input }) => billingDataAccess.listOrdersByProject(input.projectId)),
    listCoupons: crmScopedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(({ input }) => billingDataAccess.listCouponsByProject(input.projectId)),
    listRecharges: crmScopedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(({ input }) => billingDataAccess.listRechargesByProject(input.projectId)),
    listBills: crmScopedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(({ input }) => billingDataAccess.listBillsByProject(input.projectId)),
    listMonthlyBills: crmScopedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(({ input }) => billingDataAccess.listMonthlyBillsByProject(input.projectId)),
    listBareMetalOrders: crmScopedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ input, ctx }) => {
        await assertProjectInScope(ctx.crmScope, input.projectId)
        return bareMetalOrderDataAccess.listByProject(input.projectId)
      }),
    previewOfflineBareMetalOrders: adminProcedure
      .input(
        z.object({
          projectId: z.string().min(1),
          tenantId: z.string().min(1),
          fileName: z.string().min(1),
          fileBase64: z.string().min(1),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const crmScope = await resolveCrmDataScope(ctx.user)
          await assertProjectInScope(crmScope, input.projectId)
          return await bareMetalOrderOfflineImportDataAccess.preview(input)
        } catch (e) {
          if (e instanceof Error) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: e.message })
          }
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '预览失败' })
        }
      }),
    commitOfflineBareMetalOrders: adminProcedure
      .input(z.object({ previewToken: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        try {
          const staffId = await staffDataAccess.resolveStaffIdForAuthUser(ctx.user)
          return await bareMetalOrderOfflineImportDataAccess.commit({
            previewToken: input.previewToken,
            operatorStaffId: staffId,
          })
        } catch (e) {
          if (e instanceof Error) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: e.message })
          }
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '导入失败' })
        }
      }),
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
    queryTenantProjects: adminProcedure
      .input(z.object({ rawTenantIds: z.string() }))
      .mutation(async ({ input }) => {
        try {
          return await tenantProjectQueryDataAccess.query(input.rawTenantIds)
        } catch (e) {
          if (e instanceof Error) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: e.message })
          }
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '租户项目查询失败' })
        }
      }),
    listBillingTenants: crmScopedProcedure
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
    list: crmScopedProcedure
      .input(
        z
          .object({
            search: z.string().optional(),
            tagId: z.string().optional(),
          })
          .optional(),
      )
      .query(({ input, ctx }) => billingTenantsDataAccess.list(input, ctx.crmScope)),
    getById: crmScopedProcedure
      .input(z.object({ id: z.string() }))
      .query(({ input, ctx }) => billingTenantsDataAccess.getById(input.id, ctx.crmScope)),
    update: crmWriteProcedure
      .input(z.object({ id: z.string(), data: billingTenantUpdateSchema }))
      .mutation(async ({ input, ctx }) => {
        await assertTenantInScope(ctx.crmScope, input.id)
        return billingTenantsDataAccess.update(input.id, input.data)
      }),
    updateInternalSetting: adminProcedure
      .input(z.object({ id: z.string(), data: billingTenantInternalSettingSchema }))
      .mutation(({ input }) =>
        billingTenantsDataAccess.updateInternalSetting(input.id, input.data),
      ),
    queryRechargeBalance: adminProcedure
      .input(
        z.object({
          rawTenantIds: z.string(),
          usageMonth: z.string().regex(/^\d{4}-\d{2}$/),
        }),
      )
      .mutation(async ({ input }) => {
        try {
          return await tenantRechargeBalanceQueryDataAccess.query(
            input.rawTenantIds,
            input.usageMonth,
          )
        } catch (e) {
          if (e instanceof Error) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: e.message })
          }
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '租户充值余额查询失败' })
        }
      }),
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
    listRecharges: crmScopedProcedure
      .input(z.object({ tenantId: z.string().min(1) }))
      .query(({ input }) => tenantBillingListsDataAccess.listRecharges(input.tenantId)),
    listMonthlyBills: crmScopedProcedure
      .input(z.object({ tenantId: z.string().min(1) }))
      .query(({ input }) => tenantBillingListsDataAccess.listMonthlyBills(input.tenantId)),
    getMonthlyBillDetails: crmScopedProcedure
      .input(z.object({ billId: z.string().min(1) }))
      .query(({ input }) => tenantBillingListsDataAccess.getMonthlyBillDetails(input.billId)),
    listMetalOrders: crmScopedProcedure
      .input(z.object({ tenantId: z.string().min(1) }))
      .query(({ input }) => tenantBillingListsDataAccess.listMetalOrders(input.tenantId)),
    listReservedPackOrders: crmScopedProcedure
      .input(z.object({ tenantId: z.string().min(1) }))
      .query(({ input }) => tenantBillingListsDataAccess.listReservedPackOrders(input.tenantId)),
    contacts: createTRPCRouter({
      list: crmScopedProcedure.input(tenantContactListSchema).query(async ({ input, ctx }) => {
        await assertTenantInScope(ctx.crmScope, input.tenantId)
        return tenantContactsDataAccess.list(input.tenantId)
      }),
      create: crmWriteProcedure.input(tenantContactCreateSchema).mutation(async ({ input, ctx }) => {
        await assertTenantInScope(ctx.crmScope, input.tenantId)
        const { tenantId, ...data } = input
        try {
          return await tenantContactsDataAccess.create({ tenantId, data })
        } catch (e) {
          mapContactMutationError(e)
        }
      }),
      update: crmWriteProcedure.input(entityContactUpdateSchema).mutation(async ({ input }) => {
        try {
          return await tenantContactsDataAccess.update(input)
        } catch (e) {
          mapContactMutationError(e)
        }
      }),
      delete: crmWriteProcedure.input(entityContactDeleteSchema).mutation(async ({ input }) => {
        try {
          return await tenantContactsDataAccess.delete(input)
        } catch (e) {
          mapContactMutationError(e)
        }
      }),
      setPrimary: crmWriteProcedure
        .input(entityContactSetPrimarySchema)
        .mutation(async ({ input }) => {
          try {
            return await tenantContactsDataAccess.setPrimary(input)
          } catch (e) {
            mapContactMutationError(e)
          }
        }),
    }),
  }),

  projectTags: createTRPCRouter({
    list: crmScopedProcedure.query(() => projectTagsDataAccess.listAll()),
    listByProject: crmScopedProcedure
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
    list: adminProcedure
      .input(staffListSchema)
      .query(({ input }) => staffDataAccess.list(input ?? {})),
    listActive: sharedReadProcedure.query(() => staffDataAccess.listActive()),
    getById: adminProcedure.input(z.object({ id: z.string() })).query(({ input }) =>
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
    listAssignments: adminProcedure
      .input(z.object({ staffId: z.string() }))
      .query(({ input }) => staffDataAccess.listAssignments(input.staffId)),
  }),

  businessLines: createTRPCRouter({
    listActive: crmScopedProcedure.query(() => businessLinesDataAccess.listActive()),
  }),

  contracts: createTRPCRouter({
    list: crmScopedProcedure.query(() => contractsDataAccess.list()),
  }),

  dashboard: createTRPCRouter({
    summary: crmScopedProcedure
      .input(
        z
          .object({
            startDate: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .optional(),
            endDate: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .optional(),
            preset: z.enum(['today', 'last7days', 'thisMonth', 'custom']).optional(),
          })
          .optional(),
      )
      .query(({ input, ctx }) => dashboardDataAccess.summary(ctx.crmScope, input)),
    recentProjects: crmScopedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(20).optional() }).optional())
      .query(({ input, ctx }) => dashboardDataAccess.recentProjects(input?.limit, ctx.crmScope)),
    recentActivities: crmScopedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(50).optional() }).optional())
      .query(({ input, ctx }) => dashboardDataAccess.recentActivities(input?.limit, ctx.crmScope)),
    pendingBills: crmScopedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(50).optional() }).optional())
      .query(({ input, ctx }) => dashboardDataAccess.pendingBills(input?.limit, ctx.crmScope)),
  }),

  analytics: createTRPCRouter({
    consumptionTrend: crmScopedProcedure
      .input(
        z
          .union([
            z.object({ months: z.number().int().min(1).max(24).optional() }),
            z.object({
              startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
              endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            }),
          ])
          .optional(),
      )
      .query(({ input, ctx }) => dashboardDataAccess.consumptionTrend(input, ctx.crmScope)),
    productLineBreakdown: crmScopedProcedure
      .input(
        z
          .object({
            usageMonth: z
              .string()
              .regex(/^\d{4}-\d{2}$/)
              .optional(),
            startDate: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .optional(),
            endDate: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .optional(),
          })
          .optional(),
      )
      .query(({ input, ctx }) => dashboardDataAccess.productLineBreakdown(input, ctx.crmScope)),
  }),

  calendar: createTRPCRouter({
    listActivities: crmScopedProcedure
      .input(z.object({ from: z.string().optional(), to: z.string().optional() }).optional())
      .query(({ input }) => calendarDataAccess.listActivities(input)),
    listActivityTypes: crmScopedProcedure.query(() => calendarDataAccess.listActivityTypes()),
  }),

  tenantProjectCost: createTRPCRouter({
    getByProjectId: crmScopedProcedure
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
            mode: z.enum(['incremental', 'backfill']).optional(),
            startDate: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .optional(),
            endDate: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .optional(),
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

  tenantBlacklist: createTRPCRouter({
    getSyncDefaults: adminProcedure.query(() => tenantBlacklistDataAccess.getSyncDefaults()),
    list: sharedReadProcedure
      .input(
        z.object({
          status: z.string().optional(),
          startTime: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          endTime: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          platformTenantId: z.string().optional(),
          tenantName: z.string().optional(),
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(50).default(20),
          includeRemoved: z.boolean().optional(),
        }),
      )
      .query(({ input }) => tenantBlacklistDataAccess.list(input)),
    sync: adminProcedure
      .input(
        z.object({
          lastPullStartDate: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          safetyDays: z.number().int().min(0).max(MAX_BLACKLIST_SAFETY_DAYS),
          fullSync: z.boolean().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        try {
          return await tenantBlacklistDataAccess.syncFromPlatform(input)
        } catch (e) {
          mapTenantBlacklistError(e)
        }
      }),
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

  bareMetalOrderSync: createTRPCRouter({
    getConfig: adminProcedure.query(() => bareMetalOrderSyncSettingsDataAccess.getConfig()),
    runNow: adminProcedure.mutation(() => bareMetalOrderSyncSettingsDataAccess.runNow()),
    listRuns: adminProcedure
      .input(
        z
          .object({
            limit: z.number().int().min(1).max(100).optional(),
            offset: z.number().int().min(0).optional(),
          })
          .optional(),
      )
      .query(({ input }) => bareMetalOrderSyncSettingsDataAccess.listRuns(input)),
    getRunById: adminProcedure
      .input(z.object({ id: z.string().min(1) }))
      .query(({ input }) => bareMetalOrderSyncSettingsDataAccess.getRunById(input.id)),
  }),
})
