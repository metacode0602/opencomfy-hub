'use client'

import * as React from 'react'
import Link from 'next/link'
import { IconAlertTriangle, IconLoader2, IconUpload } from '@tabler/icons-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
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
import type { Project } from '@/lib/data/types'
import { trpc } from '@/lib/trpc/client'
import {
  bareMetalOrderDetailPath,
  formatBareMetalDateTime,
  formatBareMetalMoney,
} from '@/lib/supplier/bare-metal-order-utils'
import type { OfflineBareMetalOrderPreviewResult } from '@/lib/types/bare-metal-order-api'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project
  onImported?: () => void
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

export function ProjectOfflineBareMetalOrderImportDialog({
  open,
  onOpenChange,
  project,
  onImported,
}: Props) {
  const utils = trpc.useUtils()
  const [tenantId, setTenantId] = React.useState('')
  const [file, setFile] = React.useState<File | null>(null)
  const [preview, setPreview] = React.useState<OfflineBareMetalOrderPreviewResult | null>(null)

  const { data: tenants = [], isLoading: tenantsLoading } =
    trpc.crm.projects.listBillingTenants.useQuery(
      { projectId: project.id },
      { enabled: open },
    )

  React.useEffect(() => {
    if (!open) return
    if (tenants.length === 1 && !tenantId) {
      setTenantId(tenants[0]!.id)
    }
  }, [open, tenants, tenantId])

  React.useEffect(() => {
    if (!open) {
      setFile(null)
      setPreview(null)
      setTenantId(tenants.length === 1 ? (tenants[0]?.id ?? '') : '')
    }
  }, [open, tenants])

  const previewMutation = trpc.crm.projects.previewOfflineBareMetalOrders.useMutation({
    onSuccess: (result) => {
      setPreview(result)
      if (result.headerErrors.length > 0) {
        toast.error(result.headerErrors.join('；'))
      }
    },
    onError: (err) => toast.error(err.message),
  })

  const commitMutation = trpc.crm.projects.commitOfflineBareMetalOrders.useMutation({
    onSuccess: (result) => {
      toast.success(
        <span>
          导入成功：{result.orderNo}（{result.deviceLineCount} 行明细，{' '}
          {formatBareMetalMoney(result.finalAmount)}）
          <Link
            href={bareMetalOrderDetailPath(result.bareMetalOrderId)}
            className="ml-2 underline"
          >
            查看订单
          </Link>
        </span>,
      )
      void utils.crm.projects.listBareMetalOrders.invalidate({ projectId: project.id })
      void utils.supplier.bareMetalOrder.list.invalidate()
      onImported?.()
      onOpenChange(false)
    },
    onError: (err) => toast.error(err.message),
  })

  const handlePreview = async () => {
    if (!tenantId) {
      toast.error('请选择计费租户')
      return
    }
    if (!file) {
      toast.error('请上传 Excel 文件')
      return
    }
    const fileBase64 = await fileToBase64(file)
    previewMutation.mutate({
      projectId: project.id,
      tenantId,
      fileName: file.name,
      fileBase64,
    })
  }

  const handleCommit = () => {
    if (!preview?.previewToken) {
      toast.error('请先预览')
      return
    }
    commitMutation.mutate({ previewToken: preview.previewToken })
  }

  const errorRowCount = preview?.rows.filter((r) => r.errors.length > 0).length ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>导入线下裸金属订单</DialogTitle>
          <DialogDescription>
            上传设备明细 Excel（7 列：卡型、卡数、开始时间、结束时间、时长、卡时单价、总价）。一次上传生成一张订单。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>项目</Label>
            <Input value={project.name} readOnly />
          </div>

          <div className="grid gap-2">
            <Label>计费租户</Label>
            <Select value={tenantId} onValueChange={setTenantId} disabled={tenantsLoading}>
              <SelectTrigger>
                <SelectValue placeholder={tenantsLoading ? '加载中…' : '选择计费租户'} />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                    {tenant.platformTenantId ? ` (${tenant.platformTenantId})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Excel 文件</Label>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null)
                setPreview(null)
              }}
            />
          </div>

          {preview && (
            <>
              <CardSummary preview={preview} />
              {preview.headerErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertDescription>{preview.headerErrors.join('；')}</AlertDescription>
                </Alert>
              )}
              {errorRowCount > 0 && (
                <Alert>
                  <IconAlertTriangle className="size-4" />
                  <AlertDescription>{errorRowCount} 行存在校验错误，请修正后重新上传</AlertDescription>
                </Alert>
              )}
              <PreviewTable preview={preview} />
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            variant="secondary"
            onClick={() => void handlePreview()}
            disabled={previewMutation.isPending || !file || !tenantId}
          >
            {previewMutation.isPending ? (
              <IconLoader2 className="size-4 animate-spin mr-1" />
            ) : (
              <IconUpload className="size-4 mr-1" />
            )}
            预览
          </Button>
          <Button
            onClick={handleCommit}
            disabled={!preview?.selectable || commitMutation.isPending}
          >
            {commitMutation.isPending && <IconLoader2 className="size-4 animate-spin mr-1" />}
            确认导入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CardSummary({ preview }: { preview: OfflineBareMetalOrderPreviewResult }) {
  const { headSummary } = preview
  return (
    <div className="rounded-lg border p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
      <div>
        <p className="text-muted-foreground">明细行数</p>
        <p className="font-medium">{headSummary.deviceLineCount}</p>
      </div>
      <div>
        <p className="text-muted-foreground">GPU 卡数</p>
        <p className="font-medium">{headSummary.gpuCount}</p>
      </div>
      <div>
        <p className="text-muted-foreground">总金额</p>
        <p className="font-medium">{formatBareMetalMoney(headSummary.finalAmount)}</p>
      </div>
      <div>
        <p className="text-muted-foreground">租用时段</p>
        <p className="font-medium text-xs">
          {formatBareMetalDateTime(headSummary.rentStartsAt)} ~{' '}
          {formatBareMetalDateTime(headSummary.rentEndsAt)}
        </p>
      </div>
    </div>
  )
}

function PreviewTable({ preview }: { preview: OfflineBareMetalOrderPreviewResult }) {
  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>行</TableHead>
            <TableHead>卡型</TableHead>
            <TableHead>卡数</TableHead>
            <TableHead>开始</TableHead>
            <TableHead>结束</TableHead>
            <TableHead>时长</TableHead>
            <TableHead>单价</TableHead>
            <TableHead>总价</TableHead>
            <TableHead>校验</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {preview.rows.map((row) => (
            <TableRow key={row.rowNo}>
              <TableCell>{row.rowNo}</TableCell>
              <TableCell>{row.cardType}</TableCell>
              <TableCell>{row.gpuCount}</TableCell>
              <TableCell className="text-xs">{formatBareMetalDateTime(row.rentStartsAt)}</TableCell>
              <TableCell className="text-xs">{formatBareMetalDateTime(row.rentEndsAt)}</TableCell>
              <TableCell>{row.durationHours}</TableCell>
              <TableCell>{row.unitPricePerCardHour}</TableCell>
              <TableCell>{row.lineAmount}</TableCell>
              <TableCell>
                {row.errors.length === 0 ? (
                  <Badge variant="outline">通过</Badge>
                ) : (
                  <span className="text-destructive text-xs">{row.errors.join('；')}</span>
                )}
                {row.warnings.map((w) => (
                  <p key={w} className="text-xs text-amber-600 mt-1">
                    {w}
                  </p>
                ))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
