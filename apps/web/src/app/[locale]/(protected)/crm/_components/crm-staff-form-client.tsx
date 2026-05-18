"use client"

import * as React from "react"
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
import { useCrmMockStore } from "@/lib/stores/crm-mock-store"
import { toast } from "sonner"
import {
  CrmStaffFormFields,
  crmStaffFormToRow,
  useCrmStaffFormState,
  validateCrmStaffForm,
} from "./crm-staff-form-dialog"

export function CrmStaffFormClient({ staffId }: { staffId?: string }) {
  const router = useLocaleRouter()
  const mode = staffId ? "edit" : "create"
  const upsert = useCrmMockStore((s) => s.upsertUserStaff)
  const createStaffId = useCrmMockStore((s) => s.createStaffId)
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
    const id = mode === "edit" && staffId ? staffId : createStaffId()
    upsert(crmStaffFormToRow(id, values))
    toast.success(mode === "create" ? "员工已创建" : "员工已更新")
    router.push(`/crm/staff/${id}`)
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>{mode === "create" ? "新建员工" : "编辑员工"}</CardTitle>
          <CardDescription>内部员工基本信息（mock）</CardDescription>
        </CardHeader>
        <CardContent>
          <CrmStaffFormFields
            values={values}
            onChange={patch}
            idPrefix={mode === "create" ? "staff-page-new" : `staff-page-edit-${staffId}`}
          />
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button type="button" onClick={onSave}>
            保存
          </Button>
          <Button variant="outline" type="button" asChild>
            <LocaleLink
              href={
                mode === "edit" && staffId ? `/crm/staff/${staffId}` : "/crm/staff"
              }
            >
              取消
            </LocaleLink>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
