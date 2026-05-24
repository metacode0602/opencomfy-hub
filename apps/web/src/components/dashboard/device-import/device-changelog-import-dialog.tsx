'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import { Label } from '@workspace/ui/components/label'
import { parseDeviceImportFile } from '@/lib/supplier-ops/parse-device-import-file'
import {
  DEVICE_IMPORT_ACCEPT,
  DEVICE_IMPORT_MAX_BYTES,
  isDeviceImportFileName,
} from '@/lib/supplier/device-import-utils'
import type { DeviceChangelogParsedRow } from '@/lib/types/supplier-domain'
import { trpc } from '@/lib/trpc/client'
import { IMPORT_META, useInvalidateAfterDeviceImport } from './device-import-dialog-shared'

type WizardStep = 'import' | 'preview'

const meta = IMPORT_META.device_changelog

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return '操作失败，请稍后重试'
}

function ParseStatusBadge({ status }: { status: string }) {
  const cls =
    status === 'ok'
      ? 'bg-green-500/20 text-green-400 border-green-500/30'
      : status === 'warning'
        ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
        : 'bg-red-500/20 text-red-400 border-red-500/30'
  return (
    <Badge variant="outline" className={cls}>
      {status === 'ok' ? '通过' : status === 'warning' ? '警告' : '失败'}
    </Badge>
  )
}

export interface DeviceChangelogImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplierId: string
  defaultDataCenterId?: string
  dataCenterName?: string
  lockDataCenter?: boolean
  onSuccess?: () => void
}

export function DeviceChangelogImportDialog({
  open,
  onOpenChange,
  supplierId,
  defaultDataCenterId,
  dataCenterName,
  lockDataCenter = false,
  onSuccess,
}: DeviceChangelogImportDialogProps) {
  const invalidateAfterCommit = useInvalidateAfterDeviceImport(
    supplierId,
    defaultDataCenterId,
  )

  const { data: dataCenters = [], isLoading: dcLoading } = trpc.supplier.listDataCenters.useQuery(
    { supplierId },
    { enabled: Boolean(supplierId) && open },
  )

  const commitMutation = trpc.supplier.deviceImport.commitChangelog.useMutation()

  const [wizardStep, setWizardStep] = useState<WizardStep>('import')
  const [parsing, setParsing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [dataCenterId, setDataCenterId] = useState('')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<DeviceChangelogParsedRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)

  const lockedDcLabel =
    dataCenterName ??
    dataCenters.find((dc) => dc.id === (dataCenterId || defaultDataCenterId))?.name ??
    defaultDataCenterId ??
    '—'

  const resetWizard = () => {
    setWizardStep('import')
    setDataCenterId(defaultDataCenterId ?? '')
    setFileName('')
    setRows([])
    setParseError(null)
    setParsing(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  useEffect(() => {
    if (open) {
      resetWizard()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog opens
  }, [open, defaultDataCenterId])

  const onParseFile = async (file: File) => {
    setParseError(null)
    if (!selectedDataCenterId) {
      setParseError('请先选择机房')
      toast.error('请先选择机房')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    if (!isDeviceImportFileName(file.name)) {
      setParseError('仅支持 .xlsx / .xls / .csv / .tsv 文件')
      toast.error('仅支持 .xlsx / .xls / .csv / .tsv 文件')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    if (file.size > DEVICE_IMPORT_MAX_BYTES) {
      setParseError('文件不能超过 10MB')
      toast.error('文件不能超过 10MB')
      if (fileRef.current) fileRef.current.value = ''
      return
    }

    setParsing(true)
    try {
      const buffer = await file.arrayBuffer()
      setFileName(file.name)
      const result = parseDeviceImportFile(buffer, file.name, 'device_changelog')
      if (!result.ok) {
        setParseError(result.error)
        return
      }
      setRows(result.rows)
      setWizardStep('preview')
      toast.success(`解析 ${result.rows.length} 行`)
    } catch (e) {
      const message = getErrorMessage(e)
      setParseError(message)
      toast.error(message)
    } finally {
      setParsing(false)
    }
  }

  const okCount = rows.filter((r) => r.parse_status === 'ok').length
  const warnCount = rows.filter((r) => r.parse_status === 'warning').length
  const selectedDataCenterId = dataCenterId || defaultDataCenterId
  const canUpload =
    Boolean(selectedDataCenterId) || (lockDataCenter && Boolean(defaultDataCenterId))

  const commitImport = async () => {
    if (!selectedDataCenterId) {
      toast.error('请选择机房')
      return
    }
    if (okCount === 0) {
      toast.error('没有通过校验的行可入库')
      return
    }

    try {
      const result = await commitMutation.mutateAsync({
        supplierId,
        dataCenterId: selectedDataCenterId,
        fileName,
        rows,
      })
      const bound = result.boundDeviceCount ?? 0
      toast.success(
        bound > 0
          ? `已写入 ${result.committedCount} 条变更，${bound} 台设备已挂接业务批次`
          : `已写入 ${result.committedCount} 条变更记录`,
      )
      if (result.skippedCount > 0 || result.warnings.length > 0) {
        toast.warning(
          result.warnings.length > 0
            ? result.warnings.slice(0, 3).join('；')
            : `跳过 ${result.skippedCount} 行`,
        )
      }
      invalidateAfterCommit()
      onSuccess?.()
      onOpenChange(false)
      resetWizard()
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  return (
    <Dialog
      open={open}
      modal={false}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) resetWizard()
      }}
    >
      <DialogContent
        className="flex h-[50vh] min-h-0 min-w-[50vw] max-w-4xl flex-col gap-4 overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            导入{meta.title}
          </DialogTitle>
          <DialogDescription>
            {meta.description} · 目标表 {meta.tableTarget}
          </DialogDescription>
        </DialogHeader>

        {wizardStep === 'import' && (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
              <p className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                必需列：{meta.columnsHint}
              </p>
              {lockDataCenter && defaultDataCenterId ? (
                <div className="space-y-2">
                  <Label>机房</Label>
                  <p className="text-sm text-foreground">{lockedDcLabel}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>机房</Label>
                  {dcLoading ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      加载机房...
                    </p>
                  ) : dataCenters.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      该供应商暂无机房，请先在「机房管理」中添加
                    </p>
                  ) : (
                    <Select
                      value={selectedDataCenterId || undefined}
                      onValueChange={setDataCenterId}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="选择机房" />
                      </SelectTrigger>
                      <SelectContent position="popper" className="z-[100]">
                        {dataCenters.map((dc) => (
                          <SelectItem key={dc.id} value={dc.id}>
                            {dc.name}
                            {dc.code ? ` · ${dc.code}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
              <div
                className={
                  canUpload
                    ? 'cursor-pointer rounded-lg border border-dashed border-border p-6 text-center hover:bg-muted/30'
                    : 'rounded-lg border border-dashed border-border p-6 text-center opacity-50'
                }
                onClick={() => {
                  if (canUpload) fileRef.current?.click()
                }}
              >
                <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">点击上传 Excel / CSV</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {canUpload
                    ? '支持 .xlsx / .xls / .csv / .tsv；首行为表头，CSV 须 UTF-8，最大 10MB'
                    : '请先选择机房'}
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept={DEVICE_IMPORT_ACCEPT}
                className="hidden"
                disabled={!canUpload}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void onParseFile(f)
                }}
              />
              {parsing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  解析中...
                </div>
              )}
              {parseError && <p className="text-sm text-destructive">{parseError}</p>}
            </div>
            <DialogFooter className="shrink-0">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
            </DialogFooter>
          </div>
        )}

        {wizardStep === 'preview' && (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex shrink-0 flex-wrap gap-2 text-sm">
              <Badge variant="outline">{meta.title}</Badge>
              <span className="text-muted-foreground">
                文件 {fileName} · 共 {rows.length} 行 · 通过 {okCount}
                {warnCount > 0 ? ` · 警告 ${warnCount}` : ''}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>行</TableHead>
                    <TableHead>设备ID</TableHead>
                    <TableHead>操作时间</TableHead>
                    <TableHead>变更动作</TableHead>
                    <TableHead>工单</TableHead>
                    <TableHead>校验</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.row_no}>
                      <TableCell>{r.row_no}</TableCell>
                      <TableCell className="font-mono text-xs">{r.external_device_id ?? '—'}</TableCell>
                      <TableCell className="text-xs">{r.occurred_at}</TableCell>
                      <TableCell>{r.change_action}</TableCell>
                      <TableCell>{r.ticket_no ?? '—'}</TableCell>
                      <TableCell>
                        <ParseStatusBadge status={r.parse_status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DialogFooter className="shrink-0">
              <Button
                variant="outline"
                onClick={() => {
                  setWizardStep('import')
                  setFileName('')
                  setRows([])
                  setParseError(null)
                  if (fileRef.current) fileRef.current.value = ''
                }}
              >
                重新上传
              </Button>
              <Button
                disabled={commitMutation.isPending || okCount === 0}
                onClick={() => void commitImport()}
              >
                {commitMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                确认入库
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export interface DeviceChangelogImportTriggerProps {
  supplierId: string
  defaultDataCenterId?: string
  dataCenterName?: string
  lockDataCenter?: boolean
  onSuccess?: () => void
  children?: ReactNode
  className?: string
  variant?: 'default' | 'outline' | 'ghost' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export function DeviceChangelogImportTrigger({
  supplierId,
  defaultDataCenterId,
  dataCenterName,
  lockDataCenter,
  onSuccess,
  children,
  className,
  variant = 'default',
  size = 'sm',
}: DeviceChangelogImportTriggerProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        className={className ?? 'w-full gap-2'}
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
      >
        {children ?? (
          <>
            <Upload className="h-4 w-4" />
            上传导入
          </>
        )}
      </Button>
      <DeviceChangelogImportDialog
        open={open}
        onOpenChange={setOpen}
        supplierId={supplierId}
        defaultDataCenterId={defaultDataCenterId}
        dataCenterName={dataCenterName}
        lockDataCenter={lockDataCenter}
        onSuccess={onSuccess}
      />
    </>
  )
}
