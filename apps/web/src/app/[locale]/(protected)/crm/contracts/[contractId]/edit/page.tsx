import { CrmContractFormClient } from "../../../_components/crm-contract-form-client"

export default async function CrmContractEditPage({
  params,
}: {
  params: Promise<{ contractId: string }>
}) {
  const { contractId } = await params
  return <CrmContractFormClient contractId={contractId} />
}
