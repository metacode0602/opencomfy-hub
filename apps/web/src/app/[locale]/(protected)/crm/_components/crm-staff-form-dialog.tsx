"use client"

import * as React from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useCrmMockStore } from "@/lib/stores/crm-mock-store"
import type { UserStaff } from "@/lib/types/crm"
import { toast } from "sonner"

const STATUS_OPTIONS = [
  { value: "active", label: "在职" },
  { value: "inactive", label: "停用" },
] as const

export type CrmStaffFormValues = {
  employee_no: string
  display_name: string
  mobile: string
  email: string
  status: string
}

export const crmStaffEmptyValues: CrmStaffFormValues = {
  employee_no: "",
  display_name: "",
  mobile: "",
  email: "",
  status: "active",
}

export function CrmStaffFormFields({
  values,
  onChange,
  idPrefix = "staff",
}: {
  values: CrmStaffFormValues
  onChange: (patch: Partial<CrmStaffFormValues>) => void
  idPrefix?: string
}) {
  return (
    <div className="grid gap-4 py-2">
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-employee-no`}>工号</Label>
        <Input
          id={`${idPrefix}-employee-no`}
          value={values.employee_no}
          onChange={(e) => onChange({ employee_no: e.target.value })}
          placeholder="如 E10001（可选）"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-display-name`}>姓名</Label>
        <Input
          id={`${idPrefix}-display-name`}
          value={values.display_name}
          onChange={(e) => onChange({ display_name: e.target.value })}
          placeholder="请输入姓名"
          required
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-mobile`}>手机</Label>
          <Input
            id={`${idPrefix}-mobile`}
            value={values.mobile}
            onChange={(e) => onChange({ mobile: e.target.value })}
            placeholder="请输入手机号"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-status`}>状态</Label>
          <Select value={values.status} onValueChange={(v) => onChange({ status: v })}>
            <SelectTrigger id={`${idPrefix}-status`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-email`}>邮箱</Label>
        <Input
          id={`${idPrefix}-email`}
          type="email"
          value={values.email}
          onChange={(e) => onChange({ email: e.target.value })}
          placeholder="请输入邮箱（可选）"
        />
      </div>
    </div>
  )
}

export function validateCrmStaffForm(values: CrmStaffFormValues): string | null {
  if (!values.display_name.trim()) return "请填写姓名"
  if (!values.mobile.trim()) return "请填写手机号"
  return null
}

export function crmStaffFormToRow(id: string, values: CrmStaffFormValues): UserStaff {
  const email = values.email.trim()
  const employeeNo = values.employee_no.trim()
  return {
    id,
    employee_no: employeeNo || null,
    display_name: values.display_name.trim(),
    mobile: values.mobile.trim(),
    email: email || null,
    status: values.status,
  }
}

export function useCrmStaffFormState(staffId?: string) {
  const existing = useCrmMockStore((s) =>
    staffId ? s.userStaff.find((x) => x.id === staffId) : undefined,
  )

  const [values, setValues] = React.useState<CrmStaffFormValues>(crmStaffEmptyValues)

  React.useEffect(() => {
    if (existing) {
      setValues({
        employee_no: existing.employee_no ?? "",
        display_name: existing.display_name,
        mobile: existing.mobile,
        email: existing.email ?? "",
        status: existing.status,
      })
    } else if (!staffId) {
      setValues(crmStaffEmptyValues)
    }
  }, [existing, staffId])

  const patch = React.useCallback((p: Partial<CrmStaffFormValues>) => {
    setValues((prev) => ({ ...prev, ...p }))
  }, [])

  return { values, patch, existing }
}

export function CrmStaffFormDialog({
  open,
  onOpenChange,
  staffId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  staffId?: string
  onSaved?: (id: string) => void
}) {
  const mode = staffId ? "edit" : "create"
  const upsert = useCrmMockStore((s) => s.upsertUserStaff)
  const createStaffId = useCrmMockStore((s) => s.createStaffId)
  const { values, patch, existing } = useCrmStaffFormState(staffId)

  React.useEffect(() => {
    if (!open && mode === "create") {
      patch(crmStaffEmptyValues)
    }
  }, [open, mode, patch])

  const onSubmit = () => {
    const err = validateCrmStaffForm(values)
    if (err) {
      toast.error(err)
      return
    }
    if (mode === "edit" && staffId && !existing) {
      toast.error("员工不存在")
      return
    }
    const id = mode === "edit" && staffId ? staffId : createStaffId()
    upsert(crmStaffFormToRow(id, values))
    toast.success(mode === "create" ? "员工已创建" : "员工已更新")
    onOpenChange(false)
    onSaved?.(id)
  }

  if (mode === "edit" && staffId && !existing && open) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑员工</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">未找到该员工记录。</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "新建员工" : "编辑员工"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "添加内部员工，可用于客户经理分配与业务操作人。"
              : "修改员工基本信息（mock 数据）。"}
          </DialogDescription>
        </DialogHeader>
        <CrmStaffFormFields
          values={values}
          onChange={patch}
          idPrefix={mode === "create" ? "staff-new" : `staff-edit-${staffId}`}
        />
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" onClick={onSubmit}>
            {mode === "create" ? "创建" : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
