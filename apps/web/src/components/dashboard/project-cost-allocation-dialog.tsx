'use client'

import { useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@workspace/ui/components/badge'
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
import { Progress } from '@workspace/ui/components/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import type { Project } from '@/lib/data/types'
import type { AppRouter, inferRouterOutputs } from '@/lib/server/routers'
import { trpc } from '@/lib/trpc/client'

export type ProjectCostAllocationDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project | null
  onSaved?: () => void
}

function parsePercent(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const num = Number(trimmed)
  if (!Number.isFinite(num) || num < 0 || num > 100) return null
  return num
}

function formatPercent(num: number): string {
  return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/\.?0+$/, '')
}

function buildEvenSplit(count: number): string[] {
  if (count <= 0) return []
  const base = Math.floor((100 / count) * 100) / 100
  const values = Array.from({ length: count }, () => base)
  const remainder = Math.round((100 - base * count) * 100) / 100
  if (remainder !== 0) {
    values[0] = Math.round((values[0]! + remainder) * 100) / 100
  }
  return values.map((v) => formatPercent(v))
}

function stripTrailingZeros(value: string): string {
  const num = Number(value)
  if (!Number.isFinite(num)) return value
  return formatPercent(num)
}

function buildInitialAllocations(
  projects: { projectId: string; allocationPercent: string | null }[],
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const p of projects) {
    result[p.projectId] = p.allocationPercent ? stripTrailingZeros(p.allocationPercent) : ''
  }

  const hasPreset = projects.some((p) => result[p.projectId]?.trim())
  if (!hasPreset) {
    if (projects.length === 1) {
      result[projects[0]!.projectId] = '100'
    } else if (projects.length > 1) {
      const even = buildEvenSplit(projects.length)
      projects.forEach((p, index) => {
        result[p.projectId] = even[index] ?? ''
      })
    }
  }

  return result
}

type TenantProjectCostContext =
  inferRouterOutputs<AppRouter>['crm']['tenantProjectCost']['getByProjectId']

function allocationContextKey(context: TenantProjectCostContext): string {
  const projectKey = context.projects
    .map((p) => `${p.projectId}:${p.allocationPercent ?? ''}`)
    .join('|')
  return `${context.tenantId}:${projectKey}`
}

function ProjectCostAllocationForm({
  context,
  project,
  onOpenChange,
  onSaved,
}: {
  context: TenantProjectCostContext
  project: Project
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}) {
  const tenantProjects = context.projects
  const [allocations, setAllocations] = useState(() => buildInitialAllocations(context.projects))
  const [submitError, setSubmitError] = useState<string | null>(null)

  const utils = trpc.useUtils()
  const saveMutation = trpc.crm.tenantProjectCost.savePresets.useMutation({
    onSuccess: () => {
      void utils.crm.tenantProjectCost.getByProjectId.invalidate()
      toast.success('项目成本分成已保存')
      onSaved?.()
      onOpenChange(false)
    },
    onError: (e) => setSubmitError(e.message),
  })

  const { totalPercent, isComplete, hasInvalidInput } = useMemo(() => {
    let total = 0
    let invalid = false
    let filled = 0

    for (const p of tenantProjects) {
      const raw = allocations[p.projectId] ?? ''
      if (!raw.trim()) continue
      filled += 1
      const parsed = parsePercent(raw)
      if (parsed == null) {
        invalid = true
        continue
      }
      total += parsed
    }

    const allFilled = filled === tenantProjects.length && tenantProjects.length > 0
    const sumOk = Math.abs(total - 100) < 0.01

    return {
      totalPercent: total,
      isComplete: allFilled && sumOk && !invalid,
      hasInvalidInput: invalid,
    }
  }, [allocations, tenantProjects])

  const updateAllocation = (projectId: string, value: string) => {
    setAllocations((prev) => ({ ...prev, [projectId]: value }))
    setSubmitError(null)
  }

  const distributeEvenly = () => {
    const even = buildEvenSplit(tenantProjects.length)
    const next: Record<string, string> = {}
    tenantProjects.forEach((p, index) => {
      next[p.projectId] = even[index] ?? ''
    })
    setAllocations(next)
    setSubmitError(null)
  }

  const handleSubmit = () => {
    if (tenantProjects.length === 0) {
      setSubmitError('未找到同租户项目')
      return
    }

    if (hasInvalidInput) {
      setSubmitError('请填写 0–100 之间的有效比例')
      return
    }

    if (!isComplete) {
      setSubmitError('各项目分成比例须全部填写，且合计为 100%')
      return
    }

    saveMutation.mutate({
      tenantId: context.tenantId,
      allocations: tenantProjects.map((p) => ({
        projectId: p.projectId,
        allocationPercent: allocations[p.projectId]!.trim(),
      })),
    })
  }

  const progressValue = Math.min(totalPercent, 100)
  const tenantLabel = context.platformTenantId ?? context.tenantName ?? project.platformTenantId

  return (
    <>
        <DialogHeader>
          <DialogTitle>项目成本分成</DialogTitle>
          <DialogDescription>
            租户{' '}
            <span className="font-mono text-foreground">{tenantLabel ?? '—'}</span>
            {context.tenantName && context.platformTenantId ? (
              <span className="text-muted-foreground">（{context.tenantName}）</span>
            ) : null}{' '}
            下共 {tenantProjects.length} 个项目，请配置各项目成本分成比例（合计须为 100%）。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {tenantProjects.length === 0 ? (
            <div className="rounded-md border px-3 py-6 text-center text-sm text-muted-foreground">
              未找到同租户下的项目
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <Label>分成合计</Label>
                  <span
                    className={
                      isComplete
                        ? 'font-medium text-green-600 dark:text-green-400'
                        : hasInvalidInput
                          ? 'font-medium text-destructive'
                          : 'font-medium text-amber-600 dark:text-amber-400'
                    }
                  >
                    {totalPercent.toFixed(2)}% / 100%
                  </span>
                </div>
                <Progress value={progressValue} className="h-2" />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {isComplete ? (
                    <>
                      <CheckCircle2 className="size-3.5 text-green-600" />
                      比例配置有效，可以保存
                    </>
                  ) : (
                    <>
                      <AlertCircle className="size-3.5 text-amber-600" />
                      {hasInvalidInput
                        ? '存在无效比例，请检查输入'
                        : '请填写全部项目比例，且合计须为 100%'}
                    </>
                  )}
                </div>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>项目名称</TableHead>
                      <TableHead>客户经理</TableHead>
                      <TableHead className="w-[140px] text-right">分成比例 (%)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenantProjects.map((p) => {
                      const isCurrent = p.projectId === project.id
                      const raw = allocations[p.projectId] ?? ''
                      const parsed = parsePercent(raw)
                      const invalid = raw.trim() !== '' && parsed == null

                      return (
                        <TableRow key={p.projectId} className={isCurrent ? 'bg-muted/40' : undefined}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{p.projectName}</span>
                              {isCurrent ? (
                                <Badge variant="secondary" className="text-xs font-normal">
                                  当前项目
                                </Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {p.accountManagerName || '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step="0.01"
                              inputMode="decimal"
                              className={`ml-auto w-[112px] text-right ${invalid ? 'border-destructive' : ''}`}
                              value={raw}
                              onChange={(e) => updateAllocation(p.projectId, e.target.value)}
                              disabled={tenantProjects.length === 1}
                              aria-label={`${p.projectName} 分成比例`}
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {tenantProjects.length > 1 ? (
                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={distributeEvenly}>
                    平均分配
                  </Button>
                </div>
              ) : null}
            </>
          )}

          {submitError ? <p className="text-sm text-destructive">{submitError}</p> : null}
        </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          取消
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={
            tenantProjects.length === 0 || !isComplete || saveMutation.isPending
          }
        >
          {saveMutation.isPending ? '保存中…' : '保存'}
        </Button>
      </DialogFooter>
    </>
  )
}

function ProjectCostAllocationDialogBody({
  project,
  onOpenChange,
  onSaved,
}: {
  project: Project
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}) {
  const { data: context, isLoading, error: loadError } =
    trpc.crm.tenantProjectCost.getByProjectId.useQuery({ projectId: project.id })

  if (isLoading) {
    return (
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>项目成本分成</DialogTitle>
          <DialogDescription>配置同租户下各项目的成本分成比例</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground py-6 text-center">加载中…</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    )
  }

  if (loadError) {
    return (
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>项目成本分成</DialogTitle>
          <DialogDescription>配置同租户下各项目的成本分成比例</DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {loadError.message}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    )
  }

  if (!context) {
    return (
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>项目成本分成</DialogTitle>
          <DialogDescription>配置同租户下各项目的成本分成比例</DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          当前项目未关联计费租户，无法配置成本分成。
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    )
  }

  return (
    <DialogContent className="sm:max-w-[640px]">
      <ProjectCostAllocationForm
        key={allocationContextKey(context)}
        context={context}
        project={project}
        onOpenChange={onOpenChange}
        onSaved={onSaved}
      />
    </DialogContent>
  )
}

export function ProjectCostAllocationDialog({
  open,
  onOpenChange,
  project,
  onSaved,
}: ProjectCostAllocationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && project ? (
        <ProjectCostAllocationDialogBody
          project={project}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
        />
      ) : null}
    </Dialog>
  )
}
