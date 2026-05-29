import type { GlobalKpiItem } from "@/lib/types/global-dashboard-api"

export function formatKpiValue(kpi: GlobalKpiItem, isSnapshot: boolean): string {
  if (!isSnapshot && kpi.periodPrimary) return kpi.periodPrimary

  const m = kpi.metric
  if ("deviceCount" in m && kpi.unit.includes("卡 · 台")) {
    return `${m.gpuCount.toLocaleString()} 卡 · ${(m.deviceCount ?? 0).toLocaleString()} 台`
  }
  if (kpi.unit === "卡") {
    return m.gpuCount.toLocaleString()
  }
  if (kpi.unit === "台" || kpi.unit === "个") {
    return (m.deviceCount ?? 0).toLocaleString()
  }
  return m.gpuCount.toLocaleString()
}

export function formatGpuTotalSnapshotSubtitle(kpi: GlobalKpiItem): string | null {
  if (kpi.key !== "gpu_total" || kpi.targetGpuCount == null) return null
  return `/ ${kpi.targetGpuCount.toLocaleString()} 卡`
}

export function formatGpuTotalSnapshotDelta(kpi: GlobalKpiItem): {
  label: string
  up: boolean
} {
  if (kpi.key !== "gpu_total" || kpi.targetGpuCount == null) {
    return { label: "与资源总览同口径", up: true }
  }
  const inventory = kpi.metric.gpuCount
  const gap = kpi.targetGpuCount - inventory
  if (gap === 0) return { label: "库存与目标一致", up: true }
  if (gap > 0) {
    return { label: `缺口 +${gap.toLocaleString()} 卡`, up: false }
  }
  return { label: `超出目标 +${Math.abs(gap).toLocaleString()} 卡`, up: false }
}

export function formatCompactHours(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toLocaleString()
}
