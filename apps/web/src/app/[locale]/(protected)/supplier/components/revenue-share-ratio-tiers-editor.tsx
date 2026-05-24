'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import type { RevenueShareRatioTierDraft } from './revenue-share-ratio-tiers'
import { emptyRevenueShareRatioTier } from './revenue-share-ratio-tiers'

type RevenueShareRatioTiersEditorProps = {
  tiers: RevenueShareRatioTierDraft[]
  onChange: (tiers: RevenueShareRatioTierDraft[]) => void
  error?: string | null
}

export function RevenueShareRatioTiersEditor({
  tiers,
  onChange,
  error,
}: RevenueShareRatioTiersEditorProps) {
  const addTier = () => {
    onChange([...tiers, emptyRevenueShareRatioTier(tiers.length + 1)])
  }

  const removeTier = (order: number) => {
    onChange(
      tiers
        .filter((t) => t.tierOrder !== order)
        .map((t, i) => ({ ...t, tierOrder: i + 1 })),
    )
  }

  const updateTier = (order: number, patch: Partial<RevenueShareRatioTierDraft>) => {
    onChange(tiers.map((t) => (t.tierOrder === order ? { ...t, ...patch } : t)))
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label>阶梯分成档位</Label>
          <p className="text-xs text-muted-foreground mt-1">
            按成交卡时价 ÷ 刊例价 × 100% 落入区间，取对应档位的供应商分成比例；比例可大于 100%
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addTier}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          添加档位
        </Button>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-0.5">
          <span className="text-xs text-muted-foreground">比例下限 %（不含）</span>
          <span className="text-xs text-muted-foreground">比例上限 %（含）</span>
          <span className="text-xs text-muted-foreground">分成比例 %</span>
          <span className="w-9" />
        </div>

        {tiers.map((tier, index) => (
          <div
            key={tier.tierOrder}
            className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end"
          >
            <div className="grid gap-1">
              <Label className="text-xs sr-only">第 {tier.tierOrder} 档比例下限</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="如 90"
                value={tier.ratioFromPercent}
                onChange={(e) =>
                  updateTier(tier.tierOrder, { ratioFromPercent: e.target.value })
                }
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs sr-only">第 {tier.tierOrder} 档比例上限</Label>
              <Input
                type="number"
                step="0.01"
                placeholder={index === tiers.length - 1 ? '无上限' : '如 100'}
                value={tier.ratioToPercent}
                onChange={(e) =>
                  updateTier(tier.tierOrder, { ratioToPercent: e.target.value })
                }
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs sr-only">第 {tier.tierOrder} 档分成</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                placeholder="如 35"
                value={tier.revenueSharePercent}
                onChange={(e) =>
                  updateTier(tier.tierOrder, { revenueSharePercent: e.target.value })
                }
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              disabled={tiers.length <= 1}
              onClick={() => removeTier(tier.tierOrder)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        示例：成交/刊例为 92% 时落入 (90%, 95%] 档；为 90% 时落入 (0%, 90%] 档；为 105% 时落入
        (100%, +∞) 档。各档区间不可重叠。
      </p>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}
