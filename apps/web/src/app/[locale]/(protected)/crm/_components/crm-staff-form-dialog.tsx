"use client"

import * as React from "react"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
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
import {
  STAFF_APP_ROLES,
  STAFF_DEFAULT_MANAGER_FIELDS,
  STAFF_DEPARTMENTS,
  type StaffAppRole,
  type StaffDepartment,
} from "@/lib/crm/staff-constants"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"

const STATUS_OPTIONS = [
  { value: "active", label: "在职" },
  { value: "inactive", label: "停用" },
] as const

function normalizeDepartment(value: string | null | undefined): StaffDepartment | "" {
  if (!value) return ""
  return STAFF_DEPARTMENTS.includes(value as StaffDepartment) ? (value as StaffDepartment) : ""
}

export type CrmStaffFormValues = {
  employee_no: string
  display_name: string
  mobile: string
  email: string
  status: string
  department: StaffDepartment | ""
  position: string
  roles: StaffAppRole[]
  is_default_pre_sales: boolean
  is_default_account_manager: boolean
  is_default_delivery_manager: boolean
  is_default_project_manager: boolean
}

export const crmStaffEmptyValues: CrmStaffFormValues = {
  employee_no: "",
  display_name: "",
  mobile: "",
  email: "",
  status: "active",
  department: "",
  position: "",
  roles: [],
  is_default_pre_sales: false,
  is_default_account_manager: false,
  is_default_delivery_manager: false,
  is_default_project_manager: false,
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
  const toggleRole = (role: StaffAppRole, checked: boolean) => {
    const next = checked
      ? values.roles.includes(role)
        ? values.roles
        : [...values.roles, role]
      : values.roles.filter((r) => r !== role)
    onChange({ roles: next })
  }

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-department`}>部门</Label>
          <Select
            value={values.department || undefined}
            onValueChange={(v) => onChange({ department: v as StaffDepartment })}
          >
            <SelectTrigger id={`${idPrefix}-department`}>
              <SelectValue placeholder="请选择部门" />
            </SelectTrigger>
            <SelectContent>
              {STAFF_DEPARTMENTS.map((dept) => (
                <SelectItem key={dept} value={dept}>
                  {dept}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-position`}>职位</Label>
          <Input
            id={`${idPrefix}-position`}
            value={values.position}
            onChange={(e) => onChange({ position: e.target.value })}
            placeholder="如 高级客户经理（可选）"
          />
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

      <div className="grid gap-2">
        <Label>角色</Label>
        <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-md border p-3">
          {STAFF_APP_ROLES.map((role) => (
            <label
              key={role.value}
              className="flex cursor-pointer items-center gap-2"
              htmlFor={`${idPrefix}-role-${role.value}`}
            >
              <Checkbox
                id={`${idPrefix}-role-${role.value}`}
                checked={values.roles.includes(role.value)}
                onCheckedChange={(checked) => toggleRole(role.value, checked === true)}
              />
              <span className="text-sm">{role.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <Label>项目角色默认人选</Label>
        <p className="text-muted-foreground text-xs">
          勾选后，新建项目或导入时将自动预选该员工作为对应角色（每种角色全局仅一位默认）。
        </p>
        <div className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-2">
          {STAFF_DEFAULT_MANAGER_FIELDS.map((field) => (
            <label
              key={field.key}
              className="flex cursor-pointer items-center gap-2"
              htmlFor={`${idPrefix}-${field.key}`}
            >
              <Checkbox
                id={`${idPrefix}-${field.key}`}
                checked={values[field.key]}
                onCheckedChange={(checked) => onChange({ [field.key]: checked === true })}
              />
              <span className="text-sm">{field.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

export function validateCrmStaffForm(values: CrmStaffFormValues): string | null {
  if (!values.display_name.trim()) return "请填写姓名"
  if (!values.mobile.trim()) return "请填写手机号"
  if (!values.department) return "请选择部门"
  return null
}

export function staffInputFromForm(values: CrmStaffFormValues) {
  return {
    displayName: values.display_name.trim(),
    mobile: values.mobile.trim(),
    email: values.email.trim() || null,
    employeeNo: values.employee_no.trim() || null,
    status: values.status,
    department: values.department || null,
    position: values.position.trim() || null,
    roles: values.roles,
    isDefaultPreSales: values.is_default_pre_sales,
    isDefaultAccountManager: values.is_default_account_manager,
    isDefaultDeliveryManager: values.is_default_delivery_manager,
    isDefaultProjectManager: values.is_default_project_manager,
  }
}

export function useCrmStaffFormState(staffId?: string) {
  const { data: existing } = trpc.crm.staff.getById.useQuery(
    { id: staffId! },
    { enabled: Boolean(staffId) },
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
        department: normalizeDepartment(existing.department),
        position: existing.position ?? "",
        roles: (existing.roles ?? []) as StaffAppRole[],
        is_default_pre_sales: existing.is_default_pre_sales,
        is_default_account_manager: existing.is_default_account_manager,
        is_default_delivery_manager: existing.is_default_delivery_manager,
        is_default_project_manager: existing.is_default_project_manager,
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
  const utils = trpc.useUtils()
  const createMutation = trpc.crm.staff.create.useMutation({
    onSuccess: (row) => {
      toast.success("员工已创建")
      void utils.crm.staff.list.invalidate()
      void utils.crm.staff.listActive.invalidate()
      onOpenChange(false)
      onSaved?.(row.id)
    },
    onError: (e) => toast.error(e.message),
  })
  const updateMutation = trpc.crm.staff.update.useMutation({
    onSuccess: (row) => {
      toast.success("员工已更新")
      void utils.crm.staff.list.invalidate()
      void utils.crm.staff.listActive.invalidate()
      onOpenChange(false)
      onSaved?.(row.id)
    },
    onError: (e) => toast.error(e.message),
  })
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
    const input = staffInputFromForm(values)
    if (mode === "edit" && staffId) {
      updateMutation.mutate({ id: staffId, data: input })
    } else {
      createMutation.mutate(input)
    }
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "新建员工" : "编辑员工"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "添加内部员工，可用于客户经理分配与业务操作人。"
              : "修改员工基本信息。"}
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
