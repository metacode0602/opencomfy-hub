'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@workspace/ui/components/button'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import { Textarea } from '@workspace/ui/components/textarea'
import { todayShanghaiDateString } from '@/lib/crm/project-effective-dates'
import { trpc } from '@/lib/trpc/client'

export type MerchantAccountManagerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  merchantId: string | null
  merchantName?: string | null
  onSaved?: () => void
}

export function MerchantAccountManagerDialog({
  open,
  onOpenChange,
  merchantId,
  merchantName,
  onSaved,
}: MerchantAccountManagerDialogProps) {
  const [staffId, setStaffId] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(todayShanghaiDateString())
  const [remark, setRemark] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { data: assignment, isLoading } = trpc.merchant.getAccountManagerAssignment.useQuery(
    { id: merchantId ?? '' },
    { enabled: open && !!merchantId },
  )
  const { data: staff = [] } = trpc.crm.staff.listActive.useQuery(undefined, { enabled: open })

  const saveMutation = trpc.merchant.changeAccountManager.useMutation({
    onSuccess: () => {
      toast.success('客户经理已更新')
      onSaved?.()
      onOpenChange(false)
    },
    onError: (e) => setSubmitError(e.message),
  })

  useEffect(() => {
    if (!open || !merchantId) return
    setEffectiveFrom(todayShanghaiDateString())
    setRemark('')
    setSubmitError(null)
  }, [open, merchantId])

  useEffect(() => {
    if (!open) return
    if (assignment?.staffId) {
      setStaffId(assignment.staffId)
    } else {
      setStaffId('')
    }
  }, [open, assignment?.staffId])

  const handleSubmit = () => {
    if (!merchantId) return
    if (!staffId) {
      setSubmitError('请选择客户经理')
      return
    }
    if (!effectiveFrom) {
      setSubmitError('请选择生效日期')
      return
    }
    saveMutation.mutate({
      merchantId,
      staffId,
      effectiveFrom,
      remark: remark.trim() || undefined,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>设置客户经理</DialogTitle>
          <DialogDescription>
            {merchantName
              ? `商户「${merchantName}」：可指定生效日期（支持补录历史）。当前主责：${
                  assignment?.staffName ?? '未设置'
                }${assignment?.effectiveFrom ? `（自 ${assignment.effectiveFrom} 起）` : ''}`
              : '设置商户客户经理'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">加载中…</p>
        ) : (
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="merchant-am-staff">客户经理</Label>
              <Select value={staffId || undefined} onValueChange={setStaffId}>
                <SelectTrigger id="merchant-am-staff" className="w-full">
                  <SelectValue placeholder="请选择" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="merchant-am-effective">生效日期</Label>
              <Input
                id="merchant-am-effective"
                type="date"
                value={effectiveFrom}
                onChange={(e) => {
                  setEffectiveFrom(e.target.value)
                  setSubmitError(null)
                }}
              />
              <p className="text-xs text-muted-foreground">
                生效日早于当前主责起始日时，将插入历史段且不改变当前主责。
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="merchant-am-remark">备注（可选）</Label>
              <Textarea
                id="merchant-am-remark"
                rows={2}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="变更原因"
              />
            </div>
          </div>
        )}

        {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!merchantId || isLoading || saveMutation.isPending}
          >
            {saveMutation.isPending ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
