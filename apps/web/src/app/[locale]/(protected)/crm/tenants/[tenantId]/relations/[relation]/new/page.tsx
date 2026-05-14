import { Suspense } from "react"
import { notFound } from "next/navigation"
import { CrmTenantRelationFormClient } from "../../../../../_components/crm-tenant-relation-form-client"
import { isTenantRelationKey } from "@/lib/types/crm"

export default async function CrmTenantRelationNewPage({
  params,
}: {
  params: Promise<{ tenantId: string; relation: string }>
}) {
  const { tenantId, relation } = await params
  if (!isTenantRelationKey(relation)) notFound()
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">加载中…</div>}>
      <CrmTenantRelationFormClient tenantId={tenantId} relation={relation} mode="create" />
    </Suspense>
  )
}
