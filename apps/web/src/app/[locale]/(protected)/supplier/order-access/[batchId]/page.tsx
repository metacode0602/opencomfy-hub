import { SupplierOpsBatchDetailClient } from "../../_components/supplier-ops-batch-detail-client"

export default async function SupplierOrderAccessDetailPage({
  params,
}: {
  params: Promise<{ batchId: string }>
}) {
  const { batchId } = await params
  return <SupplierOpsBatchDetailClient kind="order-access" batchId={decodeURIComponent(batchId)} />
}
