'use client'

import { getPeriodDateRange, isValidPeriodCode } from '@/app/[locale]/(protected)/finance/_lib/period'
import { BillingPeriodCostPreCheckAlerts } from '@/app/[locale]/(protected)/finance/_components/billing-period-cost-pre-check-alerts'
import { fileToBase64 } from '@/lib/utils/file-to-base64'
import { trpc } from '@/lib/trpc/client'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Checkbox } from '@workspace/ui/components/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { IconCheck, IconLoader2, IconUpload } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

type SlotState = {
  file: File | null
  status: 'empty' | 'parsing' | 'done' | 'error'
  message: string
  rowCount: number
}

type TenantBillWindowSlot = {
  windowId: string
  windowStart: string
  windowEnd: string
  state: SlotState
}

type CreatedPeriod = {
  id: string
  periodCode: string
  periodStart: string
  periodEnd: string
  ignoreListPriceWindows: boolean
}

type DialogPhase = 'create' | 'manage'

export type CreateBillingPeriodDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 成本计算成功后回调 */
  onPeriodReady?: (period: { id: string }) => void
  /** 重新上传等场景：直接进入 manage 阶段 */
  initialPeriodId?: string | null
}

const BAREMETAL_HINT =
  'Excel：订单ID、租户ID、机房名称、设备型号（卡型 x 卡数）、购买数量（数量 x 时长包）、最终总额、下单时间等列'

const TENANT_BILL_HINT =
  'Excel 或 CSV：客户ID、总消费、卡时、GPU 型号、区域等列（该时间段内汇总）'

function emptySlot(): SlotState {
  return { file: null, status: 'empty', message: '', rowCount: 0 }
}

function emptyTenantBillSlot(
  window: { id: string; windowStart: string; windowEnd: string },
): TenantBillWindowSlot {
  return {
    windowId: window.id,
    windowStart: window.windowStart,
    windowEnd: window.windowEnd,
    state: emptySlot(),
  }
}

export function CreateBillingPeriodDialog({
  open,
  onOpenChange,
  onPeriodReady,
  initialPeriodId = null,
}: CreateBillingPeriodDialogProps) {
  const utils = trpc.useUtils()
  const createPeriod = trpc.finance.periods.create.useMutation()
  const importFile = trpc.finance.periods.importFile.useMutation()
  const computeCost = trpc.finance.periods.computeCost.useMutation()

  const [phase, setPhase] = useState<DialogPhase>('create')
  const [periodCode, setPeriodCode] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [ignoreListPriceWindows, setIgnoreListPriceWindows] = useState(true)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createdPeriod, setCreatedPeriod] = useState<CreatedPeriod | null>(null)

  const [baremetalSlot, setBaremetalSlot] = useState<SlotState>(emptySlot())
  const [tenantBillSlots, setTenantBillSlots] = useState<TenantBillWindowSlot[]>([])
  const [computingCost, setComputingCost] = useState(false)
  const [computeError, setComputeError] = useState<string | null>(null)
  const [computeMissingPricing, setComputeMissingPricing] = useState<
    Parameters<typeof BillingPeriodCostPreCheckAlerts>[0]['missingPricing']
  >([])

  const periodId = createdPeriod?.id ?? null

  const datesReady =
    Boolean(periodStart) && Boolean(periodEnd) && periodStart <= periodEnd

  const { data: priceWindowPreview } = trpc.finance.periods.detectPriceWindows.useQuery(
    { periodStart, periodEnd },
    { enabled: open && phase === 'create' && datesReady && !ignoreListPriceWindows },
  )

  const { data: validation, refetch: refetchValidation } =
    trpc.finance.periods.validate.useQuery(
      { billingPeriodId: periodId! },
      { enabled: open && Boolean(periodId) },
    )

  const { data: initialPeriod } = trpc.finance.periods.getById.useQuery(
    { id: initialPeriodId! },
    { enabled: open && Boolean(initialPeriodId) },
  )

  const resetState = useCallback(() => {
    setPhase('create')
    setPeriodCode('')
    setPeriodStart('')
    setPeriodEnd('')
    setIgnoreListPriceWindows(true)
    setCreating(false)
    setCreateError(null)
    setCreatedPeriod(null)
    setBaremetalSlot(emptySlot())
    setTenantBillSlots([])
    setComputingCost(false)
    setComputeError(null)
    setComputeMissingPricing([])
  }, [])

  useEffect(() => {
    if (!open) {
      resetState()
    }
  }, [open, resetState])

  useEffect(() => {
    if (!open || !initialPeriodId || createdPeriod) return
    if (!initialPeriod) return
    setCreatedPeriod({
      id: initialPeriod.id,
      periodCode: initialPeriod.period_code,
      periodStart: initialPeriod.period_start,
      periodEnd: initialPeriod.period_end,
      ignoreListPriceWindows: initialPeriod.ignore_list_price_windows,
    })
    setPeriodCode(initialPeriod.period_code)
    setPeriodStart(initialPeriod.period_start)
    setPeriodEnd(initialPeriod.period_end)
    setIgnoreListPriceWindows(initialPeriod.ignore_list_price_windows)
    setPhase('manage')
    setBaremetalSlot(emptySlot())
    setTenantBillSlots([])
  }, [open, initialPeriodId, initialPeriod, createdPeriod])

  useEffect(() => {
    if (!validation?.windows?.length || !periodId) return
    setTenantBillSlots((prev) => {
      if (prev.length > 0 && prev.every((p) => !p.windowId.startsWith('preview-'))) {
        return prev
      }
      return validation.windows.map((w) => {
        const existing = prev.find((p) => p.windowId === w.id)
        return existing ?? emptyTenantBillSlot(w)
      })
    })
  }, [validation?.windows, periodId])

  useEffect(() => {
    if (!validation?.slots?.tenantBillWindows || !periodId) return
    setTenantBillSlots((prev) =>
      validation.slots.tenantBillWindows.map((w) => {
        const existing = prev.find((p) => p.windowId === w.windowId)
        const base = existing ?? emptyTenantBillSlot({
          id: w.windowId,
          windowStart: w.windowStart,
          windowEnd: w.windowEnd,
        })
        if (w.parseStatus === 'empty') return base
        return {
          ...base,
          state: {
            ...base.state,
            status: w.parseStatus === 'ok' ? 'done' : 'error',
            message:
              w.parseStatus === 'ok'
                ? `解析成功（${w.rowCount} 行）`
                : w.parseErrorCount > 0
                  ? `存在 ${w.parseErrorCount} 处错误`
                  : '解析未通过',
            rowCount: w.rowCount,
          },
        }
      }),
    )
  }, [validation?.slots?.tenantBillWindows, periodId])

  useEffect(() => {
    if (!validation?.slots?.baremetal) {
      return
    }
    const b = validation.slots.baremetal
    setBaremetalSlot((prev) => ({
      ...prev,
      status: b.parseStatus === 'ok' ? 'done' : 'error',
      message:
        b.parseStatus === 'ok'
          ? `解析成功（${b.rowCount} 行）`
          : b.parseErrorCount > 0
            ? `存在 ${b.parseErrorCount} 处错误`
            : '解析未通过',
      rowCount: b.rowCount,
    }))
  }, [validation?.slots?.baremetal])

  const canCreate =
    isValidPeriodCode(periodCode) &&
    datesReady &&
    !creating

  const costImportsReady = useMemo(() => {
    if (baremetalSlot.status !== 'done') return false
    if (tenantBillSlots.length === 0) return false
    return tenantBillSlots.every((w) => w.state.status === 'done')
  }, [baremetalSlot.status, tenantBillSlots])

  const canComputeCost =
    Boolean(periodId) &&
    costImportsReady &&
    (validation?.canComputeCost ?? false) &&
    !computingCost &&
    !importFile.isPending

  const handleCreate = async () => {
    if (!canCreate) return
    setCreating(true)
    setCreateError(null)
    try {
      const created = await createPeriod.mutateAsync({
        periodCode: periodCode.trim(),
        periodStart,
        periodEnd,
        ignoreListPriceWindows,
      })
      setCreatedPeriod({
        id: created.id,
        periodCode: created.period_code,
        periodStart: created.period_start,
        periodEnd: created.period_end,
        ignoreListPriceWindows: created.ignore_list_price_windows,
      })
      setPhase('manage')
      await utils.finance.periods.validate.invalidate({ billingPeriodId: created.id })
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : '创建账期失败')
    } finally {
      setCreating(false)
    }
  }

  const handleBaremetalUpload = async (file: File | null) => {
    if (!file || !periodId) return
    setBaremetalSlot({ file, status: 'parsing', message: '解析中…', rowCount: 0 })
    setComputeError(null)
    try {
      const result = await importFile.mutateAsync({
        billingPeriodId: periodId,
        slot: 'baremetal',
        fileName: file.name,
        fileBase64: await fileToBase64(file),
      })
      setBaremetalSlot({
        file,
        status: result.ok ? 'done' : 'error',
        message: result.message,
        rowCount: result.rowCount,
      })
      if (!result.ok) toast.error(result.message)
      await refetchValidation()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '裸金属订单上传失败'
      setBaremetalSlot({ file, status: 'error', message: msg, rowCount: 0 })
      toast.error(msg)
    }
  }

  const handleTenantBillUpload = async (windowId: string, file: File | null) => {
    if (!file || !periodId) return
    setTenantBillSlots((prev) =>
      prev.map((w) =>
        w.windowId === windowId
          ? { ...w, state: { file, status: 'parsing', message: '解析中…', rowCount: 0 } }
          : w,
      ),
    )
    setComputeError(null)
    try {
      const result = await importFile.mutateAsync({
        billingPeriodId: periodId,
        slot: 'tenantBill',
        fileName: file.name,
        fileBase64: await fileToBase64(file),
        windowId,
      })
      setTenantBillSlots((prev) =>
        prev.map((w) =>
          w.windowId === windowId
            ? {
                ...w,
                state: {
                  file,
                  status: result.ok ? 'done' : 'error',
                  message: result.message,
                  rowCount: result.rowCount,
                },
              }
            : w,
        ),
      )
      if (!result.ok) toast.error(result.message)
      await refetchValidation()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '客户账单详情上传失败'
      setTenantBillSlots((prev) =>
        prev.map((w) =>
          w.windowId === windowId
            ? { ...w, state: { file, status: 'error', message: msg, rowCount: 0 } }
            : w,
        ),
      )
      toast.error(msg)
    }
  }

  const handleComputeCost = async () => {
    if (!canComputeCost || !periodId) return
    setComputingCost(true)
    setComputeError(null)
    setComputeMissingPricing([])
    try {
      const result = await computeCost.mutateAsync({ billingPeriodId: periodId })
      await utils.finance.periods.list.invalidate()
      await utils.finance.periods.getBundle.invalidate({ id: periodId })
      toast.success(`成本已计算（${result.costCount} 条分项）`)
      onPeriodReady?.({ id: periodId })
      onOpenChange(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '计算成本失败'
      setComputeError(msg)
      try {
        const fresh = await utils.finance.periods.validate.fetch({
          billingPeriodId: periodId,
        })
        setComputeMissingPricing(fresh.missingPricing)
      } catch {
        // ignore
      }
    } finally {
      setComputingCost(false)
    }
  }

  const displayMissingPricing =
    (computeMissingPricing?.length ?? 0) > 0
      ? (computeMissingPricing ?? [])
      : (validation?.missingPricing ?? [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-[40vw] max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {phase === 'create' ? '添加账期' : `账期 ${createdPeriod?.periodCode}`}
          </DialogTitle>
          <DialogDescription>
            {phase === 'create'
              ? '填写账期信息后创建；创建成功后上传裸金属与客户账单并计算成本。收入请在账期详情页单独处理。'
              : `上传成本 Excel 并计算；${createdPeriod?.ignoreListPriceWindows ? '已忽略刊例价分段' : '按刊例价变动分段上传'}`}
          </DialogDescription>
        </DialogHeader>

        {phase === 'create' ? (
          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="dialog_period_code">账期编码</Label>
                <Input
                  id="dialog_period_code"
                  placeholder="YYYY-MM，例如 2026-06"
                  value={periodCode}
                  onChange={(e) => {
                    const v = e.target.value
                    setPeriodCode(v)
                    const range = getPeriodDateRange(v)
                    if (range) {
                      setPeriodStart(range.start)
                      setPeriodEnd(range.end)
                    }
                  }}
                />
                {periodCode.trim() && !isValidPeriodCode(periodCode) && (
                  <p className="text-sm text-destructive">账期编码格式应为 YYYY-MM</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="dialog_period_start">账期开始</Label>
                <Input
                  id="dialog_period_start"
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dialog_period_end">账期结束</Label>
                <Input
                  id="dialog_period_end"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
            </div>

            {periodStart && periodEnd && periodStart > periodEnd && (
              <p className="text-sm text-destructive">结束日期不能早于开始日期</p>
            )}

            <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
              <Checkbox
                id="ignore_list_price"
                checked={ignoreListPriceWindows}
                onCheckedChange={(v) => setIgnoreListPriceWindows(v === true)}
              />
              <div className="space-y-1">
                <Label htmlFor="ignore_list_price" className="cursor-pointer font-medium">
                  忽略刊例价分段
                </Label>
                <p className="text-xs text-muted-foreground">
                  开启后整月上传一份客户账单，成本按账期结束日当前刊例价计算；关闭则按刊例价变动日切分多段上传。
                </p>
              </div>
            </div>

            <BillingPeriodCostPreCheckAlerts
              priceWindowPreview={priceWindowPreview}
              ignoreListPriceWindows={ignoreListPriceWindows}
            />

            {createError && <p className="text-sm text-destructive">{createError}</p>}
          </div>
        ) : (
          <div className="space-y-6 py-2">
            <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <IconCheck className="size-4 text-green-600" />
              <span>账期已创建</span>
              <Badge variant="outline">{createdPeriod?.periodCode}</Badge>
              <span className="text-muted-foreground">
                {createdPeriod?.periodStart} ~ {createdPeriod?.periodEnd}
              </span>
              {createdPeriod?.ignoreListPriceWindows ? (
                <Badge variant="secondary">忽略刊例价分段</Badge>
              ) : null}
            </div>

            <BillingPeriodCostPreCheckAlerts
              computeError={computeError}
              missingPricing={displayMissingPricing}
              pendingAllocationCount={validation?.pendingAllocationCount}
              pendingAllocations={validation?.pendingAllocations}
              priceWindowInfo={validation?.priceWindowInfo}
              ignoreListPriceWindows={createdPeriod?.ignoreListPriceWindows}
            />

            <section className="space-y-3">
              <h3 className="font-medium">上传并计算成本</h3>
              <p className="text-xs text-muted-foreground">
                须上传裸金属消费订单与客户账单详情，全部解析成功且分成配置就绪后可计算。
              </p>

              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">裸金属消费订单列表</p>
                    <p className="text-xs text-muted-foreground">{BAREMETAL_HINT}</p>
                  </div>
                  {baremetalSlot.status === 'parsing' && (
                    <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
                  )}
                </div>
                <UploadRow
                  slot={baremetalSlot}
                  disabled={computingCost}
                  onFile={(f) => void handleBaremetalUpload(f)}
                />
              </div>

              {tenantBillSlots.map((windowSlot) => (
                <div
                  key={windowSlot.windowId}
                  className="rounded-lg border bg-muted/30 p-4 space-y-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        客户账单详情（{windowSlot.windowStart} ~ {windowSlot.windowEnd}）
                      </p>
                      <p className="text-xs text-muted-foreground">{TENANT_BILL_HINT}</p>
                    </div>
                    {windowSlot.state.status === 'parsing' && (
                      <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <UploadRow
                    slot={windowSlot.state}
                    disabled={computingCost}
                    onFile={(f) => void handleTenantBillUpload(windowSlot.windowId, f)}
                  />
                </div>
              ))}

              {tenantBillSlots.length === 0 && periodId && (
                <p className="text-sm text-muted-foreground">正在加载账单时间段…</p>
              )}

              <div className="flex justify-end">
                <Button
                  type="button"
                  disabled={!canComputeCost}
                  onClick={() => void handleComputeCost()}
                >
                  {computingCost ? (
                    <>
                      <IconLoader2 className="mr-2 size-4 animate-spin" />
                      计算成本中…
                    </>
                  ) : (
                    '计算成本'
                  )}
                </Button>
              </div>
            </section>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {phase === 'create' ? (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button type="button" disabled={!canCreate} onClick={() => void handleCreate()}>
                {creating ? (
                  <>
                    <IconLoader2 className="mr-2 size-4 animate-spin" />
                    创建中…
                  </>
                ) : (
                  '创建账期'
                )}
              </Button>
            </>
          ) : (
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              关闭
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function UploadRow({
  slot,
  disabled,
  onFile,
}: {
  slot: SlotState
  disabled?: boolean
  onFile: (file: File | null) => void
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" asChild disabled={disabled || slot.status === 'parsing'}>
          <label
            className={
              disabled || slot.status === 'parsing'
                ? 'pointer-events-none opacity-50'
                : 'cursor-pointer'
            }
          >
            <IconUpload className="mr-1 size-4" />
            选择文件
            <input
              type="file"
              className="sr-only"
              accept=".xlsx,.xls,.csv"
              disabled={disabled || slot.status === 'parsing'}
              onChange={(e) => {
                onFile(e.target.files?.[0] ?? null)
                e.target.value = ''
              }}
            />
          </label>
        </Button>
        {slot.file && (
          <span className="max-w-[220px] truncate text-sm text-muted-foreground">
            {slot.file.name}
          </span>
        )}
      </div>
      {slot.status !== 'empty' && (
        <p
          className={
            slot.status === 'error'
              ? 'text-sm text-destructive'
              : 'text-sm text-muted-foreground'
          }
        >
          {slot.message}
        </p>
      )}
    </>
  )
}
