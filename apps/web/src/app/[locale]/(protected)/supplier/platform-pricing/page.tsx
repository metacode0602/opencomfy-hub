import { AppShell } from '@/components/dashboard/app-shell'
import { PlatformPricingContent } from '../components/platform-pricing-content'
import { platformPricingDataAccess } from '@/lib/server/dataaccess/platform-pricing'

export default async function PlatformPricingPage() {
  const listData = platformPricingDataAccess.getListPage()

  return (
    <AppShell>
      <PlatformPricingContent initialData={listData} />
    </AppShell>
  )
}
