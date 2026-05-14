import { CrmContractDetailClient } from "../../_components/crm-contract-detail-client"

export default async function CrmContractDetailPage({
  params,
}: {
  params: Promise<{ contractId: string }>
}) {
  const { contractId } = await params
  return <CrmContractDetailClient contractId={contractId} />
}
