"use client"

import {
  mergeIncomeRowsWithOverrides,
  sortIncomeRowsByTotalConsumptionDesc,
} from "@/lib/finance/income-row-utils"
import { useFinanceIncomeOpsStore } from "@/lib/stores/finance-income-ops-store"
import type { PlatformIncomeMonthly } from "@/lib/types/finance"
import { useMemo, useState } from "react"
import { IncomeAdjustmentDialog } from "./income-adjustment-dialog"
import { IncomeDetailTable } from "./income-detail-table"
import { SupplementaryConsumptionDialog } from "./supplementary-consumption-dialog"

type IncomeDetailEditableProps = {
  baseRows: PlatformIncomeMonthly[]
  showPeriodColumn?: boolean
}

export function IncomeDetailEditable({
  baseRows,
  showPeriodColumn = true,
}: IncomeDetailEditableProps) {
  const overrides = useFinanceIncomeOpsStore((s) => s.overrides)
  const supplementaryHistories = useFinanceIncomeOpsStore(
    (s) => s.supplementaryHistories,
  )
  const adjustmentHistories = useFinanceIncomeOpsStore(
    (s) => s.adjustmentHistories,
  )

  const rows = useMemo(
    () =>
      sortIncomeRowsByTotalConsumptionDesc(
        mergeIncomeRowsWithOverrides(baseRows, overrides),
      ),
    [baseRows, overrides],
  )

  const baseById = useMemo(
    () => new Map(baseRows.map((r) => [r.id, r])),
    [baseRows],
  )

  const [suppDisplay, setSuppDisplay] = useState<PlatformIncomeMonthly | null>(
    null,
  )
  const [suppBase, setSuppBase] = useState<PlatformIncomeMonthly | null>(null)
  const [suppOpen, setSuppOpen] = useState(false)
  const [adjDisplay, setAdjDisplay] = useState<PlatformIncomeMonthly | null>(
    null,
  )
  const [adjBase, setAdjBase] = useState<PlatformIncomeMonthly | null>(null)
  const [adjOpen, setAdjOpen] = useState(false)

  function openSupplementary(display: PlatformIncomeMonthly) {
    setSuppDisplay(display)
    setSuppBase(baseById.get(display.id) ?? display)
    setSuppOpen(true)
  }

  function openAdjust(display: PlatformIncomeMonthly) {
    setAdjDisplay(display)
    setAdjBase(baseById.get(display.id) ?? display)
    setAdjOpen(true)
  }

  return (
    <>
      <IncomeDetailTable
        rows={rows}
        showPeriodColumn={showPeriodColumn}
        editable
        onSupplementary={openSupplementary}
        onAdjust={openAdjust}
        supplementaryHistoryCount={(id) =>
          supplementaryHistories[id]?.length ?? 0
        }
        adjustmentHistoryCount={(id) => adjustmentHistories[id]?.length ?? 0}
      />

      <SupplementaryConsumptionDialog
        open={suppOpen}
        onOpenChange={setSuppOpen}
        displayRow={suppDisplay}
        baseRow={suppBase}
      />
      <IncomeAdjustmentDialog
        open={adjOpen}
        onOpenChange={setAdjOpen}
        displayRow={adjDisplay}
        baseRow={adjBase}
      />
    </>
  )
}
