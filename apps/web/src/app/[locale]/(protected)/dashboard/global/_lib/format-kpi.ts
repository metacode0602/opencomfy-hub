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

export function formatCompactHours(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toLocaleString()
}
