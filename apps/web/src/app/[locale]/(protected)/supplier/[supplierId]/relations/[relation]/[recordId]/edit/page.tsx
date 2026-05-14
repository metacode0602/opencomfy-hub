import { notFound } from "next/navigation"
import { SupplierRelationFormClient } from "../../../../../_components/supplier-relation-form-client"
import { isSupplierRelationKey } from "@/lib/types/supplier-domain"

export default async function SupplierRelationEditPage({
  params,
}: {
  params: Promise<{ supplierId: string; relation: string; recordId: string }>
}) {
  const { supplierId, relation, recordId } = await params
  if (!isSupplierRelationKey(relation)) notFound()
  return (
    <SupplierRelationFormClient
      supplierId={supplierId}
      relation={relation}
      recordId={recordId}
      mode="edit"
    />
  )
}
