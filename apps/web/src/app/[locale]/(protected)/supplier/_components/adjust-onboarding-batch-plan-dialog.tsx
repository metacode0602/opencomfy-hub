'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import { Label } from '@workspace/ui/components/label'
import { Textarea } from '@workspace/ui/components/textarea'
import { ONBOARDING_GPU_CARD_OPTIONS } from '@/lib/supplier-ops/ui-meta'
import {
  DEVICE_COOPERATION_TYPE_LABELS,
  type DeviceCooperationType,
} from '@/lib/types/supplier-domain'
import type { OnboardingBatchPlannedLineJson } from '@/lib/types/onboarding-batch-api'
import { trpc } from '@/lib/trpc/client'
import { invalidateGlobalDashboard } from '@/lib/dashboard/invalidate-global-dashboard'

type PlanLineDraft = {
  key: string
  gpuCardTypeCode: string
  cooperationType: DeviceCooperationType | ''
  quantity: string
}

function emptyPlanLine(): PlanLineDraft {
  return {
    key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    gpuCardTypeCode: '',
    cooperationType: '',
    quantity: '',
  }
}

function linesFromBatch(plannedLines: OnboardingBatchPlannedLineJson[]): PlanLineDraft[] {
  if (plannedLines.length === 0) return [emptyPlanLine()]
  return plannedLines.map((line) => ({
    key: `line-${line.gpuCardTypeId}-${line.cooperationType}`,
    gpuCardTypeCode: line.gpuCardTypeCode,
    cooperationType: line.cooperationType,
    quantity: String(line.plannedQuantity),
  }))
}

function toDatetimeLocalValue(d: Date | string | null | undefined): string {
  if (!d) return ''
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function AdjustOnboardingBatchPlanDialog({
  batchId,
  open,
  onOpenChange,
  batchKind,
  plannedLinesJson,
  plannedReadyAt,
  touchedDeviceCount,
  plannedDeviceCount,
  onSuccess,
}: {
  batchId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  batchKind: string
  plannedLinesJson: unknown
  plannedReadyAt: Date | string | null
  touchedDeviceCount: number
  plannedDeviceCount: number
  onSuccess?: () => void
}) {
  const utils = trpc.useUtils()
  const { data: activeCardTypes = [] } = trpc.supplier.gpuCardTypes.listActive.useQuery(undefined, {
    enabled: open,
  })
  const { data: adjustHistory = [] } = trpc.supplier.onboardingBatch.listAdjustHistory.useQuery(
    { batchId },
    { enabled: open },
  )

  const adjustMutation = trpc.supplier.onboardingBatch.adjustPlan.useMutation()

  const initialLines = useMemo(() => {
    const raw = (plannedLinesJson as OnboardingBatchPlannedLineJson[] | null) ?? []
    return linesFromBatch(raw)
  }, [plannedLinesJson])

  const [planLines, setPlanLines] = useState<PlanLineDraft[]>(initialLines)
  const [plannedReady, setPlannedReady] = useState(toDatetimeLocalValue(plannedReadyAt))
  const [effectiveAt, setEffectiveAt] = useState('')
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!open) return
    setPlanLines(initialLines)
    setPlannedReady(toDatetimeLocalValue(plannedReadyAt))
    setEffectiveAt('')
    setReason('')
  }, [open, initialLines, plannedReadyAt])

  const cardTypeOptions = useMemo(() => {
    if (activeCardTypes.length > 0) {
      return activeCardTypes.map((c) => ({
        code: c.code ?? c.id,
        label: c.name,
      }))
    }
    return ONBOARDING_GPU_CARD_OPTIONS
  }, [activeCardTypes])

  const lastAdjust = adjustHistory[0]

  const updatePlanLine = (key: string, patch: Partial<PlanLineDraft>) => {
    setPlanLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  const handleSubmit = () => {
    const normalized: Array<{
      gpuCardTypeCode: string
      cooperationType: DeviceCooperationType
      plannedQuantity: number
    }> = []
    const seen = new Set<string>()
    for (const line of planLines) {
      if (!line.gpuCardTypeCode || !line.cooperationType) {
        toast.error('请完善每一行的卡型与合作类型')
        return
      }
      const qty = Number(line.quantity)
      if (!Number.isInteger(qty) || qty <= 0) {
        toast.error('请填写有效的计划数量（正整数）')
        return
      }
      const key = `${line.gpuCardTypeCode}::${line.cooperationType}`
      if (seen.has(key)) {
        toast.error('卡型与合作类型组合不可重复')
        return
      }
      seen.add(key)
      normalized.push({
        gpuCardTypeCode: line.gpuCardTypeCode,
        cooperationType: line.cooperationType,
        plannedQuantity: qty,
      })
    }

    if (reason.trim().length < 4) {
      toast.error('请填写调整原因（至少 4 字）')
      return
    }

    const total = normalized.reduce((s, l) => s + l.plannedQuantity, 0)
    if (total < touchedDeviceCount) {
      toast.error(`计划台数不能小于已触达台数（${touchedDeviceCount}）`)
      return
    }

    adjustMutation.mutate(
      {
        batchId,
        reason: reason.trim(),
        planLines: normalized,
        plannedReadyAt: plannedReady ? new Date(plannedReady).toISOString() : undefined,
        effectiveAt: effectiveAt ? new Date(effectiveAt).toISOString() : undefined,
      },
      {
        onSuccess: () => {
          toast.success('计划已调整')
          void utils.supplier.onboardingBatch.getDetailPage.invalidate({ batchId })
          void utils.supplier.onboardingBatch.listProgressEvents.invalidate({ batchId })
          void utils.supplier.onboardingBatch.listAdjustHistory.invalidate({ batchId })
          invalidateGlobalDashboard(utils)
          onOpenChange(false)
          onSuccess?.()
        },
        onError: (e) => toast.error(e.message),
      },
    )
  }

  const title =
    batchKind === 'device_retire'
      ? '调整下架计划'
      : batchKind === 'order_access'
        ? '调整订单接入计划'
        : batchKind === 'internal_occupancy'
          ? '调整内部占用计划'
          : '调整上架计划'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl min-w-[30vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            调整将影响大盘 Period 计划卡时回放。当前触达 {touchedDeviceCount} 台，计划{' '}
            {plannedDeviceCount} 台。
            {lastAdjust ? (
              <span className="block mt-1 text-xs">
                上次调整：{lastAdjust.authorName ?? '—'} ·{' '}
                {new Date(lastAdjust.occurredAt).toLocaleString('zh-CN')}
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>计划行</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setPlanLines((p) => [...p, emptyPlanLine()])}
              >
                <Plus className="w-3 h-3" />
                添加行
              </Button>
            </div>
            {planLines.map((line) => (
              <div key={line.key} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  <Select
                    value={line.gpuCardTypeCode}
                    onValueChange={(v) => updatePlanLine(line.key, { gpuCardTypeCode: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="卡型" />
                    </SelectTrigger>
                    <SelectContent>
                      {cardTypeOptions.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3">
                  <Select
                    value={line.cooperationType}
                    onValueChange={(v) =>
                      updatePlanLine(line.key, {
                        cooperationType: v as DeviceCooperationType,
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="合作类型" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(DEVICE_COOPERATION_TYPE_LABELS) as DeviceCooperationType[]).map(
                        (k) => (
                          <SelectItem key={k} value={k}>
                            {DEVICE_COOPERATION_TYPE_LABELS[k]}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3">
                  <Input
                    type="number"
                    min={1}
                    placeholder="数量"
                    value={line.quantity}
                    onChange={(e) => updatePlanLine(line.key, { quantity: e.target.value })}
                  />
                </div>
                <div className="col-span-2 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={planLines.length <= 1}
                    onClick={() =>
                      setPlanLines((p) => (p.length <= 1 ? p : p.filter((l) => l.key !== line.key)))
                    }
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="planned-ready">计划完成时间</Label>
            <Input
              id="planned-ready"
              type="datetime-local"
              value={plannedReady}
              onChange={(e) => setPlannedReady(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="effective-at">生效时间（可选，默认当前）</Label>
            <Input
              id="effective-at"
              type="datetime-local"
              value={effectiveAt}
              onChange={(e) => setEffectiveAt(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">用于 Period 计划卡时历史阶梯回放</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="adjust-reason">调整原因（必填）</Label>
            <Textarea
              id="adjust-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请说明商务/运维调整原因，至少 4 字"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button disabled={adjustMutation.isPending} onClick={handleSubmit}>
            {adjustMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            提交调整
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
