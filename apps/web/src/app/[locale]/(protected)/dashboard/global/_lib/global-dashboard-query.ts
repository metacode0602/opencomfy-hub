"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import type { GlobalDashboardView } from "@/lib/types/global-dashboard-api"

export type GlobalDashboardQuery = {
  view: GlobalDashboardView
  periodStart: Date
  periodEnd: Date
  comparePrevious: boolean
}

const TZ_OFFSET_MS = 8 * 60 * 60 * 1000

function pad2(n: number) {
  return n.toString().padStart(2, "0")
}

export function formatDateKey(d: Date) {
  const cst = new Date(d.getTime() + TZ_OFFSET_MS)
  return `${cst.getUTCFullYear()}-${pad2(cst.getUTCMonth() + 1)}-${pad2(cst.getUTCDate())}`
}

export function formatDateTimeKey(d: Date) {
  const cst = new Date(d.getTime() + TZ_OFFSET_MS)
  return `${formatDateKey(d)}T${pad2(cst.getUTCHours())}`
}

export function parseDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const day = Number(m[3])
  return new Date(Date.UTC(y, mo, day) - TZ_OFFSET_MS)
}

export function parseDateTimeKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})$/.exec(key)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const day = Number(m[3])
  const hour = Number(m[4])
  return new Date(Date.UTC(y, mo, day, hour) - TZ_OFFSET_MS)
}

export function startOfLocalDay(d: Date) {
  return parseDateKey(formatDateKey(d))!
}

export function endOfLocalDay(d: Date) {
  const start = startOfLocalDay(d)
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1)
}

export function defaultDailyRange(now = new Date()) {
  const end = endOfLocalDay(now)
  const start = startOfLocalDay(new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000))
  return { periodStart: start, periodEnd: end }
}

export function defaultHourlyRange(now = new Date()) {
  const end = new Date(now)
  end.setMinutes(0, 0, 0)
  const start = new Date(end.getTime() - 23 * 60 * 60 * 1000)
  return { periodStart: start, periodEnd: end }
}

export function parseGlobalDashboardQuery(searchParams: URLSearchParams): GlobalDashboardQuery {
  const viewParam = searchParams.get("view")
  const view: GlobalDashboardView =
    viewParam === "daily" || viewParam === "hourly" ? viewParam : "snapshot"

  const comparePrevious = searchParams.get("compare") === "1"
  const now = new Date()

  if (view === "daily") {
    const startKey = searchParams.get("start")
    const endKey = searchParams.get("end")
    const defaults = defaultDailyRange(now)
    const periodStart = startKey ? parseDateKey(startKey) ?? defaults.periodStart : defaults.periodStart
    const periodEnd = endKey ? endOfLocalDay(parseDateKey(endKey) ?? defaults.periodEnd) : defaults.periodEnd
    return { view, periodStart, periodEnd, comparePrevious }
  }

  if (view === "hourly") {
    const startKey = searchParams.get("start")
    const endKey = searchParams.get("end")
    const defaults = defaultHourlyRange(now)
    const periodStart = startKey ? parseDateTimeKey(startKey) ?? defaults.periodStart : defaults.periodStart
    const periodEnd = endKey ? parseDateTimeKey(endKey) ?? defaults.periodEnd : defaults.periodEnd
    return { view, periodStart, periodEnd, comparePrevious }
  }

  return {
    view: "snapshot",
    periodStart: now,
    periodEnd: now,
    comparePrevious: false,
  }
}

export function buildGlobalDashboardSearchParams(
  query: GlobalDashboardQuery,
  prev: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams(prev.toString())
  next.set("view", query.view)

  if (query.view === "snapshot") {
    next.delete("start")
    next.delete("end")
    next.delete("compare")
    return next
  }

  if (query.view === "daily") {
    next.set("start", formatDateKey(query.periodStart))
    next.set("end", formatDateKey(query.periodEnd))
  } else {
    next.set("start", formatDateTimeKey(query.periodStart))
    next.set("end", formatDateTimeKey(query.periodEnd))
  }

  if (query.comparePrevious) next.set("compare", "1")
  else next.delete("compare")

  return next
}

export function formatQueryScopeLabel(query: GlobalDashboardQuery, now = new Date()) {
  if (query.view === "snapshot") {
    const cst = new Date(now.getTime() + TZ_OFFSET_MS)
    return `实时截面 · ${cst.getUTCFullYear()}-${pad2(cst.getUTCMonth() + 1)}-${pad2(cst.getUTCDate())} ${pad2(cst.getUTCHours())}:${pad2(cst.getUTCMinutes())}:${pad2(cst.getUTCSeconds())}`
  }

  if (query.view === "daily") {
    return `按日分析 · ${formatDateKey(query.periodStart)} ~ ${formatDateKey(query.periodEnd)}`
  }

  const fmtHour = (d: Date) => {
    const cst = new Date(d.getTime() + TZ_OFFSET_MS)
    return `${formatDateKey(d)} ${pad2(cst.getUTCHours())}:00`
  }
  return `按小时分析 · ${fmtHour(query.periodStart)} ~ ${fmtHour(query.periodEnd)}`
}

export function useGlobalDashboardQuery() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const query = React.useMemo(() => parseGlobalDashboardQuery(searchParams), [searchParams])

  const setQuery = React.useCallback(
    (patch: Partial<GlobalDashboardQuery> | ((prev: GlobalDashboardQuery) => GlobalDashboardQuery)) => {
      const nextQuery = typeof patch === "function" ? patch(query) : { ...query, ...patch }
      const params = buildGlobalDashboardSearchParams(nextQuery, searchParams)
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, query, router, searchParams],
  )

  const setView = React.useCallback(
    (view: GlobalDashboardView) => {
      if (view === "snapshot") {
        setQuery({ view: "snapshot", comparePrevious: false })
        return
      }
      if (view === "daily") {
        setQuery({ view: "daily", ...defaultDailyRange(), comparePrevious: query.comparePrevious })
        return
      }
      setQuery({ view: "hourly", ...defaultHourlyRange(), comparePrevious: query.comparePrevious })
    },
    [query.comparePrevious, setQuery],
  )

  return { query, setQuery, setView }
}
