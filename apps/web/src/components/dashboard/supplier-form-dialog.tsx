'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
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
import { Label } from '@workspace/ui/components/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import { contractPricingModeNames } from '@/lib/data/types'
import type { CooperationMode, Supplier } from '@/lib/data/types'
import type { UserStaff } from '@/lib/types/crm'
import { toast } from 'sonner'

const statusNames: Record<string, string> = {
  negotiating: '洽谈中',
  cooperating: '合作中',
  suspended: '已暂停',
  terminated: '已终止',
}

export type SupplierFormValues = {
  name: string
  shortName: string
  status: Supplier['status']
  cooperationMode: CooperationMode
  revenueShareRatio: string
  businessManagerStaffId: string
  contactPerson: string
  contactPhone: string
  contactEmail: string
  address: string
  bankAccount: string
  bankName: string
}

const emptySupplierForm: SupplierFormValues = {
  name: '',
  shortName: '',
  status: 'negotiating',
  cooperationMode: 'card_time',
  revenueShareRatio: '',
  businessManagerStaffId: '',
  contactPerson: '',
  contactPhone: '',
  contactEmail: '',
  address: '',
  bankAccount: '',
  bankName: '',
}

function supplierToFormValues(supplier: Supplier, activeStaff: UserStaff[]): SupplierFormValues {
  const staff = activeStaff.find((s) => s.display_name === supplier.businessManager)
  return {
    name: supplier.name,
    shortName: supplier.shortName,
    status: supplier.status,
    cooperationMode: supplier.cooperationMode,
    revenueShareRatio: supplier.revenueShareRatio?.toString() ?? '',
    businessManagerStaffId: staff?.id ?? '',
    contactPerson: supplier.contactPerson,
    contactPhone: supplier.contactPhone,
    contactEmail: supplier.contactEmail,
    address: supplier.address,
    bankAccount: supplier.bankAccount ?? '',
    bankName: supplier.bankName ?? '',
  }
}

function validateSupplierForm(
  form: SupplierFormValues,
  activeStaff: UserStaff[],
): { ok: true; businessManager: string } | { ok: false } {
  if (!form.name.trim() || !form.shortName.trim()) {
    toast.error('请填写供应商全称和简称')
    return { ok: false }
  }
  const businessManager = activeStaff.find((s) => s.id === form.businessManagerStaffId)?.display_name
  if (!businessManager || !form.contactPerson.trim()) {
    toast.error('请选择商务经理并填写联系人')
    return { ok: false }
  }
  if (!form.contactPhone.trim() || !form.contactEmail.trim()) {
    toast.error('请填写联系电话和邮箱')
    return { ok: false }
  }
  if (!form.address.trim()) {
    toast.error('请填写地址')
    return { ok: false }
  }
  if (form.cooperationMode === 'revenue_share') {
    const ratio = Number(form.revenueShareRatio)
    if (!form.revenueShareRatio.trim() || Number.isNaN(ratio) || ratio <= 0 || ratio > 100) {
      toast.error('分成模式请填写有效的分成比例（1-100）')
      return { ok: false }
    }
  }
  return { ok: true, businessManager }
}

function formToSupplierFields(
  form: SupplierFormValues,
  businessManager: string,
): Pick<
  Supplier,
  | 'name'
  | 'shortName'
  | 'status'
  | 'cooperationMode'
  | 'revenueShareRatio'
  | 'businessManager'
  | 'contactPerson'
  | 'contactPhone'
  | 'contactEmail'
  | 'address'
  | 'bankAccount'
  | 'bankName'
> {
  return {
    name: form.name.trim(),
    shortName: form.shortName.trim(),
    status: form.status,
    cooperationMode: form.cooperationMode,
    revenueShareRatio:
      form.cooperationMode === 'revenue_share' ? Number(form.revenueShareRatio) : undefined,
    businessManager,
    contactPerson: form.contactPerson.trim(),
    contactPhone: form.contactPhone.trim(),
    contactEmail: form.contactEmail.trim(),
    address: form.address.trim(),
    bankAccount: form.bankAccount.trim() || undefined,
    bankName: form.bankName.trim() || undefined,
  }
}

type SupplierFormFieldsProps = {
  form: SupplierFormValues
  onChange: (patch: Partial<SupplierFormValues>) => void
  activeStaff: UserStaff[]
  idPrefix: string
}

function SupplierFormFields({ form, onChange, activeStaff, idPrefix }: SupplierFormFieldsProps) {
  return (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-name`}>供应商全称</Label>
        <Input
          id={`${idPrefix}-name`}
          placeholder="请输入公司全称"
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-short-name`}>简称</Label>
        <Input
          id={`${idPrefix}-short-name`}
          placeholder="请输入简称"
          value={form.shortName}
          onChange={(e) => onChange({ shortName: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>合作状态</Label>
          <Select
            value={form.status}
            onValueChange={(v) => onChange({ status: v as Supplier['status'] })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(statusNames).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>计价模式</Label>
          <Select
            value={form.cooperationMode}
            onValueChange={(v) =>
              onChange({
                cooperationMode: v as CooperationMode,
                revenueShareRatio: v === 'revenue_share' ? form.revenueShareRatio : '',
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(contractPricingModeNames).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>商务经理</Label>
          <Select
            value={form.businessManagerStaffId}
            onValueChange={(v) => onChange({ businessManagerStaffId: v })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择商务经理" />
            </SelectTrigger>
            <SelectContent>
              {activeStaff.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.employee_no ? `${s.display_name}（${s.employee_no}）` : s.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-contact-person`}>联系人</Label>
          <Input
            id={`${idPrefix}-contact-person`}
            placeholder="供应商对接人"
            value={form.contactPerson}
            onChange={(e) => onChange({ contactPerson: e.target.value })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-phone`}>联系电话</Label>
          <Input
            id={`${idPrefix}-phone`}
            placeholder="请输入联系电话"
            value={form.contactPhone}
            onChange={(e) => onChange({ contactPhone: e.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-email`}>联系邮箱</Label>
          <Input
            id={`${idPrefix}-email`}
            type="email"
            placeholder="请输入联系邮箱"
            value={form.contactEmail}
            onChange={(e) => onChange({ contactEmail: e.target.value })}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-address`}>地址</Label>
        <Input
          id={`${idPrefix}-address`}
          placeholder="请输入详细地址"
          value={form.address}
          onChange={(e) => onChange({ address: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-bank-name`}>开户行（选填）</Label>
          <Input
            id={`${idPrefix}-bank-name`}
            placeholder="银行名称"
            value={form.bankName}
            onChange={(e) => onChange({ bankName: e.target.value })}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-bank-account`}>银行账号（选填）</Label>
          <Input
            id={`${idPrefix}-bank-account`}
            placeholder="对公账号"
            value={form.bankAccount}
            onChange={(e) => onChange({ bankAccount: e.target.value })}
          />
        </div>
      </div>
    </div>
  )
}

export type CreateSupplierDialogProps = {
  activeStaff: UserStaff[]
  onCreated: (supplier: Supplier) => void
}

export function CreateSupplierDialog({ activeStaff, onCreated }: CreateSupplierDialogProps) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<SupplierFormValues>(emptySupplierForm)

  const resetForm = () => setForm(emptySupplierForm)

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) resetForm()
  }

  const handleSubmit = () => {
    const result = validateSupplierForm(form, activeStaff)
    if (!result.ok) return

    const fields = formToSupplierFields(form, result.businessManager)
    const newSupplier: Supplier = {
      id: `sup${Date.now()}`,
      ...fields,
      createdAt: new Date().toISOString().split('T')[0]!,
      dataCenterCount: 0,
      totalDeviceCount: 0,
      monthlySettlement: 0,
    }

    onCreated(newSupplier)
    resetForm()
    setOpen(false)
    toast.success('供应商已创建')
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          新增供应商
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新增供应商</DialogTitle>
          <DialogDescription>填写供应商基本信息，创建后可继续维护机房与合同</DialogDescription>
        </DialogHeader>
        <SupplierFormFields
          form={form}
          onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          activeStaff={activeStaff}
          idPrefix="create-supplier"
        />
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              resetForm()
              setOpen(false)
            }}
          >
            取消
          </Button>
          <Button onClick={handleSubmit}>创建供应商</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export type EditSupplierDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplier: Supplier | null
  activeStaff: UserStaff[]
  onUpdated: (supplier: Supplier) => void | Promise<void>
}

export function EditSupplierDialog({
  open,
  onOpenChange,
  supplier,
  activeStaff,
  onUpdated,
}: EditSupplierDialogProps) {
  const [form, setForm] = useState<SupplierFormValues>(emptySupplierForm)

  useEffect(() => {
    if (open && supplier) {
      setForm(supplierToFormValues(supplier, activeStaff))
    }
  }, [open, supplier, activeStaff])

  useEffect(() => {
    if (!open) {
      setForm(emptySupplierForm)
    }
  }, [open])

  const handleSubmit = async () => {
    if (!supplier) return
    const result = validateSupplierForm(form, activeStaff)
    if (!result.ok) return

    const fields = formToSupplierFields(form, result.businessManager)
    try {
      await onUpdated({
        ...supplier,
        ...fields,
      })
      onOpenChange(false)
    } catch {
      // 保存失败时保持弹窗打开，错误提示由调用方处理
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑供应商</DialogTitle>
          <DialogDescription>
            {supplier ? `修改「${supplier.name}」的基本信息` : '修改供应商基本信息'}
          </DialogDescription>
        </DialogHeader>
        <SupplierFormFields
          form={form}
          onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          activeStaff={activeStaff}
          idPrefix="edit-supplier"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={!supplier}>
            保存修改
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
