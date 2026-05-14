import { CrmCalendarFormClient } from "../../../_components/crm-calendar-form-client"

export default async function CrmCalendarEditPage({
  params,
}: {
  params: Promise<{ recordId: string }>
}) {
  const { recordId } = await params
  return <CrmCalendarFormClient recordId={recordId} />
}
