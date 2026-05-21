'use client'

import * as React from 'react'
import {
  AlertTriangle,
  Building2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
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
import { Textarea } from '@workspace/ui/components/textarea'
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
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'

import { trpc } from '@/lib/trpc/client'
import { fileToBase64 } from '@/lib/utils/file-to-base64'
import { downloadDeviceRetireErrorExcel } from '@/lib/supplier/device-retire-error-export'
import {
  DEVICE_RETIRE_ACCEPT,
  DEVICE_RETIRE_MAX_BYTES,
  DEVICE_RETIRE_REASON_OPTIONS,
  isDeviceRetireFileName,
  type DeviceRetireBatchPreview,
  type DeviceRetireCommitResult,
  type DeviceRetirePreviewResult,
  type DeviceRetireReason,
} from '@/lib/types/device-retire'
import {
  DEVICE_RETIRE_SAMPLE_BJ_CSV,
  DEVICE_RETIRE_SAMPLE_SH_CSV,
  downloadDeviceRetireSampleCsv,
} from '@/lib/data/device-retire-sample'

type Step = 'upload' | 'preview' | 'done'

type DcUploadState = {
  file: File | null
  fileName: string
}

function ParseBadge({ status }: { status: 'ok' | 'warning' | 'error' }) {
  if (status === 'ok') {
    return (
      <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
        通过
      </Badge>
    )
  }
  if (status === 'warning') {
    return (
      <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
        告警
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">
      错误
    </Badge>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3 text-center">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  )
}

function BatchPreviewTable({ batch }: { batch: DeviceRetireBatchPreview }) {
  return (
    <div className="rounded-md border overflow-auto max-h-64">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-14">行号</TableHead>
            <TableHead>设备ID</TableHead>
            <TableHead>设备标识</TableHead>
            <TableHead>外网IP</TableHead>
            <TableHead>内网IP</TableHead>
            <TableHead>校验</TableHead>
            <TableHead>说明</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batch.rows.map((row) => (
            <TableRow key={row.row_no}>
              <TableCell className="text-muted-foreground">{row.row_no}</TableCell>
              <TableCell>{row.external_device_id ?? '—'}</TableCell>
              <TableCell>{row.asset_no ?? '—'}</TableCell>
              <TableCell>{row.external_ip ?? '—'}</TableCell>
              <TableCell>{row.internal_ip ?? '—'}</TableCell>
              <TableCell>
                <ParseBadge status={row.parse_status} />
              </TableCell>
              <TableCell className="text-sm max-w-xs">
                {row.errors.length > 0 && (
                  <span className="text-red-400">{row.errors.join('；')}</span>
                )}
                {row.errors.length === 0 && row.warnings.length > 0 && (
                  <span className="text-yellow-400">{row.warnings.join('；')}</span>
                )}
                {row.errors.length === 0 && row.warnings.length === 0 && (
                  <span className="text-muted-foreground">可下架</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function MetaSummary({ meta }: { meta: DeviceRetirePreviewResult['meta'] }) {
  return (
    <div className="rounded-lg border p-4 grid grid-cols-3 gap-4 text-sm bg-muted/20">
      <div>
        <p className="text-muted-foreground text-xs mb-1">下架原因</p>
        <p className="font-medium">{meta.reasonLabel}</p>
      </div>
      <div>
        <p className="text-muted-foreground text-xs mb-1">期望完成日期</p>
        <p className="font-medium">{meta.expectedCompletionDate}</p>
      </div>
      <div>
        <p className="text-muted-foreground text-xs mb-1">备注</p>
        <p className="font-medium">{meta.remark || '—'}</p>
      </div>
    </div>
  )
}

export function SupplierDeviceRetireDialog({
  open,
  onOpenChange,
  supplierId,
  supplierName,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplierId: string
  supplierName: string
  onSuccess?: () => void
}) {
  const utils = trpc.useUtils()
  const previewMutation = trpc.supplier.deviceRetire.preview.useMutation()
  const commitMutation = trpc.supplier.deviceRetire.commit.useMutation()

  const { data: dataCenters = [], isLoading: dcLoading } = trpc.supplier.listDataCenters.useQuery(
    { supplierId },
    { enabled: open && Boolean(supplierId) },
  )
  const { data: physicalDevices = [] } = trpc.supplier.listPhysicalDevices.useQuery(
    { supplierId },
    { enabled: open && Boolean(supplierId) },
  )

  const deviceCountByDc = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const d of physicalDevices) {
      if (!d.dataCenterId) continue
      map.set(d.dataCenterId, (map.get(d.dataCenterId) ?? 0) + 1)
    }
    return map
  }, [physicalDevices])

  const inputRefs = React.useRef<Record<string, HTMLInputElement | null>>({})
  const [step, setStep] = React.useState<Step>('upload')
  const [parsing, setParsing] = React.useState(false)
  const [committing, setCommitting] = React.useState(false)
  const [parseError, setParseError] = React.useState<string | null>(null)
  const [preview, setPreview] = React.useState<DeviceRetirePreviewResult | null>(null)
  const [commitResult, setCommitResult] = React.useState<DeviceRetireCommitResult | null>(null)
  const [uploads, setUploads] = React.useState<Record<string, DcUploadState>>({})
  const [activeBatchTab, setActiveBatchTab] = React.useState<string>('')
  const [retireReason, setRetireReason] = React.useState<DeviceRetireReason | ''>('')
  const [expectedCompletionDate, setExpectedCompletionDate] = React.useState('')
  const [remark, setRemark] = React.useState('')

  const todayStr = React.useMemo(() => new Date().toISOString().slice(0, 10), [])

  const reset = React.useCallback(() => {
    setStep('upload')
    setParsing(false)
    setCommitting(false)
    setParseError(null)
    setPreview(null)
    setCommitResult(null)
    setUploads({})
    setActiveBatchTab('')
    setRetireReason('')
    setExpectedCompletionDate('')
    setRemark('')
    for (const ref of Object.values(inputRefs.current)) {
      if (ref) ref.value = ''
    }
  }, [])

  const prevOpenRef = React.useRef(open)

  React.useEffect(() => {
    if (prevOpenRef.current && !open) {
      reset()
    }
    prevOpenRef.current = open
  }, [open, reset])

  const uploadedCount = Object.values(uploads).filter((u) => u.file).length

  const buildRequestPayload = React.useCallback(async () => {
    if (!retireReason) throw new Error('请选择下架原因')
    const entries = Object.entries(uploads).filter(([, v]) => v.file) as [string, DcUploadState][]
    const files = await Promise.all(
      entries.map(async ([dataCenterId, { file, fileName }]) => ({
        dataCenterId,
        fileName,
        fileBase64: await fileToBase64(file!),
      })),
    )
    return {
      supplierId,
      meta: {
        reason: retireReason,
        expectedCompletionDate,
        remark: remark.trim() || undefined,
      },
      files,
    }
  }, [expectedCompletionDate, remark, retireReason, supplierId, uploads])

  const onFileChange = (dataCenterId: string, file: File | null) => {
    setParseError(null)
    if (!file) {
      setUploads((prev) => {
        const next = { ...prev }
        delete next[dataCenterId]
        return next
      })
      return
    }
    if (!isDeviceRetireFileName(file.name)) {
      toast.error('仅支持 .xlsx / .xls / .csv / .tsv 文件')
      const ref = inputRefs.current[dataCenterId]
      if (ref) ref.value = ''
      return
    }
    if (file.size > DEVICE_RETIRE_MAX_BYTES) {
      toast.error('文件不能超过 10MB')
      const ref = inputRefs.current[dataCenterId]
      if (ref) ref.value = ''
      return
    }
    setUploads((prev) => ({
      ...prev,
      [dataCenterId]: { file, fileName: file.name },
    }))
  }

  const clearUpload = (dataCenterId: string) => {
    setUploads((prev) => {
      const next = { ...prev }
      delete next[dataCenterId]
      return next
    })
    const ref = inputRefs.current[dataCenterId]
    if (ref) ref.value = ''
  }

  const onParsePreview = async () => {
    if (!retireReason) {
      toast.error('请选择下架原因')
      return
    }
    if (!expectedCompletionDate) {
      toast.error('请选择期望完成日期')
      return
    }
    if (expectedCompletionDate < todayStr) {
      toast.error('期望完成日期不能早于今天')
      return
    }

    const entries = Object.entries(uploads).filter(([, v]) => v.file)
    if (entries.length === 0) {
      toast.error('请至少为一个机房上传下架清单')
      return
    }

    setParsing(true)
    setParseError(null)
    try {
      const payload = await buildRequestPayload()
      const result = await previewMutation.mutateAsync(payload)
      setPreview(result)
      setActiveBatchTab(result.batches[0]?.dataCenterId ?? '')
      setStep('preview')

      if (result.summary.error > 0) {
        toast.warning(
          `解析完成：${result.summary.ok + result.summary.warning} 台可下架，${result.summary.error} 行有误`,
        )
      } else if (result.summary.warning > 0) {
        toast.message(`解析完成：${result.summary.total} 行，${result.summary.warning} 行含告警`)
      } else {
        toast.success(`解析完成：共 ${result.summary.total} 台设备可下架`)
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : '解析失败，请检查文件格式与表头'
      setParseError(message)
      toast.error(message)
    } finally {
      setParsing(false)
    }
  }

  const onCommit = async () => {
    if (!preview) return
    const okCount = preview.summary.ok + preview.summary.warning
    if (okCount === 0) {
      toast.error('没有通过校验的设备可下架')
      return
    }

    setCommitting(true)
    try {
      const payload = await buildRequestPayload()
      const result = await commitMutation.mutateAsync(payload)
      setCommitResult(result)
      setStep('done')
      onSuccess?.()
      void utils.supplier.listPhysicalDevices.invalidate({ supplierId })
      void utils.supplier.getPhysicalDeviceStats.invalidate({ supplierId })
      void utils.supplier.listGpuInventory.invalidate({ supplierId })
      void utils.supplier.deviceRetire.getContext.invalidate({ supplierId })
      toast.success(`已提交 ${result.retiredCount} 台设备下架`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '提交失败')
    } finally {
      setCommitting(false)
    }
  }

  const onDownloadErrors = (batch: DeviceRetireBatchPreview) => {
    if (batch.summary.error === 0) {
      toast.message('该批次无错误行')
      return
    }
    try {
      downloadDeviceRetireErrorExcel({ batch })
      toast.success(`已下载 ${batch.summary.error} 行错误数据`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '下载失败')
    }
  }

  const onDownloadSample = (dataCenterId: string) => {
    const dc = dataCenters.find((d) => d.id === dataCenterId)
    const isSh = dc?.name.includes('上海')
    downloadDeviceRetireSampleCsv(
      isSh ? '下架清单-样例-上海.csv' : '下架清单-样例-北京.csv',
      isSh ? DEVICE_RETIRE_SAMPLE_SH_CSV : DEVICE_RETIRE_SAMPLE_BJ_CSV,
    )
    toast.success('已下载样例文件')
  }

  const okCount = preview ? preview.summary.ok + preview.summary.warning : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[90vh] grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden sm:max-w-4xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {step === 'upload' && '设备下架'}
            {step === 'preview' && '确认下架清单'}
            {step === 'done' && '下架提交完成'}
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' &&
              `为 ${supplierName} 各机房分别上传下架设备 Excel，每个机房一个文件即一个批次。系统将校验设备是否存在于对应机房。`}
            {step === 'preview' &&
              preview &&
              `共 ${preview.summary.batchCount} 个批次、${preview.summary.total} 行；可下架 ${okCount} 行，错误 ${preview.summary.error} 行`}
            {step === 'done' &&
              commitResult &&
              `已生成 ${commitResult.batchCodes.length} 个下架批次，实际下架 ${commitResult.retiredCount} 台设备`}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto space-y-4 pr-1">
          {step === 'upload' && (
            <>
              <div className="rounded-lg border p-4 space-y-4 bg-muted/20">
                <p className="text-sm font-medium text-foreground">下架信息</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>
                      下架原因 <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={retireReason}
                      onValueChange={(v) => setRetireReason(v as DeviceRetireReason)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="请选择下架原因" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEVICE_RETIRE_REASON_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="retire-expected-date">
                      期望完成日期 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="retire-expected-date"
                      type="date"
                      min={todayStr}
                      value={expectedCompletionDate}
                      onChange={(e) => setExpectedCompletionDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="retire-remark">备注</Label>
                  <Textarea
                    id="retire-remark"
                    placeholder="补充说明下架背景、协调事项等（选填）"
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                </div>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Excel 表头需包含「设备ID」「设备标识」「外网IP」「内网IP」；外网IP与内网IP不能同时为空。每个机房上传一个文件作为一个批次。
                </AlertDescription>
              </Alert>

              {dcLoading ? (
                <div className="rounded-md border p-8 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  加载机房列表...
                </div>
              ) : dataCenters.length === 0 ? (
                <div className="rounded-md border p-8 text-center text-muted-foreground text-sm">
                  该供应商暂无机房数据
                </div>
              ) : (
                <div className="space-y-3">
                  {dataCenters.map((dc) => {
                    const upload = uploads[dc.id]
                    return (
                      <div
                        key={dc.id}
                        className="rounded-lg border p-4 space-y-3 bg-muted/20"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Building2 className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{dc.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {dc.location} · {dc.code}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                当前设备 {deviceCountByDc.get(dc.id) ?? 0} 台
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="shrink-0"
                            onClick={() => onDownloadSample(dc.id)}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            样例
                          </Button>
                        </div>

                        <div className="flex items-center gap-2">
                          <Input
                            ref={(el) => {
                              inputRefs.current[dc.id] = el
                            }}
                            type="file"
                            accept={DEVICE_RETIRE_ACCEPT}
                            className="hidden"
                            onChange={(e) =>
                              onFileChange(dc.id, e.target.files?.[0] ?? null)
                            }
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => inputRefs.current[dc.id]?.click()}
                          >
                            <Upload className="w-4 h-4 mr-1" />
                            选择 Excel
                          </Button>
                          {upload?.file && (
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <FileSpreadsheet className="w-4 h-4 text-green-500 shrink-0" />
                              <span className="text-sm truncate">{upload.fileName}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                onClick={() => clearUpload(dc.id)}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                          {!upload?.file && (
                            <span className="text-xs text-muted-foreground">
                              支持 .xlsx / .xls / .csv，最大 10MB
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {parseError && (
                <Alert variant="destructive">
                  <AlertDescription>{parseError}</AlertDescription>
                </Alert>
              )}
            </>
          )}

          {step === 'preview' && preview && (
            <>
              <MetaSummary meta={preview.meta} />

              <div className="grid grid-cols-4 gap-3">
                <Stat label="总行数" value={preview.summary.total} />
                <Stat label="可下架" value={preview.summary.ok + preview.summary.warning} />
                <Stat label="告警" value={preview.summary.warning} />
                <Stat label="错误" value={preview.summary.error} />
              </div>

              <Tabs value={activeBatchTab} onValueChange={setActiveBatchTab}>
                <TabsList className="flex-wrap h-auto">
                  {preview.batches.map((batch) => (
                    <TabsTrigger key={batch.dataCenterId} value={batch.dataCenterId}>
                      {batch.dataCenterName}
                      {batch.summary.error > 0 && (
                        <Badge variant="destructive" className="ml-2 h-5 px-1.5">
                          {batch.summary.error}
                        </Badge>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {preview.batches.map((batch) => (
                  <TabsContent
                    key={batch.dataCenterId}
                    value={batch.dataCenterId}
                    className="space-y-3"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        文件：{batch.fileName} · 通过 {batch.summary.ok + batch.summary.warning} /{' '}
                        {batch.summary.total}
                      </span>
                      {batch.summary.error > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onDownloadErrors(batch)}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          下载错误行
                        </Button>
                      )}
                    </div>
                    <BatchPreviewTable batch={batch} />
                  </TabsContent>
                ))}
              </Tabs>
            </>
          )}

          {step === 'done' && commitResult && (
            <div className="space-y-4">
              <MetaSummary meta={commitResult.meta} />

              <div className="grid grid-cols-3 gap-3">
                <Stat label="下架设备" value={commitResult.retiredCount} />
                <Stat label="跳过错误" value={commitResult.skippedCount} />
                <Stat label="批次数量" value={commitResult.batchCodes.length} />
              </div>
              <div className="rounded-md border p-4 space-y-2">
                <Label className="text-muted-foreground">批次编号</Label>
                <ul className="text-sm space-y-1">
                  {commitResult.batchCodes.map((code) => (
                    <li key={code} className="font-mono text-foreground">
                      {code}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 sm:gap-0">
          {step === 'upload' && (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button
                type="button"
                disabled={
                  parsing ||
                  previewMutation.isPending ||
                  uploadedCount === 0 ||
                  dataCenters.length === 0 ||
                  !retireReason ||
                  !expectedCompletionDate
                }
                onClick={() => void onParsePreview()}
              >
                {parsing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                解析并校验
              </Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button type="button" variant="outline" onClick={() => setStep('upload')}>
                返回修改
              </Button>
              <Button
                type="button"
                disabled={committing || commitMutation.isPending || okCount === 0}
                onClick={() => void onCommit()}
              >
                {committing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                确认下架 ({okCount})
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button type="button" onClick={() => onOpenChange(false)}>
              完成
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
