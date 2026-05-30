"use client"

import * as React from "react"

import type { GlobalDashboardPeriod, GlobalDashboardSnapshot } from "@/lib/types/global-dashboard-api"
import { trpc } from "@/lib/trpc/client"

import { useGlobalDashboardQuery } from "./global-dashboard-query"

export type GlobalDashboardData = GlobalDashboardSnapshot | GlobalDashboardPeriod

type GlobalDashboardContextValue = {
  cardType: string
  setCardType: (cardType: string) => void
  query: ReturnType<typeof useGlobalDashboardQuery>["query"]
  data: GlobalDashboardData | undefined
  isSnapshot: boolean
  isLoading: boolean
  isError: boolean
  errorMessage: string | undefined
  refetch: () => void
}

const GlobalDashboardContext = React.createContext<GlobalDashboardContextValue | null>(null)

export function GlobalDashboardProvider({ children }: { children: React.ReactNode }) {
  const { query } = useGlobalDashboardQuery()
  const [cardType, setCardType] = React.useState("all")
  const isSnapshot = query.view === "snapshot"

  const snapshotQuery = trpc.dashboard.globalOps.getSnapshot.useQuery(
    { region: "all", cardType },
    {
      enabled: isSnapshot,
      staleTime: 30_000,
      refetchInterval: isSnapshot ? 60_000 : false,
    },
  )

  const periodQuery = trpc.dashboard.globalOps.getPeriod.useQuery(
    {
      granularity: query.view === "daily" ? "day" : "hour",
      periodStart: query.periodStart.toISOString(),
      periodEnd: query.periodEnd.toISOString(),
      comparePrevious: query.comparePrevious,
      region: "all",
      cardType,
    },
    {
      enabled: !isSnapshot,
      staleTime: 60_000,
    },
  )

  const activeQuery = isSnapshot ? snapshotQuery : periodQuery

  const value = React.useMemo(
    () => ({
      cardType,
      setCardType,
      query,
      data: activeQuery.data,
      isSnapshot,
      isLoading: activeQuery.isLoading,
      isError: activeQuery.isError,
      errorMessage: activeQuery.error?.message,
      refetch: () => {
        void snapshotQuery.refetch()
        void periodQuery.refetch()
      },
    }),
    [
      cardType,
      query,
      activeQuery.data,
      activeQuery.isLoading,
      activeQuery.isError,
      activeQuery.error?.message,
      isSnapshot,
      snapshotQuery,
      periodQuery,
    ],
  )

  return (
    <GlobalDashboardContext.Provider value={value}>{children}</GlobalDashboardContext.Provider>
  )
}

export function useGlobalDashboard() {
  const ctx = React.useContext(GlobalDashboardContext)
  if (!ctx) {
    throw new Error("useGlobalDashboard must be used within GlobalDashboardProvider")
  }
  return ctx
}
