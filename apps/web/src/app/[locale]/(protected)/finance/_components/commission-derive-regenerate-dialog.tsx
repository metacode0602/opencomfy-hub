'use client'

import {
  MissingPricingAlerts,
  type MissingPricingIssue,
} from '@/app/[locale]/(protected)/finance/_components/missing-pricing-alerts'
import { fileToBase64 } from '@/lib/utils/file-to-base64'
import { trpc } from '@/lib/trpc/client'
import { Button } from '@workspace/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { IconLoader2, IconUpload } from '@tabler/icons-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

type SlotState = {
  file: File | null
  status: 'empty' | 'parsing' | 'done' | 'error'
  message: string
  rowCount: number
}

function emptySlot(): SlotState {
  return { file: null, status: 'empty', message: '', rowCount: 0 }
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  billingPeriodId: string
  periodCode: string
  periodStart: string
  periodEnd: string
  isPublished: boolean
  onSuccess?: () => void
}

export function CommissionDeriveRegenerateDialog({
  open,
  onOpenChange,
  billingPeriodId,
  periodCode,
  periodStart,
  periodEnd,
  isPublished,
  onSuccess,
}: Props) {
  const utils = trpc.useUtils()
  const importFile = trpc.finance.periods.importFile.useMutation()
  const runDerive = trpc.finance.commissionDerive.run.useMutation()

  const { data: validation } = trpc.finance.periods.validate.useQuery(
    { billingPeriodId },
    { enabled: open && Boolean(billingPeriodId) },
  )

  const windowId = validation?.slots?.tenantBillWindows?.[0]?.windowId ?? null

  const [baremetal, setBaremetal] = useState<SlotState>(emptySlot())
  const [tenantBill, setTenantBill] = useState<SlotState>(emptySlot())
  const [deriveError, setDeriveError] = useState<string | null>(null)
  const [missingPricing, setMissingPricing] = useState<MissingPricingIssue[]>([])

  const resetSlots = useCallback(() => {
    setBaremetal(emptySlot())
    setTenantBill(emptySlot())
    setDeriveError(null)
    setMissingPricing([])
  }, [])

  useEffect(() => {
    if (!open) resetSlots()
  }, [open, resetSlots])

  const handleBaremetalChange = async (file: File | null) => {
    if (!file || isPublished) return
    setBaremetal({ file, status: 'parsing', message: '解析中…', rowCount: 0 })
    try {
      const fileBase64 = await fileToBase64(file)
      const result = await importFile.mutateAsync({
        billingPeriodId,
        slot: 'baremetal',
        fileName: file.name,
        fileBase64,
        preserveIncomeDerived: true,
      })
      setBaremetal({
        file,
        status: result.ok ? 'done' : 'error',
        message: result.message,
        rowCount: result.rowCount,
      })
      if (!result.ok) toast.error(result.message)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '裸金属订单上传失败'
      setBaremetal({ file, status: 'error', message: msg, rowCount: 0 })
      toast.error(msg)
    }
  }

  const handleTenantBillChange = async (file: File | null) => {
    if (!file || !windowId || isPublished) return
    setTenantBill({ file, status: 'parsing', message: '解析中…', rowCount: 0 })
    try {
      const fileBase64 = await fileToBase64(file)
      const result = await importFile.mutateAsync({
        billingPeriodId,
        slot: 'tenantBill',
        fileName: file.name,
        fileBase64,
        windowId,
        preserveIncomeDerived: true,
      })
      setTenantBill({
        file,
        status: result.ok ? 'done' : 'error',
        message: result.message,
        rowCount: result.rowCount,
      })
      if (!result.ok) toast.error(result.message)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '客户账单详情上传失败'
      setTenantBill({ file, status: 'error', message: msg, rowCount: 0 })
      toast.error(msg)
    }
  }

  const needsUpload = !isPublished
  const uploadReady =
    !needsUpload ||
    (baremetal.status === 'done' && tenantBill.status === 'done') ||
    (baremetal.status === 'empty' && tenantBill.status === 'empty')

  const canConfirm = uploadReady && !runDerive.isPending

  const handleConfirm = async () => {
    if (!canConfirm) return
    setDeriveError(null)
    setMissingPricing([])
    try {
      const result = await runDerive.mutateAsync({ billingPeriodId })
      await utils.finance.commissionDerive.getByPeriod.invalidate({ billingPeriodId })
      toast.success(
        `提成派生完成（${result.projectCount} 个项目，${result.issueCount} 条异常）`,
      )
      onOpenChange(false)
      onSuccess?.()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '提成派生失败'
      setDeriveError(msg)
      try {
        const validation = await utils.finance.periods.validate.fetch({
          billingPeriodId,
        })
        setMissingPricing(validation.missingPricing)
      } catch {
        // ignore
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-[40vw] max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>重新上传并派生提成 · {periodCode}</DialogTitle>
          <DialogDescription>
            {isPublished
              ? '账期已发布：将基于现有成本源行重新派生提成，不会覆盖已发布成本数据。如需更换 Excel 请先撤回发布。'
              : `请上传客户账单详情（${periodStart} ~ ${periodEnd}）与裸金属订单后执行派生；未更换文件也可直接派生。`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <MissingPricingAlerts message={deriveError} missingPricing={missingPricing} />

          {!isPublished ? (
            <>
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <p className="font-medium">裸金属消费订单</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <label className="cursor-pointer">
                      <IconUpload className="mr-1 size-4" />
                      选择文件
                      <input
                        type="file"
                        className="sr-only"
                        accept=".xlsx,.xls,.csv"
                        onChange={(e) => {
                          void handleBaremetalChange(e.target.files?.[0] ?? null)
                          e.target.value = ''
                        }}
                      />
                    </label>
                  </Button>
                  {baremetal.file ? (
                    <span className="text-sm text-muted-foreground truncate max-w-[220px]">
                      {baremetal.file.name}
                    </span>
                  ) : null}
                </div>
                {baremetal.status !== 'empty' ? (
                  <p
                    className={
                      baremetal.status === 'error'
                        ? 'text-sm text-destructive'
                        : 'text-sm text-muted-foreground'
                    }
                  >
                    {baremetal.message}
                  </p>
                ) : null}
              </div>

              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <p className="font-medium">
                  客户账单详情（{periodStart} ~ {periodEnd}）
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    asChild
                    disabled={!windowId}
                  >
                    <label
                      className={
                        windowId ? 'cursor-pointer' : 'pointer-events-none opacity-50'
                      }
                    >
                      <IconUpload className="mr-1 size-4" />
                      选择文件
                      <input
                        type="file"
                        className="sr-only"
                        accept=".xlsx,.xls,.csv"
                        disabled={!windowId}
                        onChange={(e) => {
                          void handleTenantBillChange(e.target.files?.[0] ?? null)
                          e.target.value = ''
                        }}
                      />
                    </label>
                  </Button>
                  {tenantBill.file ? (
                    <span className="text-sm text-muted-foreground truncate max-w-[220px]">
                      {tenantBill.file.name}
                    </span>
                  ) : null}
                </div>
                {tenantBill.status !== 'empty' ? (
                  <p
                    className={
                      tenantBill.status === 'error'
                        ? 'text-sm text-destructive'
                        : 'text-sm text-muted-foreground'
                    }
                  >
                    {tenantBill.message}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={runDerive.isPending}>
            取消
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={!canConfirm}>
            {runDerive.isPending ? (
              <>
                <IconLoader2 className="mr-2 size-4 animate-spin" />
                派生中…
              </>
            ) : (
              '确认派生'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
