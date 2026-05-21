'use client'

import * as React from 'react'
import { Loader2, Upload } from 'lucide-react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'

import type { DataCenter, Supplier } from '@/lib/data/types'
import {
  DATACENTER_IMPORT_ACCEPT,
  DATACENTER_IMPORT_MAX_BYTES,
  isDatacenterImportFileName,
  type DatacenterImportCommitResult,
  type DatacenterImportPreviewResult,
} from '@/lib/types/datacenter-import'
import {
  commitDatacenterImportMock,
  previewDatacenterImportFromFile,
} from '@/lib/supplier/datacenter-import-utils'

type Step = 'upload' | 'preview' | 'done'
type Phase = 'idle' | 'parsing' | 'committing'

const ACTION_LABEL = {
  create: '新建',
  skip: '跳过',
  error: '错误',
} as const

const SKIP_REASON_LABEL = {
  already_exists: '已存在',
  source_deleted: '源已删',
  empty_name: '无名称',
  code_collision: '编码冲突',
} as const

function ParseBadge({ status }: { status: 'ok' | 'warning' | 'error' }) {
  if (status === 'ok') return <Badge variant="outline">通过</Badge>
  if (status === 'warning') return <Badge className="bg-amber-500/15 text-amber-700">告警</Badge>
  return <Badge variant="destructive">错误</Badge>
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3 text-center">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  )
}

export function SupplierDatacenterImportDialog({
  open,
  onOpenChange,
  supplier,
  existingDataCenters,
  onImported,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplier: Supplier
  existingDataCenters: DataCenter[]
  onImported: (dataCenters: DataCenter[]) => void
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [step, setStep] = React.useState<Step>('upload')
  const [phase, setPhase] = React.useState<Phase>('idle')
  const [file, setFile] = React.useState<File | null>(null)
  const [preview, setPreview] = React.useState<DatacenterImportPreviewResult | null>(null)
  const [commitResult, setCommitResult] = React.useState<DatacenterImportCommitResult | null>(null)
  const [parseError, setParseError] = React.useState<string | null>(null)

  const loading = phase === 'parsing' || phase === 'committing'

  const reset = React.useCallback(() => {
    setStep('upload')
    setPhase('idle')
    setFile(null)
    setPreview(null)
    setCommitResult(null)
    setParseError(null)
    if (inputRef.current) inputRef.current.value = ''
  }, [])

  React.useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  const createCount = React.useMemo(
    () =>
      preview?.rows.filter((r) => r.action === 'create' && r.parse_status !== 'error').length ?? 0,
    [preview],
  )

  const onFileChange = (next: File | null) => {
    setParseError(null)
    if (!next) {
      setFile(null)
      return
    }
    if (!isDatacenterImportFileName(next.name)) {
      setFile(null)
      setParseError('仅支持 .xlsx / .xls / .csv / .tsv 文件')
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    if (next.size > DATACENTER_IMPORT_MAX_BYTES) {
      setFile(null)
      setParseError('文件不能超过 10MB')
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    setFile(next)
  }

  const onParsePreview = async () => {
    if (!file) {
      toast.error('请选择 Excel 或 CSV 文件')
      return
    }

    setPhase('parsing')
    setParseError(null)
    try {
      const result = await previewDatacenterImportFromFile(file, supplier, existingDataCenters)
      setPreview(result)
      setStep('preview')

      const { summary } = result
      if (summary.error > 0) {
        toast.warning(`解析完成：${summary.create} 行可新建，${summary.skip} 行跳过，${summary.error} 行有误`)
      } else if (summary.warn > 0) {
        toast.message(`解析完成：${summary.total} 行，${summary.warn} 行含告警`)
      } else {
        toast.success(`解析完成：共 ${summary.total} 行`)
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : '解析失败'
      setParseError(message)
      toast.error(message)
    } finally {
      setPhase('idle')
    }
  }

  const onCommit = async () => {
    if (!preview || !file) return
    if (createCount === 0) {
      toast.error('没有可导入的新增行')
      return
    }

    setPhase('committing')
    try {
      const freshPreview = await previewDatacenterImportFromFile(
        file,
        supplier,
        existingDataCenters,
      )
      const { dataCenters, result } = commitDatacenterImportMock(
        freshPreview,
        supplier,
        existingDataCenters,
      )
      setCommitResult(result)
      setStep('done')
      onImported(dataCenters.filter((dc) => dc.supplierId === supplier.id))

      if (result.errors.length > 0) {
        toast.warning(
          `导入完成：新建 ${result.created}，跳过 ${result.skipped}，${result.failed} 条失败`,
        )
      } else {
        toast.success(`导入完成：新建 ${result.created}，跳过 ${result.skipped}`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导入失败')
    } finally {
      setPhase('idle')
    }
  }

  const handleClose = (next: boolean) => {
    onOpenChange(next)
  }

  const previewSummary = preview
    ? `共 ${preview.summary.total} 行，可新建 ${createCount} 行，跳过 ${preview.summary.skip} 行，错误 ${preview.summary.error} 行`
    : null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="grid max-h-[90vh] grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden sm:max-w-4xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {step === 'upload' && '导入机房信息'}
            {step === 'preview' && '确认导入'}
            {step === 'done' && '导入完成'}
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' &&
              `供应商：${supplier.name}。已存在的机房不会修改，仅导入新增数据。源系统 ID（external_onboarding_id）可空，缺失或重复均不报错。`}
            {step === 'preview' && (previewSummary ?? '核对解析结果后确认导入。')}
            {step === 'done' && '导入结果如下，关闭后机房列表已刷新。'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto overscroll-contain pr-1">
          {step === 'upload' && (
            <div className="space-y-4 px-1">
              <Alert>
                <AlertDescription>
                  表头需包含：ID、租户ID、名称、容器实例区域、裸金属区域、描述、规模、公网IP数量、内网网段、审核状态、审核备注、是否删除、创建时间、最后更新时间。
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="datacenter-import-file">机房文件</Label>
                <Input
                  id="datacenter-import-file"
                  ref={inputRef}
                  type="file"
                  accept={DATACENTER_IMPORT_ACCEPT}
                  disabled={loading}
                  onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
                />
                {file ? (
                  <p className="text-muted-foreground text-sm">
                    已选择：{file.name}（{(file.size / 1024).toFixed(1)} KB）
                  </p>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    支持 .xlsx / .xls / .csv / .tsv；UTF-8 编码，最大 10MB，单次 ≤ 500 行
                  </p>
                )}
              </div>

              {parseError ? (
                <Alert variant="destructive">
                  <AlertDescription>{parseError}</AlertDescription>
                </Alert>
              ) : null}
            </div>
          )}

          {step === 'preview' && preview && (
            <div className="space-y-4 px-1">
              <div className="grid grid-cols-3 gap-2">
                <Stat label="新建" value={preview.summary.create} />
                <Stat label="跳过" value={preview.summary.skip} />
                <Stat label="错误" value={preview.summary.error} />
              </div>

              {preview.summary.error > 0 && (
                <Alert variant="destructive">
                  <AlertDescription>
                    有 {preview.summary.error} 行存在错误，将无法导入
                  </AlertDescription>
                </Alert>
              )}

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">行</TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead className="w-20">源 ID</TableHead>
                      <TableHead className="w-16">动作</TableHead>
                      <TableHead className="w-28">code</TableHead>
                      <TableHead className="w-16">校验</TableHead>
                      <TableHead className="min-w-[120px]">说明</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map((row) => (
                      <TableRow key={row.row_no}>
                        <TableCell>{row.row_no}</TableCell>
                        <TableCell className="max-w-[160px] truncate font-medium">
                          {row.name ?? '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {row.external_onboarding_id ?? '—'}
                        </TableCell>
                        <TableCell>
                          {row.action === 'skip' && row.skip_reason
                            ? SKIP_REASON_LABEL[row.skip_reason]
                            : ACTION_LABEL[row.action]}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.derived_code ?? '—'}
                        </TableCell>
                        <TableCell>
                          <ParseBadge status={row.parse_status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {row.parse_message ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {step === 'done' && commitResult && (
            <div className="space-y-4 px-1">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <Stat label="新建" value={commitResult.created} />
                <Stat label="跳过" value={commitResult.skipped} />
                <Stat label="失败" value={commitResult.failed} />
              </div>
              {commitResult.errors.length > 0 && (
                <div className="max-h-40 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">行</TableHead>
                        <TableHead>原因</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commitResult.errors.map((err) => (
                        <TableRow key={`${err.row_no}-${err.message}`}>
                          <TableCell>{err.row_no}</TableCell>
                          <TableCell className="text-destructive text-xs">{err.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 sm:gap-0">
          {step === 'upload' && (
            <>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                取消
              </Button>
              <Button type="button" disabled={!file || loading} onClick={() => void onParsePreview()}>
                {phase === 'parsing' ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                解析并预览
              </Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button type="button" variant="outline" disabled={loading} onClick={() => setStep('upload')}>
                上一步
              </Button>
              <Button
                type="button"
                disabled={loading || createCount === 0}
                onClick={() => void onCommit()}
              >
                {phase === 'committing' ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                确认导入 {createCount} 条
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button type="button" onClick={() => handleClose(false)}>
              关闭
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function SupplierDatacenterImportTrigger({
  supplier,
  existingDataCenters,
  onImported,
}: {
  supplier: Supplier
  existingDataCenters: DataCenter[]
  onImported: (dataCenters: DataCenter[]) => void
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <Button className="gap-2" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4 mr-2" />
        导入机房
      </Button>
      <SupplierDatacenterImportDialog
        open={open}
        onOpenChange={setOpen}
        supplier={supplier}
        existingDataCenters={existingDataCenters}
        onImported={onImported}
      />
    </>
  )
}
