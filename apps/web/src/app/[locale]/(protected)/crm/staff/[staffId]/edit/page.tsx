import { CrmStaffFormClient } from "../../../_components/crm-staff-form-client"

export default async function CrmStaffEditPage({
  params,
}: {
  params: Promise<{ staffId: string }>
}) {
  const { staffId } = await params
  return <CrmStaffFormClient staffId={staffId} />
}
