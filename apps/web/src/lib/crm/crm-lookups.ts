import { trpc } from "@/lib/trpc/client"

export function useCustomerName(customerId: string | null | undefined) {
  const { data } = trpc.crm.customers.getById.useQuery(
    { id: customerId! },
    { enabled: !!customerId },
  )
  return data?.name ?? customerId ?? "—"
}

export function useStaffName(staffId: string | null | undefined) {
  const { data } = trpc.crm.staff.getById.useQuery(
    { id: staffId! },
    { enabled: !!staffId },
  )
  return data?.display_name ?? staffId ?? "—"
}

export function useActivityTypeName(typeId: string | null | undefined) {
  const { data: types = [] } = trpc.crm.calendar.listActivityTypes.useQuery()
  const d = types.find((x) => x.id === typeId)
  return d?.display_name ?? typeId ?? "—"
}

export function useMilestoneLabel(milestoneId: string | null | undefined) {
  return milestoneId ?? "—"
}

export function useActivityTitle(activityId: string | null | undefined) {
  return activityId ?? "—"
}
