'use client'

import { WorkbenchConsumptionTrendCard } from './workbench/workbench-consumption-trend-card'
import { WorkbenchHeader } from './workbench/workbench-header'
import { WorkbenchKpiSection } from './workbench/workbench-kpi-section'
import { WorkbenchPendingBillsCard } from './workbench/workbench-pending-bills-card'
import { WorkbenchPeriodProvider } from './workbench/workbench-period-context'
import { WorkbenchPeriodSelector } from './workbench/workbench-period-selector'
import { WorkbenchProductLineCard } from './workbench/workbench-product-line-card'
import { WorkbenchRecentActivitiesCard } from './workbench/workbench-recent-activities-card'
import { WorkbenchRecentProjectsCard } from './workbench/workbench-recent-projects-card'

export function WorkbenchContent() {
  return (
    <WorkbenchPeriodProvider>
      <div className="space-y-6">
        <WorkbenchHeader />
        <WorkbenchPeriodSelector />
        <WorkbenchKpiSection />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <WorkbenchConsumptionTrendCard />
          <WorkbenchProductLineCard />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <WorkbenchRecentProjectsCard />
          <WorkbenchRecentActivitiesCard />
        </div>

        <WorkbenchPendingBillsCard />
      </div>
    </WorkbenchPeriodProvider>
  )
}
