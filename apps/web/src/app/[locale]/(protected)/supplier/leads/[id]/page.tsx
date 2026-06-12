import { AppShell } from '@/components/dashboard/app-shell'
import { SupplyChainLeadDetailContent } from '../../_components/supply-chain-lead-detail-content'

export default async function SupplyChainLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <AppShell>
      <SupplyChainLeadDetailContent leadId={id} />
    </AppShell>
  )
}
