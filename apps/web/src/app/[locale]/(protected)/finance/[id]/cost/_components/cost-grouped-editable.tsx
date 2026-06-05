"use client"

import type { PlatformCostMonthly, VoucherCardHoursAdjustmentHistoryEntry } from "@/lib/types/finance"
import { useState } from "react"
import { VoucherCardHoursAdjustmentDialog } from "../../../_components/voucher-card-hours-adjustment-dialog"
import { CostGroupedTable } from "./cost-grouped-table"

type CostGroupedEditableProps = {
  rows: PlatformCostMonthly[]
  adjustmentHistories: Record<string, VoucherCardHoursAdjustmentHistoryEntry[]>
  onAdjustmentSaved: () => void
}

export function CostGroupedEditable({
  rows,
  adjustmentHistories,
  onAdjustmentSaved,
}: CostGroupedEditableProps) {
  const [adjRow, setAdjRow] = useState<PlatformCostMonthly | null>(null)
  const [adjOpen, setAdjOpen] = useState(false)

  function openBalanceAdjust(row: PlatformCostMonthly) {
    setAdjRow(row)
    setAdjOpen(true)
  }

  return (
    <>
      <CostGroupedTable
        rows={rows}
        editable
        onVoucherAdjust={openBalanceAdjust}
        voucherAdjustmentHistoryCount={(id) =>
          adjustmentHistories[id]?.length ?? 0
        }
        adjustmentHistories={adjustmentHistories}
      />
      <VoucherCardHoursAdjustmentDialog
        open={adjOpen}
        onOpenChange={setAdjOpen}
        row={adjRow}
        history={adjRow ? (adjustmentHistories[adjRow.id] ?? []) : []}
        onSaved={onAdjustmentSaved}
      />
    </>
  )
}
