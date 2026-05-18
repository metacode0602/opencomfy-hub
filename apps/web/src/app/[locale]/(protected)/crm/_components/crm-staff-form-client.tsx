"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { LocaleLink, useLocaleRouter } from "@/lib/i18n/navigation"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"
import {
  CrmStaffFormFields,
  staffInputFromForm,
  useCrmStaffFormState,
  validateCrmStaffForm,
} from "./crm-staff-form-dialog"

export function CrmStaffFormClient({ staffId }: { staffId?: string }) {
  const router = useLocaleRouter()
  const mode = staffId ? "edit" : "create"
  const utils = trpc.useUtils()
  const createMutation = trpc.crm.staff.create.useMutation({
    onSuccess: (row) => {
      toast.success("员工已创建")
      router.push(`/crm/staff/${row.id}`)
    },
    onError: (e) => toast.error(e.message),
  })
  const updateMutation = trpc.crm.staff.update.useMutation({
    onSuccess: (row) => {
      toast.success("员工已更新")
      void utils.crm.staff.getById.invalidate({ id: row.id })
      router.push(`/crm/staff/${row.id}`)
    },
    onError: (e) => toast.error(e.message),
  })
  const { values, patch, existing } = useCrmStaffFormState(staffId)

  if (mode === "edit" && staffId && !existing) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">未找到员工。</p>
        <Button className="mt-4" variant="outline" asChild>
          <LocaleLink href="/crm/staff">返回列表</LocaleLink>
        </Button>
      </div>
    )
  }

  const onSave = () => {
    const err = validateCrmStaffForm(values)
    if (err) {
      toast.error(err)
      return
    }
    const input = staffInputFromForm(values)
    if (mode === "edit" && staffId) {
      updateMutation.mutate({ id: staffId, data: input })
    } else {
      createMutation.mutate(input)
    }
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>{mode === "create" ? "新建员工" : "编辑员工"}</CardTitle>
        <CardDescription>内部员工主数据</CardDescription>
      </CardHeader>
      <CardContent>
        <CrmStaffFormFields
          values={values}
          onChange={patch}
          idPrefix={mode === "create" ? "staff-page-new" : `staff-page-edit-${staffId}`}
        />
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" asChild>
          <LocaleLink href={mode === "edit" && staffId ? `/crm/staff/${staffId}` : "/crm/staff"}>
            取消
          </LocaleLink>
        </Button>
        <Button
          type="button"
          onClick={onSave}
          disabled={createMutation.isPending || updateMutation.isPending}
        >
          {mode === "create" ? "创建" : "保存"}
        </Button>
      </CardFooter>
    </Card>
  )
}
