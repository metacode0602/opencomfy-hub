import { AppShell } from '@/components/dashboard/app-shell'
import { OnboardingBatchesContent } from '../_components/onboarding-batches-content'

export default function SupplierOnlineTasksPage() {
  return (
    <AppShell>
      <OnboardingBatchesContent routeKind="online-tasks" />
    </AppShell>
  )
}
