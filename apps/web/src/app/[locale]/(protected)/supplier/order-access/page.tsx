import { AppShell } from '@/components/dashboard/app-shell'
import { OnboardingBatchesContent } from '../_components/onboarding-batches-content'

export default function SupplierOrderAccessPage() {
  return (
    <AppShell>
      <OnboardingBatchesContent routeKind="order-access" />
    </AppShell>
  )
}
