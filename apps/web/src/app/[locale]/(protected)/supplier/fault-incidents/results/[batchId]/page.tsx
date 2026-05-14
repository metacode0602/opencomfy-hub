import { SupplierOpsBatchResultClient } from "../../../_components/supplier-ops-batch-result-client"

export default async function SupplierFaultIncidentResultPage({
  params,
}: {
  params: Promise<{ batchId: string }>
}) {
  const { batchId } = await params
  return <SupplierOpsBatchResultClient kind="fault-incidents" batchId={decodeURIComponent(batchId)} />
}
