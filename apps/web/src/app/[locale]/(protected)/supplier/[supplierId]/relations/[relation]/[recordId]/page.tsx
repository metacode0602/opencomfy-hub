import { notFound } from "next/navigation"
import { SupplierRelationDetailClient } from "../../../../_components/supplier-relation-detail-client"
import { isSupplierRelationKey } from "@/lib/types/supplier-domain"

export default async function SupplierRelationDetailPage({
  params,
}: {
  params: Promise<{ supplierId: string; relation: string; recordId: string }>
}) {
  const { supplierId, relation, recordId } = await params
  if (!isSupplierRelationKey(relation)) notFound()
  return <SupplierRelationDetailClient supplierId={supplierId} relation={relation} recordId={recordId} />
}
