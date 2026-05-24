import { Badge } from '@workspace/ui/components/badge'
import type { ContractPricingMode } from '@/lib/data/types'
import { contractPricingModeNames } from '@/lib/data/types'

export function PricingModeBadge({ mode }: { mode: ContractPricingMode }) {
  const isCardTime = mode === 'card_time' || mode === 'tiered_card_time'
  return (
    <Badge
      variant="outline"
      className={
        isCardTime
          ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
          : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
      }
    >
      {contractPricingModeNames[mode]}
    </Badge>
  )
}
