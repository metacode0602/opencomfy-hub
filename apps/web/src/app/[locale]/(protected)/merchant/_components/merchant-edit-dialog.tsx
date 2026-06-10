'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { Merchant, MerchantAccessMode, MerchantStatus, MerchantType } from '@/lib/types/merchant'
import {
  merchantAccessModeLabels,
  merchantStatusLabels,
  merchantTypeLabels,
} from './merchant-utils'
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

export type MerchantEditDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  merchant: Merchant
  onSave: (input: {
    name: string
    companyFullName: string
    unifiedSocialCreditCode: string
    merchantMark: string
    accessMode: MerchantAccessMode
    type: MerchantType
    status: MerchantStatus
    contactUser: string
    contactPhone: string
    remark: string
  }) => void | Promise<void>
}

export function MerchantEditDialog({
  open,
  onOpenChange,
  merchant,
  onSave,
}: MerchantEditDialogProps) {
  const [name, setName] = useState(merchant.name)
  const [companyFullName, setCompanyFullName] = useState(merchant.companyFullName)
  const [unifiedSocialCreditCode, setUnifiedSocialCreditCode] = useState(
    merchant.unifiedSocialCreditCode,
  )
  const [merchantMark, setMerchantMark] = useState(merchant.merchantMark ?? '')
  const [accessMode, setAccessMode] = useState<MerchantAccessMode>(merchant.accessMode)
  const [type, setType] = useState<MerchantType>(merchant.type)
  const [status, setStatus] = useState<MerchantStatus>(merchant.status)
  const [contactUser, setContactUser] = useState(merchant.contactUser ?? '')
  const [contactPhone, setContactPhone] = useState(merchant.contactPhone ?? '')
  const [remark, setRemark] = useState(merchant.remark ?? '')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(merchant.name)
    setCompanyFullName(merchant.companyFullName)
    setUnifiedSocialCreditCode(merchant.unifiedSocialCreditCode)
    setMerchantMark(merchant.merchantMark ?? '')
    setAccessMode(merchant.accessMode)
    setType(merchant.type)
    setStatus(merchant.status)
    setContactUser(merchant.contactUser ?? '')
    setContactPhone(merchant.contactPhone ?? '')
    setRemark(merchant.remark ?? '')
  }, [open, merchant])

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('请填写展示简称')
      return
    }
    if (!companyFullName.trim()) {
      toast.error('请填写公司全称')
      return
    }
    const uscc = unifiedSocialCreditCode.trim().toUpperCase()
    if (!/^[0-9A-Z]{18}$/.test(uscc)) {
      toast.error('统一社会信用代码须为 18 位')
      return
    }

    setSubmitting(true)
    try {
      await onSave({
        name: name.trim(),
        companyFullName: companyFullName.trim(),
        unifiedSocialCreditCode: uscc,
        merchantMark: merchantMark.trim(),
        accessMode,
        type,
        status,
        contactUser: contactUser.trim(),
        contactPhone: contactPhone.trim(),
        remark: remark.trim(),
      })
      toast.success('商户信息已更新')
      onOpenChange(false)
    } catch {
      toast.error('保存失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] min-w-[30vw] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑商户基本信息</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="merchant-name">展示简称</Label>
            <Input id="merchant-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="merchant-company">公司全称</Label>
            <Input
              id="merchant-company"
              value={companyFullName}
              onChange={(e) => setCompanyFullName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="merchant-uscc">统一社会信用代码</Label>
            <Input
              id="merchant-uscc"
              className="font-mono"
              value={unifiedSocialCreditCode}
              onChange={(e) => setUnifiedSocialCreditCode(e.target.value)}
              maxLength={18}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-2">
              <Label>接入模式</Label>
              <Select value={accessMode} onValueChange={(v) => setAccessMode(v as MerchantAccessMode)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(merchantAccessModeLabels) as MerchantAccessMode[]).map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {merchantAccessModeLabels[mode]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>类型</Label>
              <Select value={type} onValueChange={(v) => setType(v as MerchantType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(merchantTypeLabels) as MerchantType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {merchantTypeLabels[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-2">
              <Label>状态</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as MerchantStatus)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(merchantStatusLabels) as MerchantStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {merchantStatusLabels[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="merchant-mark">Merchant Mark</Label>
              <Input
                id="merchant-mark"
                value={merchantMark}
                onChange={(e) => setMerchantMark(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-2">
              <Label htmlFor="merchant-contact">联系人</Label>
              <Input
                id="merchant-contact"
                value={contactUser}
                onChange={(e) => setContactUser(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="merchant-phone">联系电话</Label>
              <Input
                id="merchant-phone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="merchant-remark">备注</Label>
            <Textarea
              id="merchant-remark"
              rows={3}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            业务 Code、平台商户 ID 由平台同步维护，此处不可编辑。
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={submitting}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
