import { SupplierOpsBatchResultClient } from "../../../_components/supplier-ops-batch-result-client"

export default async function SupplierOnlineTaskResultPage({
  params,
}: {
  params: Promise<{ batchId: string }>
}) {
  const { batchId } = await params
  return <SupplierOpsBatchResultClient kind="online-tasks" batchId={decodeURIComponent(batchId)} />
}
