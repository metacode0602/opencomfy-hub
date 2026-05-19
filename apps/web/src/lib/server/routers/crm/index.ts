import { createTRPCRouter, protectedProcedure, adminProcedure } from '../trpc'
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
import {
  customerUpsertSchema,
  projectUpsertSchema,
  staffUpsertSchema,
} from './schemas'

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
      .input(z.object({ search: z.string().optional(), status: z.string().optional() }).optional())
      .query(({ input }) => staffDataAccess.list(input)),
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
