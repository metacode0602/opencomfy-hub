import { notFound } from "next/navigation"
import { SupplierRelationFormClient } from "../../../../_components/supplier-relation-form-client"
import { isSupplierRelationKey } from "@/lib/types/supplier-domain"

export default async function SupplierRelationNewPage({
  params,
}: {
  params: Promise<{ supplierId: string; relation: string }>
}) {
  const { supplierId, relation } = await params
  if (!isSupplierRelationKey(relation)) notFound()
  return <SupplierRelationFormClient supplierId={supplierId} relation={relation} mode="create" />
}
