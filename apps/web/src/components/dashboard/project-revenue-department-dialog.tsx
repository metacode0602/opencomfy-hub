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
import type { Project } from '@/lib/data/types'
import { STAFF_DEPARTMENTS, type StaffDepartment } from '@/lib/crm/staff-constants'
import { todayShanghaiDateString } from '@/lib/crm/project-effective-dates'
import { trpc } from '@/lib/trpc/client'

export type ProjectRevenueDepartmentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project | null
  onSaved?: () => void
}

export function ProjectRevenueDepartmentDialog({
  open,
  onOpenChange,
  project,
  onSaved,
}: ProjectRevenueDepartmentDialogProps) {
  const [department, setDepartment] = useState<StaffDepartment>('销售')
  const [effectiveFrom, setEffectiveFrom] = useState(todayShanghaiDateString())
  const [remark, setRemark] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { data: assignment, isLoading } =
    trpc.crm.projects.getRevenueDepartmentAssignment.useQuery(
      { projectId: project?.id ?? '' },
      { enabled: open && !!project?.id },
    )

  const saveMutation = trpc.crm.projects.changeRevenueDepartment.useMutation({
    onSuccess: () => {
      toast.success('收入归属部门已更新')
      onSaved?.()
      onOpenChange(false)
    },
    onError: (e) => setSubmitError(e.message),
  })

  useEffect(() => {
    if (!open || !project) return
    setEffectiveFrom(todayShanghaiDateString())
    setRemark('')
    setSubmitError(null)
  }, [open, project])

  useEffect(() => {
    if (!open) return
    if (assignment?.department) {
      setDepartment(assignment.department)
    } else if (project?.revenueDepartment) {
      setDepartment(project.revenueDepartment as StaffDepartment)
    } else {
      setDepartment('销售')
    }
  }, [open, assignment?.department, project?.revenueDepartment])

  const handleSubmit = () => {
    if (!project) return
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>设置收入归属部门</DialogTitle>
          <DialogDescription>
            {project
              ? `项目「${project.name}」：用于后续账期收入/成本部门归因。当前：${
                  assignment?.department ?? project.revenueDepartment ?? '未设置'
                }${
                  assignment?.effectiveFrom ? `（自 ${assignment.effectiveFrom} 起）` : ''
                }`
              : '设置收入归属部门'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">加载中…</p>
        ) : (
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
        )}

        {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}

        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!project || isLoading || saveMutation.isPending}
          >
            {saveMutation.isPending ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
