'use client'

import * as React from 'react'
import { Download, Loader2, Upload } from 'lucide-react'
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

import type { UserStaff } from '@/lib/types/crm'
import { trpc } from '@/lib/trpc/client'
import { fileToBase64 } from '@/lib/utils/file-to-base64'
import {
  SUPPLIER_IMPORT_ACCEPT,
  SUPPLIER_IMPORT_MAX_BYTES,
  isSupplierImportFileName,
  type SupplierImportCommitResult,
  type SupplierImportPreviewResult,
} from '@/lib/types/supplier-import'
import {
  buildSupplierImportErrorExportRows,
  downloadSupplierImportErrorExcel,
} from '@/lib/supplier/supplier-import-error-export'

type Step = 'upload' | 'preview' | 'done'
type Phase = 'idle' | 'parsing' | 'committing'

const ONBOARDING_LABEL = { enterprise: '企业', individual: '个人' } as const

const ACTION_LABEL = { create: '新建', update: '更新', skip: '跳过' } as const

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

export function SupplierImportDialog({
  open,
  onOpenChange,
  activeStaff,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeStaff: UserStaff[]
  onSuccess: () => void
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [step, setStep] = React.useState<Step>('upload')
  const [phase, setPhase] = React.useState<Phase>('idle')
  const [file, setFile] = React.useState<File | null>(null)
  const [businessManagerStaffId, setBusinessManagerStaffId] = React.useState('')
  const [preview, setPreview] = React.useState<SupplierImportPreviewResult | null>(null)
  const [commitResult, setCommitResult] = React.useState<SupplierImportCommitResult | null>(null)
  const [parseError, setParseError] = React.useState<string | null>(null)

  const previewMutation = trpc.supplier.import.preview.useMutation()
  const commitMutation = trpc.supplier.import.commit.useMutation()

  const loading =
    phase === 'parsing' ||
    phase === 'committing' ||
    previewMutation.isPending ||
    commitMutation.isPending

  const reset = React.useCallback(() => {
    setStep('upload')
    setPhase('idle')
    setFile(null)
    setPreview(null)
    setCommitResult(null)
    setParseError(null)
    setBusinessManagerStaffId('')
    if (inputRef.current) inputRef.current.value = ''
  }, [])

  React.useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  const importableCount = React.useMemo(
    () => preview?.rows.filter((r) => r.selectable).length ?? 0,
    [preview],
  )

  const onFileChange = (next: File | null) => {
    setParseError(null)
    if (!next) {
      setFile(null)
      return
    }
    const name = next.name.toLowerCase()
    if (!isSupplierImportFileName(name)) {
      setFile(null)
      setParseError('仅支持 .xlsx / .xls / .csv / .tsv 文件')
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    if (next.size > SUPPLIER_IMPORT_MAX_BYTES) {
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
    if (!businessManagerStaffId) {
      toast.error('请选择默认商务经理')
      return
    }

    setPhase('parsing')
    setParseError(null)
    try {
      const fileBase64 = await fileToBase64(file)
      const result = await previewMutation.mutateAsync({
        fileName: file.name,
        fileBase64,
        defaultBusinessManagerStaffId: businessManagerStaffId,
      })
      setPreview(result as SupplierImportPreviewResult)
      setStep('preview')

      const { summary } = result
      if (summary.error > 0) {
        toast.warning(
          `解析完成：${summary.create + summary.update} 行可导入，${summary.error} 行将跳过`,
        )
      } else if (summary.warn > 0) {
        toast.message(`解析完成：${summary.total} 行，${summary.warn} 行含告警`)
      } else {
        toast.success(`解析完成：共 ${summary.total} 行`)
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : '解析失败，请检查文件格式与表头'
      setParseError(message)
      toast.error(message)
    } finally {
      setPhase('idle')
    }
  }

  const onCommit = async () => {
    if (!preview || !file || !businessManagerStaffId) return
    if (importableCount === 0) {
      toast.error('没有可导入的行')
      return
    }

    setPhase('committing')
    try {
      const fileBase64 = await fileToBase64(file)
      const result = await commitMutation.mutateAsync({
        fileName: file.name,
        fileBase64,
        defaultBusinessManagerStaffId: businessManagerStaffId,
      })
      setCommitResult(result)
      setStep('done')
      onSuccess()

      if (result.errors.length > 0 || result.skipped > 0) {
        toast.warning(
          `导入完成：新建 ${result.created}，更新 ${result.updated}，跳过 ${result.skipped} 行错误`,
        )
      } else {
        toast.success(`导入完成：新建 ${result.created}，更新 ${result.updated}`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导入失败，请稍后重试')
    } finally {
      setPhase('idle')
    }
  }

  const onDownloadErrors = () => {
    if (!preview || preview.summary.error === 0) return
    try {
      const errorRows = buildSupplierImportErrorExportRows(preview)
      downloadSupplierImportErrorExcel({
        originalHeaders: preview.originalHeaders,
        errorRows,
        sourceFileName: preview.fileName,
      })
      toast.success(`已下载 ${errorRows.length} 行错误数据`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '下载失败')
    }
  }

  const handleClose = (next: boolean) => {
    onOpenChange(next)
  }

  const previewSummary = preview
    ? `共 ${preview.summary.total} 行，可导入 ${importableCount} 行（新建 ${preview.summary.create}，更新 ${preview.summary.update}），错误 ${preview.summary.error} 行`
    : null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="grid max-h-[90vh] grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden sm:max-w-4xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {step === 'upload' && '导入供应商信息'}
            {step === 'preview' && '确认导入'}
            {step === 'done' && '导入完成'}
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' &&
              '上传入驻系统导出的 Excel 或 CSV（25 列表头）。新建行将使用所选商务经理；已存在记录不修改商务经理。'}
            {step === 'preview' && (previewSummary ?? '核对解析结果后确认导入。可仅导入校验通过的行。')}
            {step === 'done' && '导入结果如下，关闭后列表已刷新。'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto overscroll-contain pr-1">
          {step === 'upload' && (
            <div className="space-y-4 px-1">
              <div className="space-y-2">
                <Label htmlFor="supplier-import-manager">默认商务经理 *</Label>
                <Select value={businessManagerStaffId} onValueChange={setBusinessManagerStaffId}>
                  <SelectTrigger id="supplier-import-manager">
                    <SelectValue placeholder="请选择商务经理" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeStaff.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  仅对本次「新建」的供应商生效；已存在记录保留原商务经理。
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplier-import-file">供应商文件</Label>
                <Input
                  id="supplier-import-file"
                  ref={inputRef}
                  type="file"
                  accept={SUPPLIER_IMPORT_ACCEPT}
                  disabled={loading}
                  onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
                />
                {file ? (
                  <p className="text-muted-foreground text-sm">
                    已选择：{file.name}（{(file.size / 1024).toFixed(1)} KB）
                  </p>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    支持 .xlsx / .xls / .csv / .tsv；表头需包含「ID」「入驻类型」「企业全称/真实姓名」等列；UTF-8 编码，最大 10MB
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
              {preview.summary.error > 0 && (
                <Alert variant="destructive">
                  <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      有 {preview.summary.error} 行存在错误将跳过；仍可导入其余 {importableCount}{' '}
                      行
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0 border-destructive/40 bg-background"
                      onClick={onDownloadErrors}
                    >
                      <Download className="mr-2 size-4" />
                      下载错误行 Excel
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">行</TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead className="w-16">类型</TableHead>
                      <TableHead className="w-28">证件号</TableHead>
                      <TableHead className="w-16">动作</TableHead>
                      <TableHead className="w-32">商务经理</TableHead>
                      <TableHead className="w-16">校验</TableHead>
                      <TableHead className="min-w-[120px]">说明</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map((row) => (
                      <TableRow
                        key={row.row_no}
                        className={
                          row.parse_status === 'error'
                            ? 'bg-destructive/5'
                            : row.parse_status === 'warning'
                              ? 'bg-amber-500/5'
                              : undefined
                        }
                      >
                        <TableCell>{row.row_no}</TableCell>
                        <TableCell className="max-w-[160px] truncate font-medium">
                          {row.name ?? '—'}
                        </TableCell>
                        <TableCell>
                          {row.onboarding_type
                            ? ONBOARDING_LABEL[row.onboarding_type]
                            : '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {row.identity_no ?? '—'}
                        </TableCell>
                        <TableCell>{ACTION_LABEL[row.action]}</TableCell>
                        <TableCell className="text-xs">
                          {row.business_manager_note === 'will_set'
                            ? `→ ${row.business_manager_label ?? '—'}`
                            : '保留原值'}
                        </TableCell>
                        <TableCell>
                          <ParseBadge status={row.parse_status} />
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.parse_status === 'error' ? (
                            <span className="text-destructive">{row.parse_message ?? '—'}</span>
                          ) : (
                            <span className="text-muted-foreground">{row.parse_message ?? '—'}</span>
                          )}
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
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <Stat label="新建" value={commitResult.created} />
                <Stat label="更新" value={commitResult.updated} />
                <Stat label="跳过" value={commitResult.skipped} />
                <Stat label="失败" value={commitResult.failed} />
              </div>
              {preview && preview.summary.error > 0 && (
                <Button type="button" size="sm" variant="outline" onClick={onDownloadErrors}>
                  <Download className="mr-2 size-4" />
                  下载错误行 Excel
                </Button>
              )}
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
              <Button
                type="button"
                disabled={!file || !businessManagerStaffId || loading}
                onClick={() => void onParsePreview()}
              >
                {phase === 'parsing' ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
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
                disabled={loading || importableCount === 0}
                onClick={() => void onCommit()}
              >
                {phase === 'committing' ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                确认导入{importableCount > 0 ? `（${importableCount} 行）` : ''}
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

export function SupplierImportTrigger({
  activeStaff,
  onSuccess,
}: {
  activeStaff: UserStaff[]
  onSuccess: () => void
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <Button className="gap-2" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" />
        导入供应商
      </Button>
      <SupplierImportDialog
        open={open}
        onOpenChange={setOpen}
        activeStaff={activeStaff}
        onSuccess={onSuccess}
      />
    </>
  )
}
