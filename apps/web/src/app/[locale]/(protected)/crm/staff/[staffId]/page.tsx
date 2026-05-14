import { CrmStaffDetailClient } from "../../_components/crm-staff-detail-client"

export default async function CrmStaffDetailPage({
  params,
}: {
  params: Promise<{ staffId: string }>
}) {
  const { staffId } = await params
  return <CrmStaffDetailClient staffId={staffId} />
}
