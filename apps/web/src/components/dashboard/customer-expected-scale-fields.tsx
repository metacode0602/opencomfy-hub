'use client'

import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Checkbox } from '@workspace/ui/components/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import { mockGPUCardTypes } from '@/lib/data/mock-data'
import {
  emptyExpectedScale,
  productLineNames,
  type CustomerExpectedScale,
  type ExpectedScaleCardEntry,
} from '@/lib/data/types'

const STORAGE_OPTIONS = [
  { value: 'shared_storage' as const, label: productLineNames.shared_storage },
  { value: 'object_storage' as const, label: productLineNames.object_storage },
]

export type CustomerExpectedScaleFieldsProps = {
  value: CustomerExpectedScale
  onChange: (value: CustomerExpectedScale) => void
  idPrefix?: string
}

function newCardEntry(): ExpectedScaleCardEntry {
  return { cardTypeId: '', cardCount: 1 }
}

export function CustomerExpectedScaleFields({
  value,
  onChange,
  idPrefix = 'expected-scale',
}: CustomerExpectedScaleFieldsProps) {
  const scale = value ?? emptyExpectedScale

  const applyPatch = (partial: Partial<CustomerExpectedScale>) => {
    onChange({ ...scale, ...partial })
  }

  const updateCard = (index: number, cardPatch: Partial<ExpectedScaleCardEntry>) => {
    const cards = scale.cards.map((c, i) => (i === index ? { ...c, ...cardPatch } : c))
    applyPatch({ cards })
  }

  const addCard = () => {
    applyPatch({ cards: [...scale.cards, newCardEntry()] })
  }

  const removeCard = (index: number) => {
    applyPatch({ cards: scale.cards.filter((_, i) => i !== index) })
  }

  const usedCardTypeIds = new Set(
    scale.cards.map((c) => c.cardTypeId).filter(Boolean),
  )

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div>
        <Label className="text-base">期望规模</Label>
        <p className="text-xs text-muted-foreground mt-0.5">非必填，用于记录客户预期资源规模</p>
      </div>

      {/* 卡型 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">卡型与数量</Label>
          <Button type="button" variant="outline" size="sm" onClick={addCard}>
            <Plus className="w-3.5 h-3.5 mr-1" />
            添加卡型
          </Button>
        </div>
        {scale.cards.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">暂未添加卡型，点击上方按钮添加</p>
        ) : (
          <div className="space-y-2">
            {scale.cards.map((entry, index) => (
              <div
                key={`${idPrefix}-card-${index}`}
                className="grid grid-cols-[1fr_100px_auto] gap-2 items-end"
              >
                <div className="grid gap-1">
                  {index === 0 && (
                    <Label className="text-xs text-muted-foreground">卡型</Label>
                  )}
                  <Select
                    value={entry.cardTypeId || undefined}
                    onValueChange={(v) => updateCard(index, { cardTypeId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择卡型" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockGPUCardTypes.map((card) => (
                        <SelectItem
                          key={card.id}
                          value={card.id}
                          disabled={
                            usedCardTypeIds.has(card.id) && card.id !== entry.cardTypeId
                          }
                        >
                          {card.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  {index === 0 && (
                    <Label className="text-xs text-muted-foreground">卡数量</Label>
                  )}
                  <Input
                    type="number"
                    min={1}
                    value={entry.cardCount || ''}
                    onChange={(e) =>
                      updateCard(index, {
                        cardCount: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    placeholder="数量"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => removeCard(index)}
                  aria-label="删除卡型"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 存储 */}
      <div className="space-y-3 pt-2 border-t border-border">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${idPrefix}-storage-enabled`}
            checked={scale.storage.enabled}
            onCheckedChange={(checked) =>
              applyPatch({
                storage: {
                  ...scale.storage,
                  enabled: checked === true,
                  sizeGB: checked === true ? scale.storage.sizeGB || 100 : 0,
                },
              })
            }
          />
          <Label htmlFor={`${idPrefix}-storage-enabled`} className="cursor-pointer font-medium">
            需要存储
          </Label>
        </div>
        {scale.storage.enabled && (
          <div className="grid grid-cols-2 gap-3 pl-6">
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">存储类型</Label>
              <Select
                value={scale.storage.storageType}
                onValueChange={(v) =>
                  applyPatch({
                    storage: {
                      ...scale.storage,
                      storageType: v as 'shared_storage' | 'object_storage',
                    },
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STORAGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">存储大小（GB）</Label>
              <Input
                type="number"
                min={1}
                value={scale.storage.sizeGB || ''}
                onChange={(e) =>
                  applyPatch({
                    storage: {
                      ...scale.storage,
                      sizeGB: Math.max(0, parseInt(e.target.value, 10) || 0),
                    },
                  })
                }
                placeholder="如 1024"
              />
            </div>
          </div>
        )}
      </div>

      {/* 业务线数量 */}
      <div className="space-y-2 pt-2 border-t border-border">
        <Label className="text-sm font-medium">业务线数量</Label>
        <div className="grid grid-cols-3 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor={`${idPrefix}-bare-metal`} className="text-xs text-muted-foreground">
              裸金属
            </Label>
            <Input
              id={`${idPrefix}-bare-metal`}
              type="number"
              min={0}
              value={scale.productLines.bareMetal || ''}
              onChange={(e) =>
                applyPatch({
                  productLines: {
                    ...scale.productLines,
                    bareMetal: Math.max(0, parseInt(e.target.value, 10) || 0),
                  },
                })
              }
              placeholder="0"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${idPrefix}-elastic`} className="text-xs text-muted-foreground">
              弹性服务
            </Label>
            <Input
              id={`${idPrefix}-elastic`}
              type="number"
              min={0}
              value={scale.productLines.elasticService || ''}
              onChange={(e) =>
                applyPatch({
                  productLines: {
                    ...scale.productLines,
                    elasticService: Math.max(0, parseInt(e.target.value, 10) || 0),
                  },
                })
              }
              placeholder="0"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${idPrefix}-job`} className="text-xs text-muted-foreground">
              Job
            </Label>
            <Input
              id={`${idPrefix}-job`}
              type="number"
              min={0}
              value={scale.productLines.job || ''}
              onChange={(e) =>
                applyPatch({
                  productLines: {
                    ...scale.productLines,
                    job: Math.max(0, parseInt(e.target.value, 10) || 0),
                  },
                })
              }
              placeholder="0"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
