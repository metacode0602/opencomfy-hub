import { AppShell } from '@/components/dashboard/app-shell'
import { TestHoldDetailContent } from '../../_components/test-hold-detail-content'

interface TestHoldDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function TestHoldDetailPage({ params }: TestHoldDetailPageProps) {
  const { id } = await params

  return (
    <AppShell>
      <TestHoldDetailContent holdId={id} />
    </AppShell>
  )
}
