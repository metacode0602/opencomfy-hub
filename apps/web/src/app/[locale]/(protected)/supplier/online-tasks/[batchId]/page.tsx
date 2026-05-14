import { SupplierOpsBatchDetailClient } from "../../_components/supplier-ops-batch-detail-client"

export default async function SupplierOnlineTaskDetailPage({
  params,
}: {
  params: Promise<{ batchId: string }>
}) {
  const { batchId } = await params
  return <SupplierOpsBatchDetailClient kind="online-tasks" batchId={decodeURIComponent(batchId)} />
}
