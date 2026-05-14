import { SupplierSupplierFormClient } from "../../_components/supplier-supplier-form-client"

export default async function SupplierEditPage({
  params,
}: {
  params: Promise<{ supplierId: string }>
}) {
  const { supplierId } = await params
  return <SupplierSupplierFormClient supplierId={supplierId} mode="edit" />
}
