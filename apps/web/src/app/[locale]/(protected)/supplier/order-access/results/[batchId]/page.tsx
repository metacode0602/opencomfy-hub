import { SupplierOpsBatchResultClient } from "../../../_components/supplier-ops-batch-result-client"

export default async function SupplierOrderAccessResultPage({
  params,
}: {
  params: Promise<{ batchId: string }>
}) {
  const { batchId } = await params
  return <SupplierOpsBatchResultClient kind="order-access" batchId={decodeURIComponent(batchId)} />
}
