'use client'

import { useState } from 'react'
import { Ban, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@workspace/ui/components/button'
import { Label } from '@workspace/ui/components/label'
import { Textarea } from '@workspace/ui/components/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@workspace/ui/components/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@workspace/ui/components/tooltip'
import { trpc } from '@/lib/trpc/client'
import { invalidateGlobalDashboard } from '@/lib/dashboard/invalidate-global-dashboard'

const TERMINAL_BATCH_STATUSES = ['已完成', '已取消', 'cancelled'] as const

export function BatchLifecycleActions({
  batchId,
  batchStatus,
  touchedDeviceCount,
  batchKind,
  onSuccess,
}: {
  batchId: string
  batchStatus: string
  touchedDeviceCount: number
  batchKind: string
  onSuccess?: () => void
}) {
  const utils = trpc.useUtils()
  const [completeOpen, setCompleteOpen] = useState(false)
  const [voidOpen, setVoidOpen] = useState(false)
  const [completeRemark, setCompleteRemark] = useState('')
  const [voidReason, setVoidReason] = useState('')

  const isTerminal = TERMINAL_BATCH_STATUSES.includes(
    batchStatus as (typeof TERMINAL_BATCH_STATUSES)[number],
  )
  const canVoid = touchedDeviceCount === 0
  const kindNoun =
    batchKind === 'device_retire' ? '下架' : batchKind === 'order_access' ? '订单接入' : '上架'

  const completeMutation = trpc.supplier.onboardingBatch.completeBatch.useMutation({
    onSuccess: () => {
      toast.success('批次已确认完成')
      setCompleteOpen(false)
      setCompleteRemark('')
      void utils.supplier.onboardingBatch.getDetailPage.invalidate({ batchId })
      void utils.supplier.onboardingBatch.listProgressEvents.invalidate({ batchId })
      void utils.supplier.deviceRetire.getBatchById.invalidate({ id: batchId })
      invalidateGlobalDashboard(utils)
      onSuccess?.()
    },
    onError: (e) => toast.error(e.message),
  })

  const voidMutation = trpc.supplier.onboardingBatch.voidBatch.useMutation({
    onSuccess: () => {
      toast.success('批次已作废')
      setVoidOpen(false)
      setVoidReason('')
      void utils.supplier.onboardingBatch.getDetailPage.invalidate({ batchId })
      void utils.supplier.onboardingBatch.listProgressEvents.invalidate({ batchId })
      void utils.supplier.deviceRetire.getBatchById.invalidate({ id: batchId })
      invalidateGlobalDashboard(utils)
      onSuccess?.()
    },
    onError: (e) => toast.error(e.message),
  })

  if (isTerminal) return null

  const pending = completeMutation.isPending || voidMutation.isPending

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="default"
          className="gap-2"
          disabled={pending}
          onClick={() => setCompleteOpen(true)}
        >
          <CheckCircle2 className="w-4 h-4" />
          确认完成
        </Button>

        {canVoid ? (
          <Button
            variant="outline"
            className="gap-2 text-destructive hover:text-destructive"
            disabled={pending}
            onClick={() => setVoidOpen(true)}
          >
            <Ban className="w-4 h-4" />
            作废
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button variant="outline" className="gap-2" disabled>
                  <Ban className="w-4 h-4" />
                  作废
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              已有 {touchedDeviceCount} 台设备接入，不可作废。请使用「调整计划」或「确认完成」。
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <AlertDialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认完成{kindNoun}批次？</AlertDialogTitle>
            <AlertDialogDescription>
              将把批次标记为「已完成」，并写入进度时间轴。已接入 {touchedDeviceCount} 台设备仍可保留关联记录。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="complete-remark">备注（可选）</Label>
            <Textarea
              id="complete-remark"
              value={completeRemark}
              onChange={(e) => setCompleteRemark(e.target.value)}
              placeholder="如：商务确认提前结案"
              rows={2}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(e) => {
                e.preventDefault()
                completeMutation.mutate({
                  batchId,
                  remark: completeRemark.trim() || undefined,
                })
              }}
            >
              {pending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              确认完成
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={voidOpen} onOpenChange={setVoidOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>作废{kindNoun}批次？</AlertDialogTitle>
            <AlertDialogDescription>
              将把批次标记为已取消，并从目标台账与计划缺口中排除。此操作不可通过详情页撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="void-reason">作废原因（必填）</Label>
            <Textarea
              id="void-reason"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="请说明作废原因，至少 4 字"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={pending || voidReason.trim().length < 4}
              onClick={(e) => {
                e.preventDefault()
                voidMutation.mutate({ batchId, reason: voidReason.trim() })
              }}
            >
              {pending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              确认作废
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  )
}
