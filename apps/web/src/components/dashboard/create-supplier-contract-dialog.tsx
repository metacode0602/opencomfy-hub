'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Plus, Upload, X } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import type { Supplier, SupplierContract } from '@/lib/data/types'
import { useCrmMockStore } from '@/lib/stores/crm-mock-store'

const contractStatusNames: Record<'draft' | 'pending' | 'active', string> = {
  draft: '草稿',
  pending: '待签署',
  active: '生效中',
}

const contractTypeNames: Record<SupplierContract['type'], string> = {
  cooperation: '合作协议',
  supplement: '补充协议',
  renewal: '续签协议',
}

const ACCEPT_CONTRACT_FILE =
  '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

type CreateContractForm = {
  contractNo: string
  type: SupplierContract['type']
  status: SupplierContract['status']
  startDate: string
  endDate: string
  terms: string
  minCommitHours: string
  settlementCycle: '' | 'monthly' | 'quarterly'
  signerStaffId: string
  signedAt: string
}

const defaultCreateForm = (): CreateContractForm => ({
  contractNo: '',
  type: 'cooperation',
  status: 'draft',
  startDate: '',
  endDate: '',
  terms: '',
  minCommitHours: '',
  settlementCycle: '',
  signerStaffId: '',
  signedAt: '',
})

interface CreateSupplierContractDialogProps {
  supplier: Supplier
  onCreated: (contract: SupplierContract) => void
}

export function CreateSupplierContractDialog({
  supplier,
  onCreated,
}: CreateSupplierContractDialogProps) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<CreateContractForm>(defaultCreateForm)
  const [contractFile, setContractFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const fileObjectUrlRef = useRef<string | null>(null)
  const userStaff = useCrmMockStore((s) => s.userStaff)
  const activeStaff = useMemo(
    () => userStaff.filter((s) => s.status === 'active'),
    [userStaff],
  )

  const resetForm = () => {
    setForm(defaultCreateForm())
    setContractFile(null)
    setFileError(null)
    setSubmitError(null)
    if (fileObjectUrlRef.current) {
      URL.revokeObjectURL(fileObjectUrlRef.current)
      fileObjectUrlRef.current = null
    }
  }

  useEffect(() => {
    if (!open) {
      resetForm()
    }
  }, [open])

  useEffect(() => {
    return () => {
      if (fileObjectUrlRef.current) {
        URL.revokeObjectURL(fileObjectUrlRef.current)
      }
    }
  }, [])

  const updateForm = <K extends keyof CreateContractForm>(key: K, value: CreateContractForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSubmitError(null)
  }

  const handleFileChange = (file: File | null) => {
    setFileError(null)
    setSubmitError(null)
    if (!file) {
      setContractFile(null)
      return
    }
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]
    const ext = file.name.split('.').pop()?.toLowerCase()
    const okExt = ext === 'pdf' || ext === 'doc' || ext === 'docx'
    if (!allowed.includes(file.type) && !okExt) {
      setFileError('仅支持 PDF、DOC、DOCX 格式')
      setContractFile(null)
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setFileError('文件大小不能超过 20MB')
      setContractFile(null)
      return
    }
    setContractFile(file)
  }

  const handleSubmit = () => {
    if (!form.contractNo.trim()) {
      setSubmitError('请填写合同编号')
      return
    }
    if (!form.startDate || !form.endDate) {
      setSubmitError('请填写合同起止日期')
      return
    }
    if (form.startDate > form.endDate) {
      setSubmitError('结束日期不能早于开始日期')
      return
    }
    if (!form.terms.trim()) {
      setSubmitError('请填写合同条款摘要')
      return
    }
    if (!contractFile) {
      setFileError('请上传合同文件')
      return
    }

    if (fileObjectUrlRef.current) {
      URL.revokeObjectURL(fileObjectUrlRef.current)
    }
    const objectUrl = URL.createObjectURL(contractFile)
    fileObjectUrlRef.current = objectUrl

    const pricingMode =
      supplier.cooperationMode === 'revenue_share' ? 'revenue_share' : 'card_time'

    const contract: SupplierContract = {
      id: `sc-new-${Date.now()}`,
      contractNo: form.contractNo.trim(),
      supplierId: supplier.id,
      supplierName: supplier.name,
      type: form.type,
      status: form.status,
      cooperationMode: supplier.cooperationMode,
      pricingMode,
      revenueShareRatio:
        supplier.cooperationMode === 'revenue_share' ? supplier.revenueShareRatio : undefined,
      minCommitHours: form.minCommitHours ? parseInt(form.minCommitHours, 10) : undefined,
      settlementCycle: form.settlementCycle || undefined,
      startDate: form.startDate,
      endDate: form.endDate,
      terms: form.terms.trim(),
      signedAt: form.signedAt || undefined,
      signerName: form.signerStaffId
        ? activeStaff.find((s) => s.id === form.signerStaffId)?.display_name
        : undefined,
      contractFileUrl: objectUrl,
      createdAt: new Date().toISOString().slice(0, 10),
    }

    onCreated(contract)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          新增合同
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新增合同</DialogTitle>
          <DialogDescription>
            为 {supplier.name} 录入商务合同信息并上传合同扫描件（PDF / Word）
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>合同编号 *</Label>
              <Input
                placeholder="如 SUP-2026-001"
                value={form.contractNo}
                onChange={(e) => updateForm('contractNo', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>供应商</Label>
              <Input value={supplier.name} disabled className="bg-muted/50" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>合同类型</Label>
              <Select
                value={form.type}
                onValueChange={(v) => updateForm('type', v as SupplierContract['type'])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(contractTypeNames).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>合同状态</Label>
              <Select
                value={form.status}
                onValueChange={(v) => updateForm('status', v as SupplierContract['status'])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['draft', 'pending', 'active'] as const).map((k) => (
                    <SelectItem key={k} value={k}>
                      {contractStatusNames[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>开始日期 *</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => updateForm('startDate', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>结束日期 *</Label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => updateForm('endDate', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>结算周期</Label>
              <Select
                value={form.settlementCycle || 'none'}
                onValueChange={(v) =>
                  updateForm('settlementCycle', v === 'none' ? '' : (v as 'monthly' | 'quarterly'))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="可选" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不指定</SelectItem>
                  <SelectItem value="monthly">按月结算</SelectItem>
                  <SelectItem value="quarterly">按季结算</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>签署人</Label>
              <Select
                value={form.signerStaffId || 'none'}
                onValueChange={(v) => updateForm('signerStaffId', v === 'none' ? '' : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择签署人" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不指定</SelectItem>
                  {activeStaff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.display_name}
                      {s.employee_no ? ` (${s.employee_no})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>签署日期</Label>
              <Input
                type="date"
                value={form.signedAt}
                onChange={(e) => updateForm('signedAt', e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>合同条款摘要 *</Label>
            <Textarea
              rows={3}
              placeholder="简述合作范围、结算方式、特殊约定..."
              value={form.terms}
              onChange={(e) => updateForm('terms', e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>合同文件 *</Label>
            <div
              className={`rounded-lg border border-dashed p-4 transition-colors ${
                contractFile ? 'border-primary/50 bg-primary/5' : 'border-border'
              }`}
            >
              {contractFile ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {contractFile.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(contractFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleFileChange(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground text-center">
                    上传合同扫描件，支持 PDF、DOC、DOCX，最大 20MB
                  </p>
                  <Button type="button" variant="outline" size="sm" asChild>
                    <label className="cursor-pointer">
                      选择文件
                      <input
                        type="file"
                        className="sr-only"
                        accept={ACCEPT_CONTRACT_FILE}
                        onChange={(e) => {
                          handleFileChange(e.target.files?.[0] ?? null)
                          e.target.value = ''
                        }}
                      />
                    </label>
                  </Button>
                </div>
              )}
            </div>
            {fileError && <p className="text-sm text-destructive">{fileError}</p>}
          </div>

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit}>创建合同</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
