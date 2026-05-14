import { notFound } from "next/navigation"
import { SupplierRelationListClient } from "../../../_components/supplier-relation-list-client"
import { isSupplierRelationKey } from "@/lib/types/supplier-domain"

export default async function SupplierRelationListPage({
  params,
}: {
  params: Promise<{ supplierId: string; relation: string }>
}) {
  const { supplierId, relation } = await params
  if (!isSupplierRelationKey(relation)) notFound()
  return <SupplierRelationListClient supplierId={supplierId} relation={relation} />
}
