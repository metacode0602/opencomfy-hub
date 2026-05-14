import { notFound } from "next/navigation"
import { CrmTenantRelationDetailClient } from "../../../../../_components/crm-tenant-relation-detail-client"
import { isTenantRelationKey } from "@/lib/types/crm"

export default async function CrmTenantRelationDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string; relation: string; recordId: string }>
}) {
  const { tenantId, relation, recordId } = await params
  if (!isTenantRelationKey(relation)) notFound()
  return (
    <CrmTenantRelationDetailClient
      tenantId={tenantId}
      relation={relation}
      recordId={recordId}
    />
  )
}
