'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { MerchantRechargeAttachment, MerchantRechargeRecord, MerchantRechargeStatus } from '@/lib/types/merchant'
import { merchantRechargeStatusLabels } from './merchant-utils'
import {
  MerchantRechargeVoucherUpload,
  type PendingVoucherFile,
} from './merchant-recharge-voucher-upload'
import { Button } from '@workspace/ui/components/button'
import {
  Dialog,
  DialogContent,
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

const PAYMENT_METHODS = ['银行转账', '支付宝', '微信', '发票'] as const

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

export type MerchantRechargeFormInput = {
  amount: number
  paymentMethod: string
  status: MerchantRechargeStatus
  transactionId?: string
  rechargeDate: string
  remark?: string
  keepAttachmentIds: string[]
  files: { fileName: string; mimeType: string; fileBase64: string }[]
}

export type MerchantRechargeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  record?: MerchantRechargeRecord
  onSubmit: (input: MerchantRechargeFormInput) => void | Promise<void>
}

export function MerchantRechargeDialog({
  open,
  onOpenChange,
  mode,
  record,
  onSubmit,
}: MerchantRechargeDialogProps) {
  const [amountInput, setAmountInput] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0])
  const [status, setStatus] = useState<MerchantRechargeStatus>('pending')
  const [transactionId, setTransactionId] = useState('')
  const [rechargeDate, setRechargeDate] = useState('')
  const [remark, setRemark] = useState('')
  const [existingAttachments, setExistingAttachments] = useState<MerchantRechargeAttachment[]>([])
  const [pendingFiles, setPendingFiles] = useState<PendingVoucherFile[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && record) {
      setAmountInput(String(record.amount))
      setPaymentMethod(record.paymentMethod)
      setStatus(record.status)
      setTransactionId(record.transactionId ?? '')
      setRechargeDate(record.rechargeDate)
      setRemark(record.remark ?? '')
      setExistingAttachments(record.attachments)
      setPendingFiles([])
    } else {
      setAmountInput('')
      setPaymentMethod(PAYMENT_METHODS[0])
      setStatus('pending')
      setTransactionId('')
      setRechargeDate(new Date().toISOString().slice(0, 10))
      setRemark('')
      setExistingAttachments([])
      setPendingFiles([])
    }
  }, [open, mode, record])

  const handleSubmit = async () => {
    const amount = Number(amountInput)
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('充值金额须为正数')
      return
    }
    if (!rechargeDate.trim()) {
      toast.error('请填写充值日期')
      return
    }

    const totalVouchers = existingAttachments.length + pendingFiles.length
    const voucherRequired = mode === 'create' || record?.source === 'manual'
    if (voucherRequired && totalVouchers === 0) {
      toast.error('请至少上传 1 个充值凭证')
      return
    }

    setSubmitting(true)
    try {
      const files = await Promise.all(
        pendingFiles.map(async (item) => ({
          fileName: item.file.name,
          mimeType: item.file.type || 'application/octet-stream',
          fileBase64: await fileToBase64(item.file),
        })),
      )

      await onSubmit({
        amount,
        paymentMethod,
        status,
        transactionId: transactionId.trim() || undefined,
        rechargeDate: rechargeDate.trim(),
        remark: remark.trim() || undefined,
        keepAttachmentIds: existingAttachments.map((a) => a.id),
        files,
      })
      onOpenChange(false)
    } catch {
      toast.error('凭证文件处理失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] min-w-[30vw] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '新增充值记录' : '编辑充值记录'}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="recharge-amount">充值金额（元）</Label>
            <Input
              id="recharge-amount"
              type="number"
              min={0}
              step="0.01"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-2">
              <Label>支付方式</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={submitting}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>状态</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as MerchantRechargeStatus)}
                disabled={submitting}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(merchantRechargeStatusLabels) as MerchantRechargeStatus[]).map(
                    (s) => (
                      <SelectItem key={s} value={s}>
                        {merchantRechargeStatusLabels[s]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-2">
              <Label htmlFor="recharge-date">充值日期</Label>
              <Input
                id="recharge-date"
                type="date"
                value={rechargeDate}
                onChange={(e) => setRechargeDate(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="recharge-tx">交易流水号</Label>
              <Input
                id="recharge-tx"
                className="font-mono text-xs"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="可选"
                disabled={submitting}
              />
            </div>
          </div>

          <MerchantRechargeVoucherUpload
            existing={existingAttachments}
            pending={pendingFiles}
            onExistingChange={setExistingAttachments}
            onPendingChange={setPendingFiles}
            required={mode === 'create' || record?.source === 'manual'}
          />

          <div className="grid gap-2">
            <Label htmlFor="recharge-remark">备注</Label>
            <Textarea
              id="recharge-remark"
              rows={2}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                处理中…
              </>
            ) : mode === 'create' ? (
              '添加'
            ) : (
              '保存'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
