import { CrmTenantDetailClient } from "../../_components/crm-tenant-detail-client"

export default async function CrmTenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <CrmTenantDetailClient tenantId={id} />
}
