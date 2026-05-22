'use client'

import { Badge } from '@workspace/ui/components/badge'
import {
  isPricingRecordUnavailable,
  PRICING_PLACEHOLDER_NOTE,
  SUPPLIER_PRICING_CONFIG_STATUS_LABELS,
} from '@/lib/supplier/pricing-record-status'
import type { SupplierPricingRecord } from '@/lib/data/types'

export function PricingConfigStatusBadge({
  record,
}: {
  record: Pick<SupplierPricingRecord, 'configStatus'>
}) {
  if (!isPricingRecordUnavailable(record)) return null
  return (
    <Badge
      variant="outline"
      className="bg-red-500/10 text-red-500 border-red-500/30 shrink-0"
      title={`${PRICING_PLACEHOLDER_NOTE}，${SUPPLIER_PRICING_CONFIG_STATUS_LABELS.unavailable}`}
    >
      {PRICING_PLACEHOLDER_NOTE} · {SUPPLIER_PRICING_CONFIG_STATUS_LABELS.unavailable}
    </Badge>
  )
}
