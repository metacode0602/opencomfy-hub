import { CrmTenantDetailClient } from "../../_components/crm-tenant-detail-client"

export default async function CrmTenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>
}) {
  const { tenantId } = await params
  return <CrmTenantDetailClient tenantId={tenantId} />
}
