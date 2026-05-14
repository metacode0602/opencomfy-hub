import { SupplierOpsBatchDetailClient } from "../../_components/supplier-ops-batch-detail-client"

export default async function SupplierFaultIncidentDetailPage({
  params,
}: {
  params: Promise<{ batchId: string }>
}) {
  const { batchId } = await params
  return <SupplierOpsBatchDetailClient kind="fault-incidents" batchId={decodeURIComponent(batchId)} />
}
