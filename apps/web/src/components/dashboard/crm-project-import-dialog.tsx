"use client"

import * as React from "react"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Badge } from "@workspace/ui/components/badge"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { IconAlertTriangle, IconDownload, IconLoader2, IconUpload } from "@tabler/icons-react"
import { toast } from "sonner"

import {
  buildProjectImportErrorExportRows,
  downloadProjectImportErrorExcel,
} from "@/lib/crm/project-import-error-export"
import { PROJECT_IMPORT_MAX_BYTES } from "@/lib/crm/project-import-utils"
import type {
  ProjectImportCommitResult,
  ProjectImportPreviewResult,
  ProjectImportPreviewRow,
} from "@/lib/types/project-import"

type Step = "upload" | "preview" | "done"

type LoadPhase = "idle" | "parsing" | "committing"

const CUSTOMER_STRATEGY_LABEL: Record<ProjectImportPreviewRow["customerStrategy"], string> = {
  link_tenant: "关联租户",
  create_customer: "新建客户+租户",
  existing_customer: "已有客户",
}

const ACTION_LABEL: Record<ProjectImportPreviewRow["action"], string> = {
  create: "新建",
  update: "更新",
  skip: "跳过",
}

export function CrmProjectImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [step, setStep] = React.useState<Step>("upload")
  const [phase, setPhase] = React.useState<LoadPhase>("idle")
  const [file, setFile] = React.useState<File | null>(null)
  const [preview, setPreview] = React.useState<ProjectImportPreviewResult | null>(null)
  const [commitResult, setCommitResult] = React.useState<ProjectImportCommitResult | null>(null)
  const [allowCreateStaff, setAllowCreateStaff] = React.useState(true)
  const [parseError, setParseError] = React.useState<string | null>(null)

  const loading = phase === "parsing" || phase === "committing"

  const reset = React.useCallback(() => {
    setStep("upload")
    setPhase("idle")
    setFile(null)
    setPreview(null)
    setCommitResult(null)
    setAllowCreateStaff(true)
    setParseError(null)
    if (inputRef.current) inputRef.current.value = ""
  }, [])

  React.useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  const selectableCount = React.useMemo(
    () => preview?.rows.filter((r) => r.selectable).length ?? 0,
    [preview],
  )

  const validationError = React.useMemo(() => {
    if (step !== "preview" || !preview) return null
    if (selectableCount === 0) {
      return "没有可导入的行，请检查 Excel 内容或重新上传"
    }
    return null
  }, [step, preview, selectableCount])

  const onFileChange = (next: File | null) => {
    setParseError(null)
    if (!next) {
      setFile(null)
      return
    }
    const name = next.name.toLowerCase()
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      setFile(null)
      setParseError("仅支持 .xlsx / .xls 文件")
      if (inputRef.current) inputRef.current.value = ""
      return
    }
    if (next.size > PROJECT_IMPORT_MAX_BYTES) {
      setFile(null)
      setParseError("文件不能超过 10MB")
      if (inputRef.current) inputRef.current.value = ""
      return
    }
    setFile(next)
  }

  const onParsePreview = async () => {
    if (!file) {
      toast.error("请选择 Excel 文件")
      return
    }

    setPhase("parsing")
    setParseError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/crm/projects/import/preview", {
        method: "POST",
        body: formData,
        credentials: "include",
      })
      const body = (await res.json()) as ProjectImportPreviewResult & { error?: string }
      if (!res.ok) {
        throw new Error(body.error ?? "解析失败")
      }

      setPreview(body)
      setStep("preview")

      const { summary } = body
      if (summary.error > 0) {
        toast.warning(`解析完成：${summary.ok} 行可导入，${summary.error} 行有误`)
      } else if (summary.warn > 0) {
        toast.message(`解析完成：${summary.ok} 行，${summary.warn} 行含告警`)
      } else {
        toast.success(`解析完成：共 ${summary.total} 行`)
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "解析失败"
      setParseError(message)
      toast.error(message)
    } finally {
      setPhase("idle")
    }
  }

  const onDownloadErrors = () => {
    if (!preview || preview.summary.error === 0) return
    try {
      const errorRows = buildProjectImportErrorExportRows(preview)
      downloadProjectImportErrorExcel({
        originalHeaders: preview.originalHeaders,
        errorRows,
        sourceFileName: preview.fileName,
      })
      toast.success(`已下载 ${errorRows.length} 行错误数据`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "下载失败")
    }
  }

  const onCommit = async () => {
    if (!preview) return
    if (validationError) {
      toast.error(validationError)
      return
    }

    setPhase("committing")
    try {
      const res = await fetch("/api/crm/projects/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          previewToken: preview.previewToken,
          allowCreateStaff,
        }),
      })
      const body = (await res.json()) as ProjectImportCommitResult & { error?: string }
      if (!res.ok) {
        throw new Error(body.error ?? "导入失败")
      }

      setCommitResult(body)
      setStep("done")

      if (body.errors.length > 0) {
        toast.warning(
          `导入完成：新建 ${body.createdProjects}，更新 ${body.updatedProjects}，${body.errors.length} 条失败`,
        )
      } else {
        toast.success(
          `导入完成：新建 ${body.createdProjects}，更新 ${body.updatedProjects}，新建客户 ${body.createdCustomers}`,
        )
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "导入失败")
    } finally {
      setPhase("idle")
    }
  }

  const handleClose = (next: boolean) => {
    if (!next && step === "done") onSuccess()
    onOpenChange(next)
  }

  const previewSummary = preview
    ? `共 ${preview.summary.total} 行，可导入 ${selectableCount} 行，错误 ${preview.summary.error} 行，告警 ${preview.summary.warn} 行`
    : null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="grid max-h-[90vh] grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden sm:max-w-5xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {step === "upload" && "导入项目信息"}
            {step === "preview" && "确认导入"}
            {step === "done" && "导入完成"}
          </DialogTitle>
          <DialogDescription>
            {step === "upload" &&
              "上传项目信息表 Excel，按表头名称解析。无租户 ID 时将自动创建客户（简称=项目名称）与默认租户。"}
            {step === "preview" &&
              (previewSummary ?? "核对解析结果后确认导入。")}
            {step === "done" && "导入结果如下，关闭后将刷新项目列表。"}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto overscroll-contain pr-1">
          {step === "upload" && (
            <div className="space-y-4 px-1">
              <div className="space-y-2">
                <Label htmlFor="project-import-file">项目信息表</Label>
                <Input
                  id="project-import-file"
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  disabled={loading}
                  onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
                />
                {file ? (
                  <p className="text-muted-foreground text-sm">
                    已选择：{file.name}（{(file.size / 1024).toFixed(1)} KB）
                  </p>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    表头需包含「项目名称」等列；支持 .xlsx / .xls，最大 10MB
                  </p>
                )}
              </div>

              {parseError ? (
                <Alert variant="destructive">
                  <IconAlertTriangle className="size-4" />
                  <AlertDescription>{parseError}</AlertDescription>
                </Alert>
              ) : null}
            </div>
          )}

          {step === "preview" && preview && (
            <div className="space-y-4 px-1">
              {preview.summary.error > 0 && (
                <Alert variant="destructive">
                  <IconAlertTriangle className="size-4" />
                  <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span>有 {preview.summary.error} 行存在错误，将无法导入</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0 border-destructive/40 bg-background"
                      onClick={onDownloadErrors}
                    >
                      <IconDownload className="mr-2 size-4" />
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
                      <TableHead>项目名称</TableHead>
                      <TableHead className="w-24">租户ID</TableHead>
                      <TableHead className="w-32">客户策略</TableHead>
                      <TableHead>客户经理</TableHead>
                      <TableHead>项目经理</TableHead>
                      <TableHead className="w-28">阶段</TableHead>
                      <TableHead className="w-16">动作</TableHead>
                      <TableHead className="min-w-[160px]">告警</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map((row) => (
                      <PreviewTableRow key={row.rowIndex} row={row} />
                    ))}
                  </TableBody>
                </Table>
              </div>

              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <Checkbox
                  checked={allowCreateStaff}
                  onCheckedChange={(v) => setAllowCreateStaff(v === true)}
                  disabled={loading}
                />
                <span>允许自动创建不存在的员工（占位手机号）</span>
              </label>
            </div>
          )}

          {step === "done" && commitResult && (
            <div className="space-y-4 px-1">
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
                <Stat label="新建项目" value={commitResult.createdProjects} />
                <Stat label="更新项目" value={commitResult.updatedProjects} />
                <Stat label="新建客户" value={commitResult.createdCustomers} />
                <Stat label="新建租户" value={commitResult.createdTenants} />
                <Stat label="新建员工" value={commitResult.createdStaff} />
                <Stat label="跳过/失败" value={commitResult.skipped + commitResult.errors.length} />
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
                        <TableRow key={err.rowIndex}>
                          <TableCell>{err.rowIndex}</TableCell>
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
          {step === "upload" && (
            <>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                取消
              </Button>
              <Button type="button" disabled={!file || loading} onClick={() => void onParsePreview()}>
                {phase === "parsing" ? (
                  <>
                    <IconLoader2 className="mr-2 size-4 animate-spin" />
                    解析中…
                  </>
                ) : (
                  "解析并预览"
                )}
              </Button>
            </>
          )}

          {step === "preview" && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => {
                  setStep("upload")
                  setPreview(null)
                }}
              >
                上一步
              </Button>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                取消
              </Button>
              <Button
                type="button"
                disabled={loading || Boolean(validationError)}
                onClick={() => void onCommit()}
              >
                {phase === "committing" ? (
                  <>
                    <IconLoader2 className="mr-2 size-4 animate-spin" />
                    导入中…
                  </>
                ) : (
                  `确认导入 ${selectableCount} 行`
                )}
              </Button>
            </>
          )}

          {step === "done" && (
            <Button
              type="button"
              onClick={() => {
                onSuccess()
                handleClose(false)
              }}
            >
              关闭并刷新列表
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PreviewTableRow({ row }: { row: ProjectImportPreviewRow }) {
  const disabled = !row.selectable
  const am = row.staffPreview.account_manager
  const pm = row.staffPreview.project_manager

  return (
    <TableRow className={disabled ? "bg-muted/40 opacity-70" : undefined}>
      <TableCell className="tabular-nums">{row.rowIndex}</TableCell>
      <TableCell className="max-w-[140px]">
        <div className="truncate font-medium" title={row.projectName}>
          {row.projectName || "—"}
        </div>
        {row.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {row.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </TableCell>
      <TableCell className="font-mono text-xs">{row.platformTenantId ?? "—"}</TableCell>
      <TableCell className="text-xs">{CUSTOMER_STRATEGY_LABEL[row.customerStrategy]}</TableCell>
      <TableCell className="text-xs">
        {am ? (
          <span>
            {am.name}
            {am.willCreate && (
              <Badge variant="outline" className="ml-1 text-[10px]">
                新建
              </Badge>
            )}
          </span>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="text-xs">
        {pm ? (
          <span>
            {pm.name}
            {pm.willCreate && (
              <Badge variant="outline" className="ml-1 text-[10px]">
                新建
              </Badge>
            )}
          </span>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="text-xs">{row.mapped.stageLabel}</TableCell>
      <TableCell>
        <Badge variant={row.action === "update" ? "outline" : "default"}>
          {ACTION_LABEL[row.action]}
        </Badge>
      </TableCell>
      <TableCell className="text-xs">
        {row.errors.length > 0 && (
          <p className="text-destructive">{row.errors.join("；")}</p>
        )}
        {row.warnings.map((w) => (
          <p key={w} className="text-muted-foreground">
            {w}
          </p>
        ))}
        {row.errors.length === 0 && row.warnings.length === 0 && "—"}
      </TableCell>
    </TableRow>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  )
}
