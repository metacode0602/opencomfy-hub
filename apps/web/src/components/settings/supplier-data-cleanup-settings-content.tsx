'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { IconAlertTriangle, IconDatabase, IconLoader2, IconRefresh } from '@tabler/icons-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@workspace/ui/components/alert-dialog'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Checkbox } from '@workspace/ui/components/checkbox'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { cn } from '@workspace/ui/lib/utils'
import { trpc } from '@/lib/trpc/client'
import type { SupplierDataCleanupMode } from '@/lib/server/routers/supplier/data-cleanup-schemas'

const MODE_OPTIONS: { value: SupplierDataCleanupMode; label: string; description: string }[] = [
  {
    value: 'full',
    label: '全量重置',
    description: '删除全部物理机、全部批次、GPU 库存及关联审计/快照（方案 A）',
  },
  {
    value: 'business_batches_only',
    label: '仅商务批次',
    description: '仅删除 online / order_access 批次，保留已入库设备（方案 B）',
  },
  {
    value: 'scoped',
    label: '按范围清理',
    description: '在选定供应商或机房内执行全量重置（方案 C）',
  },
]

const DELETED_ITEMS = [
  '物理机、计算节点、资源池绑定',
  '设备变更日志、批次关联、导入行、计划行、进度事件',
  'GPU L1 库存、内部测试占用',
  '接入批次（含上架/导入/变更/下架）',
  '相关活动时间线与状态审计日志',
  '设备日/小时快照与生命周期事件',
]

const PRESERVED_ITEMS = [
  '供应商、机房、合同、刊例价、定价记录',
  '账单、生命周期字典',
  '故障单主记录（仅解绑设备）',
]

function envBadgeVariant(appEnv: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (appEnv === 'production') return 'destructive'
  if (appEnv === 'preview') return 'secondary'
  return 'outline'
}

export function SupplierDataCleanupSettingsContent() {
  const [mode, setMode] = useState<SupplierDataCleanupMode>('full')
  const [supplierId, setSupplierId] = useState<string>('')
  const [dataCenterId, setDataCenterId] = useState<string>('')
  const [includeOpsUploadBatch, setIncludeOpsUploadBatch] = useState(true)
  const [confirmToken, setConfirmToken] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [approvalTicketNo, setApprovalTicketNo] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [showDeletedList, setShowDeletedList] = useState(false)
  const [showPreservedList, setShowPreservedList] = useState(false)

  const utils = trpc.useUtils()

  const { data: capabilities } = trpc.supplier.dataCleanup.getCapabilities.useQuery()
  const { data: suppliers } = trpc.supplier.list.useQuery({})
  const { data: dataCenters } = trpc.supplier.listAllDataCenters.useQuery(
    { supplierId: supplierId || undefined },
    { enabled: mode === 'scoped' },
  )

  const previewInput = useMemo(
    () => ({
      mode,
      supplierId: mode === 'scoped' && supplierId ? supplierId : undefined,
      dataCenterId: mode === 'scoped' && dataCenterId ? dataCenterId : undefined,
      includeOpsUploadBatch: mode !== 'business_batches_only' ? includeOpsUploadBatch : false,
    }),
    [mode, supplierId, dataCenterId, includeOpsUploadBatch],
  )

  const {
    data: preview,
    isFetching: previewLoading,
    refetch: refetchPreview,
    error: previewError,
  } = trpc.supplier.dataCleanup.preview.useQuery(previewInput, {
    enabled: mode !== 'scoped' || Boolean(supplierId || dataCenterId),
  })

  const executeMutation = trpc.supplier.dataCleanup.execute.useMutation({
    onSuccess: (result) => {
      toast.success('数据清理已完成')
      setConfirmOpen(false)
      setConfirmToken('')
      setAcknowledged(false)
      void utils.supplier.dataCleanup.preview.invalidate()
      void refetchPreview()
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })

  const canPreview = mode !== 'scoped' || Boolean(supplierId || dataCenterId)
  const requiresApproval = capabilities?.requiresApprovalTicket ?? false
  const canExecute =
    canPreview &&
    confirmToken === 'DELETE' &&
    acknowledged &&
    (!requiresApproval || approvalTicketNo.trim().length > 0) &&
    !executeMutation.isPending

  const lastResult = executeMutation.data

  function handleOpenConfirm() {
    if (!canPreview) {
      toast.error('按范围清理需至少选择供应商或机房')
      return
    }
    if (!preview?.rows?.length) {
      toast.error('请先刷新预览')
      return
    }
    if (preview.totalWillDelete === 0) {
      toast.error('当前范围内没有可删除的数据')
      return
    }
    setConfirmOpen(true)
  }

  function handleExecute() {
    executeMutation.mutate({
      ...previewInput,
      confirmToken: 'DELETE',
      acknowledged: true,
      approvalTicketNo: approvalTicketNo.trim() || undefined,
    })
  }

  return (
    <div className="space-y-6">
      {capabilities ? (
        <div
          className={cn(
            'flex items-center gap-3 rounded-lg border px-4 py-3 text-sm',
            capabilities.isProduction
              ? 'border-destructive/50 bg-destructive/5 text-destructive'
              : 'border-border bg-muted/30',
          )}
        >
          <IconAlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            当前环境：
            <Badge variant={envBadgeVariant(capabilities.appEnv)} className="ml-2">
              {capabilities.appEnv}
            </Badge>
            {capabilities.isProduction
              ? ' — 生产环境须填写变更审批单号后方可执行'
              : ' — 数据清理不可逆，建议先备份数据库'}
          </span>
        </div>
      ) : null}

      <div>
        <h2 className="font-semibold flex items-center gap-2">
          <IconDatabase className="h-5 w-5 text-muted-foreground" />
          供应商设备域数据清理
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          清理物理机台账、接入批次、L1 库存及相关审计/快照，便于测试环境从零重新导入（逻辑对齐
          supplier-device-data-cleanup-sql 设计文档）。
        </p>
      </div>

      <div className="space-y-3">
        <Label>清理模式</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMode(opt.value)}
              className={cn(
                'rounded-lg border p-3 text-left text-sm transition-colors',
                mode === opt.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/40',
              )}
            >
              <p className="font-medium">{opt.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{opt.description}</p>
            </button>
          ))}
        </div>
      </div>

      {mode === 'scoped' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>供应商</Label>
            <Select
              value={supplierId || '_all'}
              onValueChange={(v) => {
                setSupplierId(v === '_all' ? '' : v)
                setDataCenterId('')
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择供应商（可选）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">不限制供应商</SelectItem>
                {(suppliers ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.shortName || s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>机房</Label>
            <Select
              value={dataCenterId || '_all'}
              onValueChange={(v) => setDataCenterId(v === '_all' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择机房（可选）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">不限制机房</SelectItem>
                {(dataCenters ?? []).map((dc) => (
                  <SelectItem key={dc.id} value={dc.id}>
                    {dc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!supplierId && !dataCenterId ? (
            <p className="text-sm text-destructive sm:col-span-2">请至少选择供应商或机房之一</p>
          ) : null}
        </div>
      ) : null}

      {mode !== 'business_batches_only' ? (
        <div className="flex items-center gap-2">
          <Checkbox
            id="include-ops-upload"
            checked={includeOpsUploadBatch}
            onCheckedChange={(v) => setIncludeOpsUploadBatch(v === true)}
            disabled={mode === 'scoped' && Boolean(dataCenterId) && !supplierId}
          />
          <Label htmlFor="include-ops-upload" className="text-sm font-normal cursor-pointer">
            同时清理运维 Excel 上传批次
            {mode === 'scoped' && dataCenterId && !supplierId
              ? '（按机房清理时不可用，请选择供应商）'
              : null}
          </Label>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
          onClick={() => setShowDeletedList((v) => !v)}
        >
          {showDeletedList ? '收起' : '展开'}将删除的数据
        </button>
        <span className="text-muted-foreground">·</span>
        <button
          type="button"
          className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
          onClick={() => setShowPreservedList((v) => !v)}
        >
          {showPreservedList ? '收起' : '展开'}将保留的数据
        </button>
      </div>
      {showDeletedList ? (
        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
          {DELETED_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {showPreservedList ? (
        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
          {PRESERVED_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}

      <div className="rounded-xl border border-border">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <p className="font-medium text-sm">影响预览</p>
            {preview?.previewedAt ? (
              <p className="text-xs text-muted-foreground">
                上次更新 {new Date(preview.previewedAt).toLocaleString('zh-CN', { hour12: false })}
              </p>
            ) : null}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!canPreview || previewLoading}
            onClick={() => void refetchPreview()}
          >
            {previewLoading ? (
              <IconLoader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <IconRefresh className="h-4 w-4 mr-1" />
            )}
            刷新预览
          </Button>
        </div>
        {previewError ? (
          <p className="p-4 text-sm text-destructive">{previewError.message}</p>
        ) : !canPreview ? (
          <p className="p-4 text-sm text-muted-foreground">选择范围后可预览影响行数</p>
        ) : previewLoading && !preview ? (
          <p className="p-4 text-sm text-muted-foreground">加载中…</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>数据项</TableHead>
                  <TableHead className="text-right">当前行数</TableHead>
                  <TableHead className="text-right">本次将删</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(preview?.rows ?? []).map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.currentCount}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {row.willDeleteCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="px-4 py-3 text-sm text-muted-foreground border-t border-border">
              合计将删除约 <strong>{preview?.totalWillDelete ?? 0}</strong> 行
            </p>
          </>
        )}
      </div>

      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 space-y-4">
        <p className="text-sm font-medium text-destructive">危险操作</p>
        <p className="text-sm text-muted-foreground">
          此操作不可撤销。执行前请确认已备份数据库。
        </p>
        <div className="space-y-2">
          <Label htmlFor="confirm-delete">为确认意图，请输入 DELETE</Label>
          <Input
            id="confirm-delete"
            value={confirmToken}
            onChange={(e) => setConfirmToken(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
          />
        </div>
        <div className="flex items-start gap-2">
          <Checkbox
            id="ack-cleanup"
            checked={acknowledged}
            onCheckedChange={(v) => setAcknowledged(v === true)}
          />
          <Label htmlFor="ack-cleanup" className="text-sm font-normal leading-snug cursor-pointer">
            我已阅读将删除的数据范围，并确认当前环境允许执行
          </Label>
        </div>
        {requiresApproval ? (
          <div className="space-y-2">
            <Label htmlFor="approval-ticket">变更审批单号（必填）</Label>
            <Input
              id="approval-ticket"
              value={approvalTicketNo}
              onChange={(e) => setApprovalTicketNo(e.target.value)}
              placeholder="生产环境变更单号"
            />
          </div>
        ) : null}
        <Button variant="destructive" disabled={!canExecute} onClick={handleOpenConfirm}>
          {executeMutation.isPending ? (
            <>
              <IconLoader2 className="h-4 w-4 animate-spin mr-2" />
              执行中…
            </>
          ) : (
            '执行清理'
          )}
        </Button>
      </div>

      {lastResult ? (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="font-medium text-sm text-green-600 dark:text-green-500">清理完成</p>
          <p className="text-sm text-muted-foreground">
            耗时 {(lastResult.durationMs / 1000).toFixed(1)}s ·{' '}
            {new Date(lastResult.completedAt).toLocaleString('zh-CN', { hour12: false })}
          </p>
          <div className="text-sm grid grid-cols-2 sm:grid-cols-3 gap-2">
            <span>物理机：{lastResult.validation.devices}</span>
            <span>批次：{lastResult.validation.batches}</span>
            <span>库存：{lastResult.validation.inventory}</span>
            <span>变更日志：{lastResult.validation.changeLogs}</span>
            <span>设备关联：{lastResult.validation.deviceLinks}</span>
            <span>进度事件：{lastResult.validation.progressEvents}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            主数据保留 — 供应商 {lastResult.validation.preserved.suppliers} · 机房{' '}
            {lastResult.validation.preserved.datacenters} · 合同{' '}
            {lastResult.validation.preserved.contracts}
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/supplier/overview">前往供应商总览</Link>
          </Button>
        </div>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认执行数据清理</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  模式：
                  <strong className="text-foreground ml-1">
                    {MODE_OPTIONS.find((m) => m.value === mode)?.label}
                  </strong>
                </p>
                <p>
                  将删除约 <strong className="text-foreground">{preview?.totalWillDelete ?? 0}</strong>{' '}
                  行数据，此操作无法通过界面撤销。
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>返回</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault()
                handleExecute()
              }}
              disabled={executeMutation.isPending}
            >
              {executeMutation.isPending ? '执行中…' : '确认执行'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
