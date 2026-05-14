import { notFound } from "next/navigation"
import { CrmTenantRelationListClient } from "../../../../_components/crm-tenant-relation-list-client"
import { isTenantRelationKey } from "@/lib/types/crm"

export default async function CrmTenantRelationListPage({
  params,
}: {
  params: Promise<{ tenantId: string; relation: string }>
}) {
  const { tenantId, relation } = await params
  if (!isTenantRelationKey(relation)) notFound()
  return <CrmTenantRelationListClient tenantId={tenantId} relation={relation} />
}
