import { CrmCalendarDetailClient } from "../../_components/crm-calendar-detail-client"

export default async function CrmCalendarDetailPage({
  params,
}: {
  params: Promise<{ recordId: string }>
}) {
  const { recordId } = await params
  return <CrmCalendarDetailClient recordId={recordId} />
}
