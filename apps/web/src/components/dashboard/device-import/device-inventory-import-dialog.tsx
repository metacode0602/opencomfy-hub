'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
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
import { DEVICE_COOPERATION_TYPE_LABELS } from '@/lib/types/supplier-domain'
import {
  DEVICE_IMPORT_ACCEPT,
  DEVICE_IMPORT_MAX_BYTES,
  isDeviceImportFileName,
} from '@/lib/supplier/device-import-utils'
import type { DeviceInventoryParsedRow } from '@/lib/types/supplier-domain'
import {
  downloadUnrecognizedGpuCardTypesExcel,
  gpuCardTypeMatchLabel,
  validateInventoryGpuCardTypes,
} from '@/lib/supplier/gpu-card-type-import-match'
import { trpc } from '@/lib/trpc/client'
import { IMPORT_META, useInvalidateAfterDeviceImport } from './device-import-dialog-shared'

type WizardStep = 'import' | 'preview'

const meta = IMPORT_META.device_inventory

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

export interface DeviceInventoryImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplierId: string
  defaultDataCenterId?: string
  dataCenterName?: string
  lockDataCenter?: boolean
  onSuccess?: () => void
}

export function DeviceInventoryImportDialog({
  open,
  onOpenChange,
  supplierId,
  defaultDataCenterId,
  dataCenterName,
  lockDataCenter = false,
  onSuccess,
}: DeviceInventoryImportDialogProps) {
  const invalidateAfterCommit = useInvalidateAfterDeviceImport(
    supplierId,
    defaultDataCenterId,
  )

  const { data: dataCenters = [], isLoading: dcLoading } = trpc.supplier.listDataCenters.useQuery(
    { supplierId },
    { enabled: Boolean(supplierId) && open },
  )

  const { data: gpuCardTypes = [], isLoading: gpuCardTypesLoading } =
    trpc.supplier.gpuCardTypes.list.useQuery({ status: 'all' }, { enabled: open })

  const commitMutation = trpc.supplier.deviceImport.commitInventory.useMutation()

  const [wizardStep, setWizardStep] = useState<WizardStep>('import')
  const [parsing, setParsing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [dataCenterId, setDataCenterId] = useState('')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<DeviceInventoryParsedRow[]>([])
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
      const result = parseDeviceImportFile(buffer, file.name, 'device_inventory')
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

  const gpuCardTypeOptions = useMemo(
    () =>
      gpuCardTypes.map((card) => ({
        id: card.id,
        code: card.code ?? '',
        name: card.name,
        label: `${card.code ?? card.name} · ${card.name}`,
      })),
    [gpuCardTypes],
  )

  const gpuValidation = useMemo(() => {
    if (rows.length === 0 || gpuCardTypes.length === 0) {
      return null
    }
    return validateInventoryGpuCardTypes(
      rows,
      gpuCardTypeOptions.map((card) => ({
        id: card.id,
        code: card.code,
        name: card.name,
      })),
    )
  }, [rows, gpuCardTypes, gpuCardTypeOptions])

  const gpuIssueByRow = useMemo(() => {
    const map = new Map<number, string>()
    for (const issue of gpuValidation?.issues ?? []) {
      map.set(
        issue.row_no,
        issue.reason === 'missing'
          ? '未填写显卡型号，请选择卡型'
          : `未识别「${issue.raw_value}」，请选择卡型`,
      )
    }
    return map
  }, [gpuValidation])

  const setRowGpuCardTypeId = (rowNo: number, gpuCardTypeId: string) => {
    setRows((prev) =>
      prev.map((row) => (row.row_no === rowNo ? { ...row, gpu_card_type_id: gpuCardTypeId } : row)),
    )
  }

  const getRowDisplayStatus = (row: DeviceInventoryParsedRow): 'ok' | 'warning' | 'error' => {
    if (row.parse_status === 'error') return 'error'
    if (gpuIssueByRow.has(row.row_no)) return 'warning'
    return row.parse_status
  }

  const warnCount = rows.filter((r) => getRowDisplayStatus(r) === 'warning').length
  const errorCount = rows.filter((r) => getRowDisplayStatus(r) === 'error').length
  const committableCount = rows.filter((r) => getRowDisplayStatus(r) !== 'error').length
  const pendingGpuSelectionCount = gpuValidation?.pendingSelectionCount ?? 0
  const canCommit =
    committableCount > 0 &&
    pendingGpuSelectionCount === 0 &&
    !gpuCardTypesLoading &&
    gpuCardTypes.length > 0
  const selectedDataCenterId = dataCenterId || defaultDataCenterId
  const canUpload =
    Boolean(selectedDataCenterId) || (lockDataCenter && Boolean(defaultDataCenterId))

  const commitImport = async () => {
    if (!selectedDataCenterId) {
      toast.error('请选择机房')
      return
    }
    if (committableCount === 0) {
      toast.error('没有可入库的有效行')
      return
    }
    if (pendingGpuSelectionCount > 0) {
      toast.error('仍有行未选择卡型，请在列表中补全后再入库')
      return
    }

    try {
      const result = await commitMutation.mutateAsync({
        supplierId,
        dataCenterId: selectedDataCenterId,
        fileName,
        rows,
      })
      toast.success(`已入库 ${result.committedCount} 台设备`)
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
                文件 {fileName} · 共 {rows.length} 行 · 可入库 {committableCount}
                {warnCount > 0 ? ` · 警告 ${warnCount}` : ''}
                {errorCount > 0 ? ` · 失败 ${errorCount}` : ''}
              </span>
            </div>
            {gpuCardTypesLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                加载卡型字典...
              </p>
            ) : null}
            {pendingGpuSelectionCount > 0 ? (
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-300">
                <div>
                  <p className="font-medium">仍有 {pendingGpuSelectionCount} 行待选择卡型</p>
                  <p className="mt-1 text-xs">
                    未填写显卡型号可能为 CPU 管控节点；未识别型号请在列表中手工选择卡型后再入库
                    {gpuValidation?.uniqueUnrecognized.length
                      ? `。未识别：${gpuValidation.uniqueUnrecognized.join('、')}`
                      : ''}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-yellow-500/40"
                  onClick={() =>
                    downloadUnrecognizedGpuCardTypesExcel(
                      gpuValidation?.issues ?? [],
                      `${fileName.replace(/\.[^.]+$/, '')}-待确认显卡型号.xlsx`,
                    )
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  下载待确认明细
                </Button>
              </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>行</TableHead>
                    <TableHead>设备ID</TableHead>
                    <TableHead>IP地址</TableHead>
                    <TableHead>显卡型号</TableHead>
                    <TableHead>匹配卡型</TableHead>
                    <TableHead>K8s集群</TableHead>
                    <TableHead>设备状态</TableHead>
                    <TableHead>设备用途</TableHead>
                    <TableHead>合作类型</TableHead>
                    <TableHead>设备配置</TableHead>
                    <TableHead>维修中</TableHead>
                    <TableHead>校验</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const displayStatus = getRowDisplayStatus(r)
                    const gpuIssue = gpuIssueByRow.get(r.row_no)
                    const resolution = gpuValidation?.rowResolutions.get(r.row_no)
                    const needsGpuSelection =
                      r.parse_status !== 'error' && !resolution && Boolean(gpuIssue)
                    const selectedGpuId = resolution?.gpuCardTypeId ?? r.gpu_card_type_id
                    return (
                      <TableRow key={r.row_no}>
                        <TableCell>{r.row_no}</TableCell>
                        <TableCell className="font-mono text-xs">{r.external_device_id ?? '—'}</TableCell>
                        <TableCell>{r.internal_ip ?? '—'}</TableCell>
                        <TableCell className="max-w-[120px] truncate text-xs" title={r.gpu_card_type_code}>
                          {r.gpu_card_type_code ?? '—'}
                        </TableCell>
                        <TableCell className="min-w-[180px]">
                          {r.parse_status === 'error' ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <Select
                              value={selectedGpuId || undefined}
                              onValueChange={(value) => setRowGpuCardTypeId(r.row_no, value)}
                            >
                              <SelectTrigger
                                className={
                                  needsGpuSelection
                                    ? 'h-8 border-yellow-500/50 text-xs'
                                    : 'h-8 text-xs'
                                }
                              >
                                <SelectValue placeholder="选择卡型" />
                              </SelectTrigger>
                              <SelectContent position="popper" className="z-[110] max-h-64">
                                {gpuCardTypeOptions.map((card) => (
                                  <SelectItem key={card.id} value={card.id}>
                                    {card.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {resolution ? (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {resolution.gpuCardTypeCode}（{gpuCardTypeMatchLabel(resolution.matchedBy)}）
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate text-xs" title={r.cluster_name}>
                          {r.cluster_name ?? '—'}
                        </TableCell>
                        <TableCell>{r.ops_status}</TableCell>
                        <TableCell className="max-w-[120px] truncate text-xs" title={r.device_purpose}>
                          {r.device_purpose ?? '—'}
                        </TableCell>
                        <TableCell>
                          {r.cooperation_type ? DEVICE_COOPERATION_TYPE_LABELS[r.cooperation_type] : '—'}
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate text-xs" title={r.device_spec}>
                          {r.device_spec ?? '—'}
                        </TableCell>
                        <TableCell>{r.in_maintenance ? '是' : '否'}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <ParseStatusBadge status={displayStatus} />
                            {gpuIssue ? (
                              <p className="max-w-[140px] text-xs text-yellow-600 dark:text-yellow-400">
                                {gpuIssue}
                              </p>
                            ) : r.parse_message ? (
                              <p className="max-w-[140px] text-xs text-muted-foreground">{r.parse_message}</p>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
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
                disabled={commitMutation.isPending || !canCommit}
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

export interface DeviceInventoryImportTriggerProps {
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

export function DeviceInventoryImportTrigger({
  supplierId,
  defaultDataCenterId,
  dataCenterName,
  lockDataCenter,
  onSuccess,
  children,
  className,
  variant = 'default',
  size = 'sm',
}: DeviceInventoryImportTriggerProps) {
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
      <DeviceInventoryImportDialog
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
