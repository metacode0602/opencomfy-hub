"use client"

import { mergeCostRowsWithOverrides } from "@/lib/finance/cost-row-utils"
import { useFinanceCostOpsStore } from "@/lib/stores/finance-cost-ops-store"
import type { PlatformCostMonthly } from "@/lib/types/finance"
import { useMemo, useState } from "react"
import { VoucherCardHoursAdjustmentDialog } from "../../../_components/voucher-card-hours-adjustment-dialog"
import { CostGroupedTable } from "./cost-grouped-table"

type CostGroupedEditableProps = {
  baseRows: PlatformCostMonthly[]
  periodCode?: string
}

export function CostGroupedEditable({ baseRows, periodCode }: CostGroupedEditableProps) {
  const overrides = useFinanceCostOpsStore((s) => s.overrides)
  const voucherHistories = useFinanceCostOpsStore(
    (s) => s.voucherAdjustmentHistories,
  )

  const rows = useMemo(
    () => mergeCostRowsWithOverrides(baseRows, overrides),
    [baseRows, overrides],
  )

  const baseById = useMemo(
    () => new Map(baseRows.map((r) => [r.id, r])),
    [baseRows],
  )

  const [adjDisplay, setAdjDisplay] = useState<PlatformCostMonthly | null>(null)
  const [adjBase, setAdjBase] = useState<PlatformCostMonthly | null>(null)
  const [adjOpen, setAdjOpen] = useState(false)

  function openVoucherAdjust(display: PlatformCostMonthly) {
    setAdjDisplay(display)
    setAdjBase(baseById.get(display.id) ?? display)
    setAdjOpen(true)
  }

  return (
    <>
      <CostGroupedTable
        rows={rows}
        periodCode={periodCode}
        editable
        onVoucherAdjust={openVoucherAdjust}
        voucherAdjustmentHistoryCount={(id) =>
          voucherHistories[id]?.length ?? 0
        }
      />
      <VoucherCardHoursAdjustmentDialog
        open={adjOpen}
        onOpenChange={setAdjOpen}
        displayRow={adjDisplay}
        baseRow={adjBase}
      />
    </>
  )
}
