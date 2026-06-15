import { AppShell } from '@/components/dashboard/app-shell'
import { BareMetalOrderDetailContent } from '../../_components/bare-metal-order-detail-content'

interface BareMetalOrderDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function BareMetalOrderDetailPage({ params }: BareMetalOrderDetailPageProps) {
  const { id } = await params

  return (
    <AppShell>
      <BareMetalOrderDetailContent orderId={id} />
    </AppShell>
  )
}
