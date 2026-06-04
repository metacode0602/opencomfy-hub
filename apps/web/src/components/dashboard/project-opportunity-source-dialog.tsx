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
import {
  OPPORTUNITY_SOURCE_LABELS,
  OPPORTUNITY_SOURCE_VALUES,
  type OpportunitySource,
} from '@/lib/crm/commission-constants'
import { todayShanghaiDateString } from '@/lib/crm/project-effective-dates'
import { trpc } from '@/lib/trpc/client'

export type ProjectOpportunitySourceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project | null
  onSaved?: () => void
}

type OpportunitySourceAssignment =
  inferRouterOutputs<AppRouter>['crm']['projects']['getOpportunitySourceAssignment']

function resolveInitialSource(
  project: Project,
  assignment: OpportunitySourceAssignment | undefined,
): OpportunitySource {
  if (assignment?.opportunitySource) return assignment.opportunitySource
  if (project.opportunitySource) return project.opportunitySource
  return 'sales_self'
}

function ProjectOpportunitySourceForm({
  project,
  assignment,
  onOpenChange,
  onSaved,
}: {
  project: Project
  assignment: OpportunitySourceAssignment | undefined
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}) {
  const [opportunitySource, setOpportunitySource] = useState<OpportunitySource>(() =>
    resolveInitialSource(project, assignment),
  )
  const [effectiveFrom, setEffectiveFrom] = useState(todayShanghaiDateString)
  const [remark, setRemark] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  const saveMutation = trpc.crm.projects.changeOpportunitySource.useMutation({
    onSuccess: () => {
      toast.success('商机来源已更新')
      onSaved?.()
      onOpenChange(false)
    },
    onError: (e) => setSubmitError(e.message),
  })

  const handleSubmit = () => {
    if (!effectiveFrom) {
      setSubmitError('请选择生效日期')
      return
    }
    saveMutation.mutate({
      projectId: project.id,
      opportunitySource,
      effectiveFrom,
      remark: remark.trim() || undefined,
    })
  }

  const currentLabel = assignment?.opportunitySource
    ? OPPORTUNITY_SOURCE_LABELS[assignment.opportunitySource]
    : project.opportunitySource
      ? OPPORTUNITY_SOURCE_LABELS[project.opportunitySource]
      : '未设置'

  return (
    <>
      <DialogHeader>
        <DialogTitle>设置商机来源</DialogTitle>
        <DialogDescription>
          项目「{project.name}」：用于弹性算力提成提点矩阵。当前：{currentLabel}
          {assignment?.effectiveFrom ? `（自 ${assignment.effectiveFrom} 起）` : ''}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-2">
        <div className="grid gap-2">
          <Label htmlFor="project-opp-source">商机来源</Label>
          <Select
            value={opportunitySource}
            onValueChange={(v) => setOpportunitySource(v as OpportunitySource)}
          >
            <SelectTrigger id="project-opp-source" className="w-full">
              <SelectValue placeholder="请选择商机来源" />
            </SelectTrigger>
            <SelectContent>
              {OPPORTUNITY_SOURCE_VALUES.map((value) => (
                <SelectItem key={value} value={value}>
                  {OPPORTUNITY_SOURCE_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="project-opp-effective">生效日期</Label>
          <Input
            id="project-opp-effective"
            type="date"
            value={effectiveFrom}
            onChange={(e) => {
              setEffectiveFrom(e.target.value)
              setSubmitError(null)
            }}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="project-opp-remark">备注（可选）</Label>
          <Textarea
            id="project-opp-remark"
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
        <Button type="button" onClick={handleSubmit} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? '保存中…' : '保存'}
        </Button>
      </DialogFooter>
    </>
  )
}

function ProjectOpportunitySourceDialogBody({
  project,
  onOpenChange,
  onSaved,
}: {
  project: Project
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}) {
  const { data: assignment, isLoading } =
    trpc.crm.projects.getOpportunitySourceAssignment.useQuery({ projectId: project.id })

  if (isLoading) {
    return (
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>设置商机来源</DialogTitle>
          <DialogDescription>设置商机来源</DialogDescription>
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

  const formKey = `${project.id}:${assignment?.opportunitySource ?? ''}:${assignment?.effectiveFrom ?? ''}:${project.opportunitySource ?? ''}`

  return (
    <DialogContent className="sm:max-w-[480px]">
      <ProjectOpportunitySourceForm
        key={formKey}
        project={project}
        assignment={assignment}
        onOpenChange={onOpenChange}
        onSaved={onSaved}
      />
    </DialogContent>
  )
}

export function ProjectOpportunitySourceDialog({
  open,
  onOpenChange,
  project,
  onSaved,
}: ProjectOpportunitySourceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && project ? (
        <ProjectOpportunitySourceDialogBody
          project={project}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
        />
      ) : null}
    </Dialog>
  )
}
