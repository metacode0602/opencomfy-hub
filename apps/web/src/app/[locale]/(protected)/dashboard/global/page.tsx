"use client"

import { Suspense } from "react"

import { AlertsTimelineCard } from "./_components/alerts-timeline-card"
import { ClusterStatusCard } from "./_components/cluster-status-card"
import { DiscrepancyTableCard } from "./_components/discrepancy-table-card"
import { GlobalKpiSection } from "./_components/global-kpi-section"
import { GlobalTodosCard } from "./_components/global-todos-card"
import { LifecycleFlowCard } from "./_components/lifecycle-flow-card"
import { ResourcePoolChartCard } from "./_components/resource-pool-chart-card"
import { GlobalDashboardProvider } from "./_lib/global-dashboard-context"

function GlobalOpsDashboardContent() {
  return (
    <GlobalDashboardProvider>
    <div className="space-y-4 bg-background p-4 md:p-6">
      {/* <GlobalDashboardScopeBar /> */}
      {/* <GlobalDashboardHeader /> */}
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
    </GlobalDashboardProvider>
  )
}

export default function GlobalOpsDashboardPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">加载大盘…</div>}>
      <GlobalOpsDashboardContent />
    </Suspense>
  )
}
