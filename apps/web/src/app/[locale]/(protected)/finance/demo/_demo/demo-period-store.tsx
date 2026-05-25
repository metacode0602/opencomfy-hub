"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  DEMO_PRICE_WINDOWS,
  MOCK_COST_ROWS,
  MOCK_INCOME_ROWS,
  sumCost,
  sumIncome,
  type DemoCostSummaryRow,
} from "./mock-data"
import type { PlatformIncomeMonthly } from "@/lib/types/finance"

export type UploadSlotStatus = "empty" | "done"

export type DemoUploadSlot = {
  status: UploadSlotStatus
  fileName: string
  rowCount: number
}

export type DemoTenantBillSlot = {
  windowId: string
  windowStart: string
  windowEnd: string
  upload: DemoUploadSlot
}

type DemoPeriodState = {
  incomeComputed: boolean
  costComputed: boolean
  published: boolean
  customerUpload: DemoUploadSlot
  baremetalUpload: DemoUploadSlot
  tenantBillSlots: DemoTenantBillSlot[]
  incomeRows: PlatformIncomeMonthly[]
  costRows: DemoCostSummaryRow[]
  supplementaryDraft: Record<string, string>
  supplementarySaved: boolean
}

type DemoPeriodContextValue = DemoPeriodState & {
  totalIncome: number
  totalCost: number
  totalGrossProfit: number
  grossProfitDisplay: number
  canComputeIncome: boolean
  canComputeCost: boolean
  canPublish: boolean
  simulateUploadCustomer: () => void
  simulateUploadBaremetal: () => void
  simulateUploadTenantBill: (windowId: string) => void
  simulateComputeIncome: () => Promise<void>
  simulateComputeCost: () => Promise<void>
  setSupplementary: (incomeId: string, value: string) => void
  simulateSaveSupplementary: () => void
  simulatePublish: () => Promise<void>
  resetDemo: () => void
}

const DemoPeriodContext = createContext<DemoPeriodContextValue | null>(null)

function initialTenantBillSlots(): DemoTenantBillSlot[] {
  return DEMO_PRICE_WINDOWS.map((w) => ({
    windowId: w.id,
    windowStart: w.windowStart,
    windowEnd: w.windowEnd,
    upload: { status: "empty", fileName: "", rowCount: 0 },
  }))
}

function initialState(): DemoPeriodState {
  return {
    incomeComputed: false,
    costComputed: false,
    published: false,
    customerUpload: { status: "empty", fileName: "", rowCount: 0 },
    baremetalUpload: { status: "empty", fileName: "", rowCount: 0 },
    tenantBillSlots: initialTenantBillSlots(),
    incomeRows: [],
    costRows: [],
    supplementaryDraft: {},
    supplementarySaved: true,
  }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export function DemoPeriodProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoPeriodState>(initialState)

  const totals = useMemo(() => {
    const income = state.incomeComputed ? sumIncome(state.incomeRows) : { totalIncome: 0 }
    const cost = state.costComputed ? sumCost(state.costRows) : { totalCost: 0, totalGrossProfit: 0 }
    return {
      totalIncome: income.totalIncome,
      totalCost: cost.totalCost,
      totalGrossProfit: cost.totalGrossProfit,
      grossProfitDisplay: income.totalIncome - cost.totalCost,
    }
  }, [state.incomeComputed, state.incomeRows, state.costComputed, state.costRows])

  const canComputeIncome =
    state.customerUpload.status === "done" &&
    state.baremetalUpload.status === "done" &&
    !state.published

  const tenantBillReady =
    state.tenantBillSlots.length > 0 &&
    state.tenantBillSlots.every((s) => s.upload.status === "done")

  const canComputeCost =
    tenantBillReady && state.baremetalUpload.status === "done" && !state.published

  const supplementaryDirty = useMemo(() => {
    if (!state.incomeComputed) return false
    return state.incomeRows.some((row) => {
      const draft = state.supplementaryDraft[row.id] ?? "0"
      return draft !== (row.supplementary_consumption ?? "0")
    })
  }, [state.incomeComputed, state.incomeRows, state.supplementaryDraft])

  const canPublish =
    state.incomeComputed &&
    state.costComputed &&
    !supplementaryDirty &&
    state.supplementarySaved &&
    !state.published

  const simulateUploadCustomer = useCallback(() => {
    setState((s) => ({
      ...s,
      customerUpload: {
        status: "done",
        fileName: "客户消费明细_2025-04.xlsx",
        rowCount: 156,
      },
    }))
  }, [])

  const simulateUploadBaremetal = useCallback(() => {
    setState((s) => ({
      ...s,
      baremetalUpload: {
        status: "done",
        fileName: "裸金属消费订单_2025-04.xlsx",
        rowCount: 42,
      },
    }))
  }, [])

  const simulateUploadTenantBill = useCallback((windowId: string) => {
    setState((s) => ({
      ...s,
      tenantBillSlots: s.tenantBillSlots.map((slot) =>
        slot.windowId === windowId
          ? {
              ...slot,
              upload: {
                status: "done",
                fileName: `账户消费详情_${slot.windowStart}_${slot.windowEnd}.xlsx`,
                rowCount: slot.windowId === "win-1" ? 892 : 904,
              },
            }
          : slot,
      ),
    }))
  }, [])

  const simulateComputeIncome = useCallback(async () => {
    await delay(800)
    const rows = MOCK_INCOME_ROWS.map((r) => ({ ...r, supplementary_consumption: "0" }))
    const draft: Record<string, string> = {}
    for (const r of rows) draft[r.id] = "0"
    setState((s) => ({
      ...s,
      incomeComputed: true,
      incomeRows: rows,
      supplementaryDraft: draft,
      supplementarySaved: true,
    }))
  }, [])

  const simulateComputeCost = useCallback(async () => {
    await delay(900)
    setState((s) => ({
      ...s,
      costComputed: true,
      costRows: MOCK_COST_ROWS.map((r) => ({ ...r })),
    }))
  }, [])

  const setSupplementary = useCallback((incomeId: string, value: string) => {
    setState((s) => ({
      ...s,
      supplementaryDraft: { ...s.supplementaryDraft, [incomeId]: value },
      supplementarySaved: false,
    }))
  }, [])

  const simulateSaveSupplementary = useCallback(() => {
    setState((s) => {
      const incomeRows = s.incomeRows.map((row) => {
        const sup = s.supplementaryDraft[row.id] ?? "0"
        const total =
          (Number(sup) || 0) +
          (Number(row.balance_consumption) || 0) +
          (Number(row.bare_metal_consumption) || 0)
        return {
          ...row,
          supplementary_consumption: sup,
          total_consumption: String(total),
        }
      })
      return {
        ...s,
        incomeRows,
        supplementarySaved: true,
      }
    })
  }, [])

  const simulatePublish = useCallback(async () => {
    await delay(600)
    setState((s) => ({ ...s, published: true }))
  }, [])

  const resetDemo = useCallback(() => {
    setState(initialState())
  }, [])

  const value: DemoPeriodContextValue = {
    ...state,
    ...totals,
    canComputeIncome,
    canComputeCost,
    canPublish,
    simulateUploadCustomer,
    simulateUploadBaremetal,
    simulateUploadTenantBill,
    simulateComputeIncome,
    simulateComputeCost,
    setSupplementary,
    simulateSaveSupplementary,
    simulatePublish,
    resetDemo,
  }

  return (
    <DemoPeriodContext.Provider value={value}>{children}</DemoPeriodContext.Provider>
  )
}

export function useDemoPeriod() {
  const ctx = useContext(DemoPeriodContext)
  if (!ctx) {
    throw new Error("useDemoPeriod must be used within DemoPeriodProvider")
  }
  return ctx
}
