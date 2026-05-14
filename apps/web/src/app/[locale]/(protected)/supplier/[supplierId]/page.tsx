import { SupplierDetailClient } from "../_components/supplier-detail-client"

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ supplierId: string }>
}) {
  const { supplierId } = await params
  return <SupplierDetailClient supplierId={supplierId} />
}
