import { CrmTimelineDetailClient } from "../../_components/crm-timeline-detail-client"

export default async function CrmTimelineDetailPage({
  params,
}: {
  params: Promise<{ activityId: string }>
}) {
  const { activityId } = await params
  return <CrmTimelineDetailClient activityId={activityId} />
}
