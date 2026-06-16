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
import { ONBOARDING_GPU_CARD_OPTIONS } from '@/lib/supplier-ops/ui-meta'
import type {
  InternalTestHoldDepartment,
  InternalTestHoldSettlement,
} from '@/lib/types/supplier-domain'
import { trpc } from '@/lib/trpc/client'
import { invalidateGlobalDashboard } from '@/lib/dashboard/invalidate-global-dashboard'
import { useFeishuIntegrationConfig } from '@/lib/integrations/use-feishu-integration-config'

const DEPARTMENT_OPTIONS: { value: InternalTestHoldDepartment; label: string }[] = [
  { value: 'product', label: '产品' },
  { value: 'rd', label: '研发' },
  { value: 'test', label: '测试' },
]

const SETTLEMENT_OPTIONS: { value: InternalTestHoldSettlement; label: string }[] = [
  { value: 'whole_rent', label: '整租' },
  { value: 'idle_time', label: '闲时' },
]

type CardLineDraft = {
  key: string
  gpuCardTypeId: string
  quantity: string
}

function emptyCardLine(): CardLineDraft {
  return {
    key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    gpuCardTypeId: '',
    quantity: '',
  }
}

export function InternalOccupancyBatchCreateDialog({
  open,
  onOpenChange,
  defaultSupplierId,
  defaultDataCenterId,
  supplierName,
  dataCenterName,
  lockContext = false,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultSupplierId?: string
  defaultDataCenterId?: string
  supplierName?: string
  dataCenterName?: string
  lockContext?: boolean
  onSuccess?: () => void
}) {
  const utils = trpc.useUtils()
  const [supplierId, setSupplierId] = useState('')
  const [dataCenterId, setDataCenterId] = useState('')
  const [workOrderNo, setWorkOrderNo] = useState('')
  const [userName, setUserName] = useState('')
  const [department, setDepartment] = useState<InternalTestHoldDepartment | ''>('')
  const [settlementMode, setSettlementMode] = useState<InternalTestHoldSettlement | ''>('')
  const [holdFrom, setHoldFrom] = useState('')
  const [holdUntil, setHoldUntil] = useState('')
  const [plannedReadyAt, setPlannedReadyAt] = useState('')
  const [remark, setRemark] = useState('')
  const [cardLines, setCardLines] = useState<CardLineDraft[]>([emptyCardLine()])

  const supplierIdForQuery = lockContext ? defaultSupplierId : supplierId
  const { data: suppliers } = trpc.supplier.list.useQuery(undefined, { enabled: open && !lockContext })
  const { data: datacenters } = trpc.supplier.listDataCenters.useQuery(
    { supplierId: supplierIdForQuery ?? '' },
    { enabled: open && Boolean(supplierIdForQuery) && !lockContext },
  )
  const { data: activeCardTypes = [] } = trpc.supplier.gpuCardTypes.listActive.useQuery(undefined, {
    enabled: open,
  })

  const createMutation = trpc.supplier.onboardingBatch.create.useMutation({
    onSuccess: (result) => {
      toast.success(`内部占用计划 ${result.batchCode} 已创建`)
      void utils.supplier.onboardingBatch.list.invalidate()
      void utils.supplier.internalTestHold.list.invalidate()
      void utils.supplier.overview.getStats.invalidate()
      invalidateGlobalDashboard(utils)
      onSuccess?.()
      onOpenChange(false)
    },
    onError: (e) => toast.error(e.message),
  })
  const { manualWorkOrderRequired } = useFeishuIntegrationConfig(open)

  useEffect(() => {
    if (!open) return
    if (lockContext && defaultSupplierId && defaultDataCenterId) {
      setSupplierId(defaultSupplierId)
      setDataCenterId(defaultDataCenterId)
    } else {
      setSupplierId('')
      setDataCenterId('')
    }
    setWorkOrderNo('')
    setUserName('')
    setDepartment('')
    setSettlementMode('')
    setHoldFrom('')
    setHoldUntil('')
    setPlannedReadyAt('')
    setRemark('')
    setCardLines([emptyCardLine()])
  }, [open, lockContext, defaultSupplierId, defaultDataCenterId])

  useEffect(() => {
    if (lockContext) return
    setDataCenterId('')
  }, [supplierId, lockContext])

  const cardTypeOptions = useMemo(() => {
    if (activeCardTypes.length > 0) {
      return activeCardTypes.map((c) => ({
        id: c.id,
        label: c.name,
        code: c.code ?? c.id,
      }))
    }
    return ONBOARDING_GPU_CARD_OPTIONS.map((c) => ({
      id: c.code,
      label: c.label,
      code: c.code,
    }))
  }, [activeCardTypes])

  const normalizedPlanLines = useMemo(() => {
    if (!settlementMode) return null
    const seen = new Set<string>()
    const lines: Array<{
      gpuCardTypeId: string
      gpuCardTypeCode: string
      cooperationType: InternalTestHoldSettlement
      plannedQuantity: number
    }> = []
    for (const line of cardLines) {
      if (!line.gpuCardTypeId) continue
      const qty = Number.parseInt(line.quantity, 10)
      if (!Number.isFinite(qty) || qty <= 0) continue
      if (seen.has(line.gpuCardTypeId)) return null
      seen.add(line.gpuCardTypeId)
      const opt = cardTypeOptions.find((o) => o.id === line.gpuCardTypeId)
      lines.push({
        gpuCardTypeId: line.gpuCardTypeId,
        gpuCardTypeCode: opt?.code ?? line.gpuCardTypeId,
        cooperationType: settlementMode,
        plannedQuantity: qty,
      })
    }
    return lines.length > 0 ? lines : null
  }, [cardLines, cardTypeOptions, settlementMode])

  const resolvedSupplierId = lockContext ? defaultSupplierId : supplierId
  const resolvedDataCenterId = lockContext ? defaultDataCenterId : dataCenterId

  const canSubmit =
    Boolean(
      resolvedSupplierId &&
        resolvedDataCenterId &&
        (manualWorkOrderRequired ? workOrderNo.trim() : true) &&
        userName.trim() &&
        department &&
        settlementMode &&
        holdFrom &&
        normalizedPlanLines,
    ) && !createMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl min-w-[30vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新建内部占用计划</DialogTitle>
          <DialogDescription>
            {lockContext && dataCenterName
              ? `为机房「${dataCenterName}」创建内部占用计划批次并登记占用信息；设备挂接请通过变更表导入，工单号需与批次一致。`
              : '创建计划批次并登记占用信息；设备挂接请通过变更表导入，工单号需与批次一致。'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {lockContext && defaultSupplierId && defaultDataCenterId ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>供应商</Label>
                <p className="text-sm text-foreground">{supplierName ?? '—'}</p>
              </div>
              <div className="grid gap-2">
                <Label>机房</Label>
                <p className="text-sm text-foreground">{dataCenterName ?? '—'}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-2">
                <Label>供应商</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择供应商" />
                  </SelectTrigger>
                  <SelectContent>
                    {(suppliers ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.shortName ?? s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>机房</Label>
                <Select value={dataCenterId} onValueChange={setDataCenterId} disabled={!supplierId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={supplierId ? '选择机房' : '请先选择供应商'} />
                  </SelectTrigger>
                  <SelectContent>
                    {(datacenters ?? []).map((dc) => (
                      <SelectItem key={dc.id} value={dc.id}>
                        {dc.code} · {dc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="grid gap-2">
            {manualWorkOrderRequired ? (
              <>
                <Label htmlFor="io-work-order">飞书工单号</Label>
                <Input
                  id="io-work-order"
                  value={workOrderNo}
                  onChange={(e) => setWorkOrderNo(e.target.value)}
                  placeholder="与变更表 ticket_no 一致"
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground rounded-md border border-dashed px-3 py-2">
                提交后将自动创建飞书审批工单（末级节点：验收完成）
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="io-user-name">使用者</Label>
              <Input
                id="io-user-name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="占用方联系人"
              />
            </div>
            <div className="grid gap-2">
              <Label>使用部门</Label>
              <Select
                value={department}
                onValueChange={(v) => setDepartment(v as InternalTestHoldDepartment)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择部门" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>结算方式</Label>
            <Select
              value={settlementMode}
              onValueChange={(v) => setSettlementMode(v as InternalTestHoldSettlement)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择结算方式" />
              </SelectTrigger>
              <SelectContent>
                {SETTLEMENT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="io-hold-from">开始时间</Label>
              <Input
                id="io-hold-from"
                type="datetime-local"
                value={holdFrom}
                onChange={(e) => setHoldFrom(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="io-hold-until">计划结束（可选）</Label>
              <Input
                id="io-hold-until"
                type="datetime-local"
                value={holdUntil}
                onChange={(e) => setHoldUntil(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="io-ready-at">计划完成时间（可选）</Label>
            <Input
              id="io-ready-at"
              type="datetime-local"
              value={plannedReadyAt}
              onChange={(e) => setPlannedReadyAt(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="io-remark">备注（可选）</Label>
            <Input
              id="io-remark"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="补充说明"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>计划占用（卡型 × 台数）</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setCardLines((prev) => [...prev, emptyCardLine()])}
              >
                <Plus className="h-3.5 w-3.5" />
                添加行
              </Button>
            </div>
            {cardLines.map((line, index) => (
              <div key={line.key} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-8">
                  <Select
                    value={line.gpuCardTypeId}
                    onValueChange={(v) =>
                      setCardLines((prev) =>
                        prev.map((l, i) => (i === index ? { ...l, gpuCardTypeId: v } : l)),
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="卡型" />
                    </SelectTrigger>
                    <SelectContent>
                      {cardTypeOptions.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3">
                  <Input
                    type="number"
                    min={1}
                    placeholder="台数"
                    value={line.quantity}
                    onChange={(e) =>
                      setCardLines((prev) =>
                        prev.map((l, i) => (i === index ? { ...l, quantity: e.target.value } : l)),
                      )
                    }
                  />
                </div>
                <div className="col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={cardLines.length <= 1}
                    onClick={() => setCardLines((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            disabled={!canSubmit}
            onClick={() => {
              if (!normalizedPlanLines || !department || !settlementMode) {
                toast.error('请完善登记信息与计划占用行')
                return
              }
              if (!resolvedSupplierId || !resolvedDataCenterId) {
                toast.error('请选择供应商与机房')
                return
              }
              createMutation.mutate({
                batchKind: 'internal_occupancy',
                supplierId: resolvedSupplierId,
                dataCenterId: resolvedDataCenterId,
                accessMethod: 'manual',
                workOrderNo: workOrderNo.trim() || undefined,
                uploadList: false,
                userName: userName.trim(),
                department,
                settlementMode,
                holdFrom: new Date(holdFrom).toISOString(),
                holdUntil: holdUntil ? new Date(holdUntil).toISOString() : undefined,
                planLines: normalizedPlanLines,
                plannedReadyAt: plannedReadyAt
                  ? new Date(plannedReadyAt).toISOString()
                  : undefined,
                remark: remark.trim() || undefined,
              })
            }}
          >
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            创建计划
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
