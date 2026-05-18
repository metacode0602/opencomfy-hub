import { useCrmMockStore } from "@/lib/stores/crm-mock-store"

export function useCustomerName(customerId: string | null | undefined) {
  const c = useCrmMockStore((s) => s.customers.find((x) => x.id === customerId))
  return c?.account_name ?? c?.name ?? customerId ?? "—"
}

export function useStaffName(staffId: string | null | undefined) {
  const u = useCrmMockStore((s) => s.userStaff.find((x) => x.id === staffId))
  return u?.display_name ?? staffId ?? "—"
}

export function useActivityTypeName(typeId: string | null | undefined) {
  const d = useCrmMockStore((s) =>
    s.activityTypeDefinitions.find((x) => x.id === typeId),
  )
  return d?.display_name ?? typeId ?? "—"
}

export function useMilestoneLabel(milestoneId: string | null | undefined) {
  const m = useCrmMockStore((s) =>
    s.lifecycleMilestones.find((x) => x.id === milestoneId),
  )
  if (!m) return milestoneId ?? "—"
  return `${m.milestone_type} · ${m.milestone_date}`
}

export function useActivityTitle(activityId: string | null | undefined) {
  const a = useCrmMockStore((s) => s.accountActivities.find((x) => x.id === activityId))
  return a?.title_snapshot ?? activityId ?? "—"
}
