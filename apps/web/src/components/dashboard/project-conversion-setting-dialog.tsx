'use client'

import { useMemo, useState } from 'react'
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
import { StatusBadge } from '@/components/dashboard/status-badge'
import type { Project } from '@/lib/data/types'
import type { AppRouter, inferRouterOutputs } from '@/lib/server/routers'
import {
  CONVERSION_REASON_LABELS,
  CONVERSION_REASON_VALUES,
  type ConversionReason,
} from '@/lib/crm/commission-constants'
import {
  conversionDateToAnchorMonth,
  todayShanghaiDateString,
} from '@/lib/crm/project-effective-dates'
import { trpc } from '@/lib/trpc/client'

const SIGNING_REASONS = new Set<ConversionReason>(['offline_signing', 'online_signing'])

export type ProjectConversionSettingDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project | null
  onSaved?: () => void
}

type ConversionSetting =
  inferRouterOutputs<AppRouter>['crm']['projects']['getConversionSetting']

function ProjectConversionSettingForm({
  project,
  existing,
  onOpenChange,
  onSaved,
}: {
  project: Project
  existing: ConversionSetting | undefined
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}) {
  const [reason, setReason] = useState<ConversionReason>(
    existing?.reason ?? 'online_signing',
  )
  const [signedOn, setSignedOn] = useState(existing?.signedOn ?? '')
  const [conversionDate, setConversionDate] = useState(
    existing?.conversionDate ?? todayShanghaiDateString(),
  )
  const [remark, setRemark] = useState(existing?.remark ?? '')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)

  const utils = trpc.useUtils()

  const anchorMonthDisplay = useMemo(() => {
    if (project.dealClosedMonth) return project.dealClosedMonth
    return conversionDateToAnchorMonth(conversionDate) ?? ''
  }, [project.dealClosedMonth, conversionDate])

  const remarkRequired = reason === 'online_registration_only'

  const saveMutation = trpc.crm.projects.setConversionSetting.useMutation({
    onSuccess: () => {
      toast.success(existing ? '转正信息已更新' : '项目已转正')
      onSaved?.()
      onOpenChange(false)
    },
    onError: (e) => setSubmitError(e.message),
  })

  const handleSubmit = async () => {
    if (!reason) {
      setSubmitError('请选择转正原因')
      return
    }
    if (!signedOn) {
      setSubmitError('请选择签约日期')
      return
    }
    if (!conversionDate) {
      setSubmitError('请选择转正日期')
      return
    }
    if (remarkRequired && !remark.trim()) {
      setSubmitError('仅线上注册须填写备注')
      return
    }

    if (SIGNING_REASONS.has(reason)) {
      setIsValidating(true)
      setSubmitError(null)
      try {
        const hasRecharge = await utils.crm.projects.hasRechargeOnConversionDate.fetch({
          projectId: project.id,
          conversionDate,
        })
        if (!hasRecharge) {
          setSubmitError('指定转正日期当天无已完成充值记录，无法保存')
          return
        }
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : '充值校验失败')
        return
      } finally {
        setIsValidating(false)
      }
    }

    saveMutation.mutate({
      projectId: project.id,
      reason,
      signedOn,
      conversionDate,
      remark: remark.trim() || undefined,
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>项目转正设置</DialogTitle>
        <DialogDescription>
          项目「{project.name}」：登记转正原因与日期，并将阶段更新为已转正。
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">当前阶段：</span>
          <StatusBadge status={project.stage} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="project-conversion-reason">转正原因</Label>
          <Select value={reason} onValueChange={(v) => setReason(v as ConversionReason)}>
            <SelectTrigger id="project-conversion-reason" className="w-full">
              <SelectValue placeholder="请选择转正原因" />
            </SelectTrigger>
            <SelectContent>
              {CONVERSION_REASON_VALUES.map((value) => (
                <SelectItem key={value} value={value}>
                  {CONVERSION_REASON_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="project-conversion-signed">签约日期</Label>
          <Input
            id="project-conversion-signed"
            type="date"
            value={signedOn}
            onChange={(e) => {
              setSignedOn(e.target.value)
              setSubmitError(null)
            }}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="project-conversion-date">转正日期</Label>
          <Input
            id="project-conversion-date"
            type="date"
            value={conversionDate}
            onChange={(e) => {
              setConversionDate(e.target.value)
              setSubmitError(null)
            }}
          />
          <p className="text-xs text-muted-foreground">
            转正日期用于经营留痕；提成月序分段按成交锚定月（首消月）计算。
          </p>
        </div>
        {anchorMonthDisplay ? (
          <div className="grid gap-2">
            <Label>成交锚定月</Label>
            <p className="text-sm font-medium">{anchorMonthDisplay}</p>
            <p className="text-xs text-muted-foreground">
              {project.dealClosedMonth
                ? '已按首月消费锚定'
                : '根据转正日期预览；首月有消费后将写入项目主数据'}
            </p>
          </div>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor="project-conversion-remark">
            备注{remarkRequired ? '（必填）' : '（可选）'}
          </Label>
          <Textarea
            id="project-conversion-remark"
            rows={2}
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder={remarkRequired ? '请说明仅线上注册原因' : '补充说明'}
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
          onClick={() => void handleSubmit()}
          disabled={saveMutation.isPending || isValidating}
        >
          {isValidating
            ? '校验充值中…'
            : saveMutation.isPending
              ? '保存中…'
              : existing
                ? '保存'
                : '保存并转正'}
        </Button>
      </DialogFooter>
    </>
  )
}

function ProjectConversionSettingDialogBody({
  project,
  onOpenChange,
  onSaved,
}: {
  project: Project
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}) {
  const { data: existing, isLoading } = trpc.crm.projects.getConversionSetting.useQuery({
    projectId: project.id,
  })

  if (isLoading) {
    return (
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>项目转正设置</DialogTitle>
          <DialogDescription>项目转正设置</DialogDescription>
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

  const formKey = `${project.id}:${existing?.reason ?? ''}:${existing?.conversionDate ?? ''}`

  return (
    <DialogContent className="sm:max-w-[480px]">
      <ProjectConversionSettingForm
        key={formKey}
        project={project}
        existing={existing ?? undefined}
        onOpenChange={onOpenChange}
        onSaved={onSaved}
      />
    </DialogContent>
  )
}

export function ProjectConversionSettingDialog({
  open,
  onOpenChange,
  project,
  onSaved,
}: ProjectConversionSettingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && project ? (
        <ProjectConversionSettingDialogBody
          project={project}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
        />
      ) : null}
    </Dialog>
  )
}
