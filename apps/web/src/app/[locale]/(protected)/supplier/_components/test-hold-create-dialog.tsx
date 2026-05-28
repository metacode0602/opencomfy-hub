'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
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
import { ONBOARDING_GPU_CARD_OPTIONS } from '@/lib/supplier-ops/ui-meta'
import type {
  InternalTestHoldDepartment,
  InternalTestHoldSettlement,
} from '@/lib/types/supplier-domain'
import { trpc } from '@/lib/trpc/client'
import { invalidateGlobalDashboard } from '@/lib/dashboard/invalidate-global-dashboard'

const DEPARTMENT_OPTIONS: { value: InternalTestHoldDepartment; label: string }[] = [
  { value: 'product', label: '产品' },
  { value: 'rd', label: '研发' },
  { value: 'test', label: '测试' },
]

const SETTLEMENT_OPTIONS: { value: InternalTestHoldSettlement; label: string }[] = [
  { value: 'whole_rent', label: '整租' },
  { value: 'idle_time', label: '闲时' },
]

type CardTypeRow = {
  key: string
  gpuCardTypeId: string
  unitCount: string
}

function emptyCardRow(): CardTypeRow {
  return {
    key: `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    gpuCardTypeId: '',
    unitCount: '',
  }
}

const EMPTY_FORM = {
  supplierId: '',
  dataCenterId: '',
  workOrderNo: '',
  userName: '',
  department: '' as InternalTestHoldDepartment | '',
  settlementMode: '' as InternalTestHoldSettlement | '',
  holdFrom: '',
  holdUntil: '',
  remark: '',
}

export function TestHoldCreateDialog({
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
  const { data: suppliers = [] } = trpc.supplier.list.useQuery(undefined, { enabled: open })
  const { data: activeCardTypes = [] } = trpc.supplier.gpuCardTypes.listActive.useQuery(undefined, {
    enabled: open,
  })

  const [form, setForm] = useState(EMPTY_FORM)
  const [cardRows, setCardRows] = useState<CardTypeRow[]>([emptyCardRow()])

  const supplierIdForQuery = lockContext ? defaultSupplierId : form.supplierId
  const { data: dataCenters = [] } = trpc.supplier.listDataCenters.useQuery(
    { supplierId: supplierIdForQuery ?? '' },
    { enabled: open && Boolean(supplierIdForQuery) },
  )

  const createMutation = trpc.supplier.internalTestHold.create.useMutation({
    onSuccess: (result) => {
      toast.success(
        result.createdCount === 1
          ? `内部占用已登记（工单 ${result.workOrderNo}）`
          : `已登记 ${result.createdCount} 条内部占用（工单 ${result.workOrderNo}）`,
      )
      void utils.supplier.internalTestHold.list.invalidate()
      invalidateGlobalDashboard(utils)
      onSuccess?.()
      onOpenChange(false)
    },
    onError: (error) => toast.error(error.message),
  })

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

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setCardRows([emptyCardRow()])
  }

  useEffect(() => {
    if (!open) {
      resetForm()
      return
    }
    setCardRows([emptyCardRow()])
    if (lockContext && defaultSupplierId && defaultDataCenterId) {
      setForm({
        ...EMPTY_FORM,
        supplierId: defaultSupplierId,
        dataCenterId: defaultDataCenterId,
      })
    }
  }, [open, lockContext, defaultSupplierId, defaultDataCenterId])

  const updateCardRow = (key: string, patch: Partial<CardTypeRow>) => {
    setCardRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  const addCardRow = () => setCardRows((prev) => [...prev, emptyCardRow()])

  const removeCardRow = (key: string) => {
    setCardRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)))
  }

  const isBlankCardRow = (row: CardTypeRow) => !row.gpuCardTypeId && !row.unitCount.trim()

  const createHold = () => {
    const supplierId = lockContext ? defaultSupplierId : form.supplierId
    const dataCenterId = lockContext ? defaultDataCenterId : form.dataCenterId

    if (
      !supplierId ||
      !dataCenterId ||
      !form.workOrderNo.trim() ||
      !form.userName.trim() ||
      !form.department ||
      !form.settlementMode ||
      !form.holdFrom
    ) {
      toast.error('请填写供应商、机房、飞书审批工单号、使用者、使用部门、结算方式与开始时间')
      return
    }

    const cardLines: { gpuCardTypeId: string; unitCount: number }[] = []
    for (const row of cardRows) {
      if (isBlankCardRow(row)) continue
      const unitCount = Number.parseInt(row.unitCount, 10)
      if (!row.gpuCardTypeId || !Number.isFinite(unitCount) || unitCount <= 0) {
        toast.error('请为每一行填写有效的卡型与台数')
        return
      }
      cardLines.push({ gpuCardTypeId: row.gpuCardTypeId, unitCount })
    }
    if (cardLines.length === 0) {
      toast.error('请至少添加一行卡型与台数')
      return
    }

    createMutation.mutate({
      supplierId,
      dataCenterId,
      workOrderNo: form.workOrderNo.trim(),
      userName: form.userName.trim(),
      department: form.department,
      settlementMode: form.settlementMode,
      holdFrom: new Date(form.holdFrom).toISOString(),
      holdUntil: form.holdUntil ? new Date(form.holdUntil).toISOString() : null,
      remark: form.remark.trim() || null,
      cardLines,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] min-w-[30vw] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>登记内部占用</DialogTitle>
          <DialogDescription>
            {lockContext && dataCenterName
              ? `为机房「${dataCenterName}」登记内部测试资源占用，可一次添加多种卡型与台数`
              : '按机房登记内部测试资源占用，可一次添加多种卡型与台数'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {lockContext && defaultSupplierId && defaultDataCenterId ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>供应商</Label>
                <p className="text-sm text-foreground">{supplierName ?? '—'}</p>
              </div>
              <div className="space-y-2">
                <Label>机房</Label>
                <p className="text-sm text-foreground">{dataCenterName ?? '—'}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>供应商</Label>
                <Select
                  value={form.supplierId}
                  onValueChange={(v) =>
                    setForm((s) => ({ ...s, supplierId: v, dataCenterId: '' }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.shortName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>机房</Label>
                <Select
                  value={form.dataCenterId}
                  onValueChange={(v) => setForm((s) => ({ ...s, dataCenterId: v }))}
                  disabled={!form.supplierId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={form.supplierId ? '选择机房' : '请先选择供应商'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {dataCenters.map((dc) => (
                      <SelectItem key={dc.id} value={dc.id}>
                        {dc.name} ({dc.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label>飞书审批工单号</Label>
            <Input
              placeholder="请输入飞书审批工单号（供应商内唯一）"
              value={form.workOrderNo}
              onChange={(e) => setForm((s) => ({ ...s, workOrderNo: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>使用者</Label>
            <Input
              placeholder="填写使用人姓名"
              value={form.userName}
              onChange={(e) => setForm((s) => ({ ...s, userName: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>使用部门</Label>
              <Select
                value={form.department}
                onValueChange={(v) =>
                  setForm((s) => ({ ...s, department: v as InternalTestHoldDepartment }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>结算方式</Label>
              <Select
                value={form.settlementMode}
                onValueChange={(v) =>
                  setForm((s) => ({ ...s, settlementMode: v as InternalTestHoldSettlement }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择" />
                </SelectTrigger>
                <SelectContent>
                  {SETTLEMENT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>卡型与台数</Label>
            <div className="space-y-3">
              {cardRows.map((row, idx) => (
                <div key={row.key} className="space-y-3 rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      卡型 {idx + 1}
                    </span>
                    {cardRows.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCardRow(row.key)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">卡型</Label>
                      <Select
                        value={row.gpuCardTypeId}
                        onValueChange={(v) => updateCardRow(row.key, { gpuCardTypeId: v })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="选择" />
                        </SelectTrigger>
                        <SelectContent>
                          {cardTypeOptions.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">台数</Label>
                      <Input
                        type="number"
                        min={1}
                        placeholder="例如 4"
                        value={row.unitCount}
                        onChange={(e) => updateCardRow(row.key, { unitCount: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" className="w-full gap-2" onClick={addCardRow}>
                <Plus className="h-4 w-4" />
                添加卡型
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>开始时间</Label>
              <Input
                type="datetime-local"
                value={form.holdFrom}
                onChange={(e) => setForm((s) => ({ ...s, holdFrom: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>计划结束（可选）</Label>
              <Input
                type="datetime-local"
                value={form.holdUntil}
                onChange={(e) => setForm((s) => ({ ...s, holdUntil: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>备注</Label>
            <Input
              value={form.remark}
              onChange={(e) => setForm((s) => ({ ...s, remark: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createMutation.isPending}>
            取消
          </Button>
          <Button onClick={createHold} disabled={createMutation.isPending}>
            {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
