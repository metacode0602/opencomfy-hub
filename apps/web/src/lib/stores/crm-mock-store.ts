import { create } from "zustand"
import { persist } from "zustand/middleware"
import { crmSeedState } from "@/lib/data/crm-mock"
import { calendarWorkdayRecordId } from "@/lib/types/crm"
import type {
  AccountActivity,
  AccountManagerAssignment,
  ActivityTypeDefinition,
  CalendarWorkday,
  ConsumptionUsageDaily,
  ContractSnapshot,
  ConversionRecord,
  Customer,
  EngagementComment,
  EngagementDocument,
  FollowUpTask,
  LifecycleMilestone,
  MilestoneEvidence,
  ProjectTenant,
  RechargeOrder,
  TestVoucherIssue,
  UserStaff,
} from "@/lib/types/crm"

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export type CrmMockState = typeof crmSeedState & {
  resetToSeed: () => void
  upsertCustomer: (row: Customer) => void
  removeCustomer: (id: string) => void
  upsertProjectTenant: (row: ProjectTenant) => void
  removeProjectTenant: (id: string) => void
  upsertUserStaff: (row: UserStaff) => void
  removeUserStaff: (id: string) => void
  upsertAssignment: (row: AccountManagerAssignment) => void
  removeAssignment: (id: string) => void
  upsertVoucher: (row: TestVoucherIssue) => void
  removeVoucher: (id: string) => void
  upsertMilestone: (row: LifecycleMilestone) => void
  removeMilestone: (id: string) => void
  upsertEvidence: (row: MilestoneEvidence) => void
  removeEvidence: (id: string) => void
  upsertContract: (row: ContractSnapshot) => void
  removeContract: (id: string) => void
  upsertRecharge: (row: RechargeOrder) => void
  removeRecharge: (id: string) => void
  upsertUsageDaily: (row: ConsumptionUsageDaily) => void
  removeUsageDaily: (id: string) => void
  upsertConversion: (row: ConversionRecord) => void
  removeConversion: (id: string) => void
  upsertCalendarWorkday: (row: CalendarWorkday) => void
  removeCalendarWorkday: (id: string) => void
  upsertActivityType: (row: ActivityTypeDefinition) => void
  removeActivityType: (id: string) => void
  upsertActivity: (row: AccountActivity) => void
  removeActivity: (id: string) => void
  upsertDocument: (row: EngagementDocument) => void
  removeDocument: (id: string) => void
  upsertTask: (row: FollowUpTask) => void
  removeTask: (id: string) => void
  upsertComment: (row: EngagementComment) => void
  removeComment: (id: string) => void
  createCustomerId: () => string
  createStaffId: () => string
  createGenericId: (prefix: string) => string
  ensureCalendarRowId: (row: Omit<CalendarWorkday, "id">) => CalendarWorkday
}

function replaceById<T extends { id: string }>(list: T[], row: T): T[] {
  const i = list.findIndex((x) => x.id === row.id)
  if (i === -1) return [...list, row]
  const next = [...list]
  next[i] = row
  return next
}

const base = { ...crmSeedState }

export const useCrmMockStore = create<CrmMockState>()(
  persist(
    (set) => ({
      ...base,
      resetToSeed: () => set({ ...crmSeedState }),

      createCustomerId: () => newId("c"),
      createStaffId: () => newId("s"),
      createGenericId: (prefix) => newId(prefix),

      ensureCalendarRowId: (row) => ({
        ...row,
        id: calendarWorkdayRecordId({
          region_code: row.region_code,
          calendar_date: row.calendar_date,
        }),
      }),

      upsertCustomer: (row) =>
        set((s) => ({ customers: replaceById(s.customers, row) })),

      upsertProjectTenant: (row) =>
        set((s) => ({
          projectTenants: replaceById(s.projectTenants, row),
        })),
      removeProjectTenant: (id) =>
        set((s) => ({
          projectTenants: s.projectTenants.filter((x) => x.id !== id),
        })),

      removeCustomer: (id) =>
        set((s) => ({
          customers: s.customers.filter((x) => x.id !== id),
          accountManagerAssignments: s.accountManagerAssignments.filter(
            (x) => x.customer_id !== id,
          ),
          testVoucherIssues: s.testVoucherIssues.filter((x) => x.customer_id !== id),
          lifecycleMilestones: s.lifecycleMilestones.filter((x) => x.customer_id !== id),
          milestoneEvidence: s.milestoneEvidence.filter((me) => {
            const ms = s.lifecycleMilestones.find((m) => m.id === me.lifecycle_milestone_id)
            return ms == null || ms.customer_id !== id
          }),
          contractSnapshots: s.contractSnapshots.filter((x) => x.customer_id !== id),
          conversionRecords: s.conversionRecords.filter((x) => x.customer_id !== id),
          accountActivities: s.accountActivities.filter((x) => x.customer_id !== id),
          engagementDocuments: s.engagementDocuments.filter((x) => x.customer_id !== id),
          followUpTasks: s.followUpTasks.filter((x) => x.customer_id !== id),
          engagementComments: s.engagementComments.filter((x) => x.customer_id !== id),
        })),

      upsertUserStaff: (row) =>
        set((s) => ({ userStaff: replaceById(s.userStaff, row) })),
      removeUserStaff: (id) =>
        set((s) => ({
          userStaff: s.userStaff.filter((x) => x.id !== id),
          accountManagerAssignments: s.accountManagerAssignments.filter(
            (x) => x.user_staff_id !== id,
          ),
        })),

      upsertAssignment: (row) =>
        set((s) => ({
          accountManagerAssignments: replaceById(s.accountManagerAssignments, row),
        })),
      removeAssignment: (id) =>
        set((s) => ({
          accountManagerAssignments: s.accountManagerAssignments.filter((x) => x.id !== id),
        })),

      upsertVoucher: (row) =>
        set((s) => ({
          testVoucherIssues: replaceById(s.testVoucherIssues, row),
        })),
      removeVoucher: (id) =>
        set((s) => ({
          testVoucherIssues: s.testVoucherIssues.filter((x) => x.id !== id),
        })),

      upsertMilestone: (row) =>
        set((s) => ({
          lifecycleMilestones: replaceById(s.lifecycleMilestones, row),
        })),
      removeMilestone: (id) =>
        set((s) => ({
          lifecycleMilestones: s.lifecycleMilestones.filter((x) => x.id !== id),
          milestoneEvidence: s.milestoneEvidence.filter(
            (x) => x.lifecycle_milestone_id !== id,
          ),
        })),

      upsertEvidence: (row) =>
        set((s) => ({
          milestoneEvidence: replaceById(s.milestoneEvidence, row),
        })),
      removeEvidence: (id) =>
        set((s) => ({
          milestoneEvidence: s.milestoneEvidence.filter((x) => x.id !== id),
        })),

      upsertContract: (row) =>
        set((s) => ({
          contractSnapshots: replaceById(s.contractSnapshots, row),
        })),
      removeContract: (id) =>
        set((s) => ({
          contractSnapshots: s.contractSnapshots.filter((x) => x.id !== id),
        })),

      upsertRecharge: (row) =>
        set((s) => ({
          rechargeOrders: replaceById(s.rechargeOrders, row),
        })),
      removeRecharge: (id) =>
        set((s) => ({
          rechargeOrders: s.rechargeOrders.filter((x) => x.id !== id),
        })),

      upsertUsageDaily: (row) =>
        set((s) => ({
          consumptionUsageDaily: replaceById(s.consumptionUsageDaily, row),
        })),
      removeUsageDaily: (id) =>
        set((s) => ({
          consumptionUsageDaily: s.consumptionUsageDaily.filter((x) => x.id !== id),
        })),

      upsertConversion: (row) =>
        set((s) => ({
          conversionRecords: replaceById(s.conversionRecords, row),
        })),
      removeConversion: (id) =>
        set((s) => ({
          conversionRecords: s.conversionRecords.filter((x) => x.id !== id),
        })),

      upsertCalendarWorkday: (row) =>
        set((s) => {
          const withId = calendarWorkdayRecordId({
            region_code: row.region_code,
            calendar_date: row.calendar_date,
          })
          const nextRow: CalendarWorkday = { ...row, id: withId }
          const withoutOld = s.calendarWorkdays.filter((x) => x.id !== row.id && x.id !== withId)
          return { calendarWorkdays: [...withoutOld, nextRow] }
        }),
      removeCalendarWorkday: (id) =>
        set((s) => ({
          calendarWorkdays: s.calendarWorkdays.filter((x) => x.id !== id),
        })),

      upsertActivityType: (row) =>
        set((s) => ({
          activityTypeDefinitions: replaceById(s.activityTypeDefinitions, row),
        })),
      removeActivityType: (id) =>
        set((s) => ({
          activityTypeDefinitions: s.activityTypeDefinitions.filter((x) => x.id !== id),
          accountActivities: s.accountActivities.filter((x) => x.activity_type_id !== id),
        })),

      upsertActivity: (row) =>
        set((s) => ({
          accountActivities: replaceById(s.accountActivities, row),
        })),
      removeActivity: (id) =>
        set((s) => ({
          accountActivities: s.accountActivities.filter((x) => x.id !== id),
          followUpTasks: s.followUpTasks.filter((x) => x.source_account_activity_id !== id),
          engagementComments: s.engagementComments.filter(
            (x) => x.account_activity_id !== id,
          ),
        })),

      upsertDocument: (row) =>
        set((s) => ({
          engagementDocuments: replaceById(s.engagementDocuments, row),
        })),
      removeDocument: (id) =>
        set((s) => ({
          engagementDocuments: s.engagementDocuments.filter((x) => x.id !== id),
        })),

      upsertTask: (row) =>
        set((s) => ({
          followUpTasks: replaceById(s.followUpTasks, row),
        })),
      removeTask: (id) =>
        set((s) => ({
          followUpTasks: s.followUpTasks.filter((x) => x.id !== id),
        })),

      upsertComment: (row) =>
        set((s) => ({
          engagementComments: replaceById(s.engagementComments, row),
        })),
      removeComment: (id) =>
        set((s) => ({
          engagementComments: s.engagementComments.filter((x) => x.id !== id),
        })),
    }),
    {
      name: "crm-mock-store-v3",
      version: 3,
      migrate: () => ({ ...crmSeedState }),
    },
  ),
)
