'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  defaultWorkbenchThisMonthRange,
  normalizeDateRange,
  resolveWorkbenchDateRange,
  resolveWorkbenchPresetRange,
  type WorkbenchDateRange,
  type WorkbenchPeriodPreset,
} from '@/lib/crm/workbench-date-range'

type WorkbenchPeriodContextValue = {
  preset: WorkbenchPeriodPreset
  startDate: string
  endDate: string
  setPreset: (preset: Exclude<WorkbenchPeriodPreset, 'custom'>) => void
  setCustomRange: (startDate: string, endDate: string) => void
  queryInput: WorkbenchDateRange
}

const WorkbenchPeriodContext = createContext<WorkbenchPeriodContextValue | null>(null)

export function WorkbenchPeriodProvider({ children }: { children: ReactNode }) {
  const initial = defaultWorkbenchThisMonthRange()
  const [preset, setPresetState] = useState<WorkbenchPeriodPreset>(initial.preset)
  const [startDate, setStartDate] = useState(initial.startDate)
  const [endDate, setEndDate] = useState(initial.endDate)

  const setPreset = useCallback((next: Exclude<WorkbenchPeriodPreset, 'custom'>) => {
    const range = resolveWorkbenchPresetRange(next)
    setPresetState(next)
    setStartDate(range.startDate)
    setEndDate(range.endDate)
  }, [])

  const setCustomRange = useCallback((from: string, to: string) => {
    const normalized = normalizeDateRange(from, to)
    setPresetState('custom')
    setStartDate(normalized.startDate)
    setEndDate(normalized.endDate)
  }, [])

  const queryInput = useMemo(
    () =>
      resolveWorkbenchDateRange({
        preset,
        startDate,
        endDate,
      }),
    [preset, startDate, endDate],
  )

  const value = useMemo(
    () => ({
      preset,
      startDate,
      endDate,
      setPreset,
      setCustomRange,
      queryInput,
    }),
    [preset, startDate, endDate, setPreset, setCustomRange, queryInput],
  )

  return (
    <WorkbenchPeriodContext.Provider value={value}>{children}</WorkbenchPeriodContext.Provider>
  )
}

export function useWorkbenchPeriod() {
  const ctx = useContext(WorkbenchPeriodContext)
  if (!ctx) {
    throw new Error('useWorkbenchPeriod must be used within WorkbenchPeriodProvider')
  }
  return ctx
}
