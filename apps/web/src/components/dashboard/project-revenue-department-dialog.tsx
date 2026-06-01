'use client'

import { useState } from 'react'
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
import type { Project } from '@/lib/data/types'
import type { AppRouter, inferRouterOutputs } from '@/lib/server/routers'
import { STAFF_DEPARTMENTS, type StaffDepartment } from '@/lib/crm/staff-constants'
import { todayShanghaiDateString } from '@/lib/crm/project-effective-dates'
import { trpc } from '@/lib/trpc/client'

export type ProjectRevenueDepartmentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project | null
  onSaved?: () => void
}

type RevenueDepartmentAssignment =
  inferRouterOutputs<AppRouter>['crm']['projects']['getRevenueDepartmentAssignment']

function resolveInitialDepartment(
  project: Project,
  assignment: RevenueDepartmentAssignment | undefined,
): StaffDepartment {
  if (assignment?.department) return assignment.department
  if (project.revenueDepartment) return project.revenueDepartment as StaffDepartment
  return '销售'
}

function ProjectRevenueDepartmentForm({
  project,
  assignment,
  onOpenChange,
  onSaved,
}: {
  project: Project
  assignment: RevenueDepartmentAssignment | undefined
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}) {
  const [department, setDepartment] = useState<StaffDepartment>(() =>
    resolveInitialDepartment(project, assignment),
  )
  const [effectiveFrom, setEffectiveFrom] = useState(todayShanghaiDateString)
  const [remark, setRemark] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  const saveMutation = trpc.crm.projects.changeRevenueDepartment.useMutation({
    onSuccess: () => {
      toast.success('收入归属部门已更新')
      onSaved?.()
      onOpenChange(false)
    },
    onError: (e) => setSubmitError(e.message),
  })

  const handleSubmit = () => {
    if (!department) {
      setSubmitError('请选择收入归属部门')
      return
    }
    if (!effectiveFrom) {
      setSubmitError('请选择生效日期')
      return
    }
    saveMutation.mutate({
      projectId: project.id,
      department,
      effectiveFrom,
      remark: remark.trim() || undefined,
    })
  }

  const currentLabel =
    assignment?.department ?? project.revenueDepartment ?? '未设置'

  return (
    <>
      <DialogHeader>
        <DialogTitle>设置收入归属部门</DialogTitle>
        <DialogDescription>
          项目「{project.name}」：用于后续账期收入/成本部门归因。当前：{currentLabel}
          {assignment?.effectiveFrom ? `（自 ${assignment.effectiveFrom} 起）` : ''}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-2">
        <div className="grid gap-2">
          <Label htmlFor="project-dept">收入归属部门</Label>
          <Select
            value={department}
            onValueChange={(v) => setDepartment(v as StaffDepartment)}
          >
            <SelectTrigger id="project-dept" className="w-full">
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
          <Label htmlFor="project-dept-effective">生效日期</Label>
          <Input
            id="project-dept-effective"
            type="date"
            value={effectiveFrom}
            onChange={(e) => {
              setEffectiveFrom(e.target.value)
              setSubmitError(null)
            }}
          />
          <p className="text-xs text-muted-foreground">
            生效日早于当前段起始日时，将插入历史段；列表展示的「当前部门」仍以最新生效段为准。
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="project-dept-remark">备注（可选）</Label>
          <Textarea
            id="project-dept-remark"
            rows={2}
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="变更原因"
          />
        </div>
      </div>

      {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

      <DialogFooter>
        <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
          取消
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? '保存中…' : '保存'}
        </Button>
      </DialogFooter>
    </>
  )
}

function ProjectRevenueDepartmentDialogBody({
  project,
  onOpenChange,
  onSaved,
}: {
  project: Project
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}) {
  const { data: assignment, isLoading } =
    trpc.crm.projects.getRevenueDepartmentAssignment.useQuery({ projectId: project.id })

  if (isLoading) {
    return (
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>设置收入归属部门</DialogTitle>
          <DialogDescription>设置收入归属部门</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground py-4">加载中…</p>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    )
  }

  const formKey = `${project.id}:${assignment?.department ?? ''}:${assignment?.effectiveFrom ?? ''}:${project.revenueDepartment ?? ''}`

  return (
    <DialogContent className="sm:max-w-[480px]">
      <ProjectRevenueDepartmentForm
        key={formKey}
        project={project}
        assignment={assignment}
        onOpenChange={onOpenChange}
        onSaved={onSaved}
      />
    </DialogContent>
  )
}

export function ProjectRevenueDepartmentDialog({
  open,
  onOpenChange,
  project,
  onSaved,
}: ProjectRevenueDepartmentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && project ? (
        <ProjectRevenueDepartmentDialogBody
          project={project}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
        />
      ) : null}
    </Dialog>
  )
}
