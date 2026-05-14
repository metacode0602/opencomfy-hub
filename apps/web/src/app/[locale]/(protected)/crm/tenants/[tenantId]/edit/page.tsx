import { CrmTenantFormClient } from "../../../_components/crm-tenant-form-client"

export default async function CrmTenantEditPage({
  params,
}: {
  params: Promise<{ tenantId: string }>
}) {
  const { tenantId } = await params
  return <CrmTenantFormClient tenantId={tenantId} />
}
