"use client"

import { AlertsTimelineCard } from "./_components/alerts-timeline-card"
import { ClusterStatusCard } from "./_components/cluster-status-card"
import { DiscrepancyTableCard } from "./_components/discrepancy-table-card"
import { GlobalKpiSection } from "./_components/global-kpi-section"
import { GlobalTodosCard } from "./_components/global-todos-card"
import { LifecycleFlowCard } from "./_components/lifecycle-flow-card"
import { ResourcePoolChartCard } from "./_components/resource-pool-chart-card"

export default function GlobalOpsDashboardPage() {
  return (
    <div className="space-y-4 bg-background p-4 md:p-6">
      <GlobalKpiSection />

      <div className="grid gap-4 lg:grid-cols-12">
        <LifecycleFlowCard />
        <ResourcePoolChartCard />
        <ClusterStatusCard />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <DiscrepancyTableCard />
        <AlertsTimelineCard />
        <GlobalTodosCard />
      </div>
    </div>
  )
}
