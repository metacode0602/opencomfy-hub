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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
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
import { IconAlertTriangle, IconLoader2 } from "@tabler/icons-react"
import { toast } from "sonner"

import { OPPORTUNITY_IMPORT_MAX_BYTES } from "@/lib/crm/opportunity-import-utils"
import {
  OPPORTUNITY_SOURCE_LABELS,
  OPPORTUNITY_SOURCE_VALUES,
  type OpportunitySource,
} from "@/lib/crm/commission-constants"
import type {
  OpportunityImportCommitResult,
  OpportunityImportPreviewResult,
  OpportunityImportPreviewRow,
  OpportunityImportRowOverride,
} from "@/lib/types/opportunity-import"
import type { UserStaff } from "@/lib/types/crm"
import { trpc } from "@/lib/trpc/client"
import {
  preventStaffSelectOutsideDismiss,
  StaffSelect,
} from "@/components/crm/staff-select"

type Step = "upload" | "preview" | "done"

type LoadPhase = "idle" | "parsing" | "committing"

const NONE_OPPORTUNITY = "__none__"
const EMPTY_STAFF: UserStaff[] = []

type EditableRowPatch = Partial<
  Pick<
    OpportunityImportPreviewRow,
    | "opportunitySource"
    | "opportunitySourceLabel"
    | "accountManagerStaffId"
    | "deliveryManagerStaffId"
    | "projectManagerStaffId"
    | "preSalesStaffId"
    | "effectiveFrom"
    | "selected"
  >
>

function buildRowOverrides(
  initial: OpportunityImportPreviewResult,
  edited: OpportunityImportPreviewResult,
): OpportunityImportRowOverride[] {
  const initialByRow = new Map(initial.rows.map((row) => [row.rowIndex, row]))
  const overrides: OpportunityImportRowOverride[] = []

  for (const row of edited.rows) {
    if (!row.selectable) continue
    const base = initialByRow.get(row.rowIndex)
    const patch: OpportunityImportRowOverride = { rowIndex: row.rowIndex }
    let changed = false

    if (row.opportunitySource !== base?.opportunitySource) {
      patch.opportunitySource = row.opportunitySource ?? null
      changed = true
    }
    if (row.accountManagerStaffId !== base?.accountManagerStaffId) {
      patch.accountManagerStaffId = row.accountManagerStaffId ?? null
      changed = true
    }
    if (row.deliveryManagerStaffId !== base?.deliveryManagerStaffId) {
      patch.deliveryManagerStaffId = row.deliveryManagerStaffId ?? null
      changed = true
    }
    if (row.projectManagerStaffId !== base?.projectManagerStaffId) {
      patch.projectManagerStaffId = row.projectManagerStaffId ?? null
      changed = true
    }
    if (row.preSalesStaffId !== base?.preSalesStaffId) {
      patch.preSalesStaffId = row.preSalesStaffId ?? null
      changed = true
    }
    if (row.effectiveFrom !== base?.effectiveFrom) {
      patch.effectiveFrom = row.effectiveFrom
      changed = true
    }
    if (row.selected !== base?.selected) {
      patch.selected = row.selected
      changed = true
    }

    if (changed) overrides.push(patch)
  }

  return overrides
}

export function CrmOpportunityImportDialog({
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
  const [preview, setPreview] = React.useState<OpportunityImportPreviewResult | null>(null)
  const [editablePreview, setEditablePreview] = React.useState<OpportunityImportPreviewResult | null>(
    null,
  )
  const [commitResult, setCommitResult] = React.useState<OpportunityImportCommitResult | null>(null)
  const [allowCreateStaff, setAllowCreateStaff] = React.useState(true)
  const [parseError, setParseError] = React.useState<string | null>(null)

  const { data: staffData } = trpc.crm.staff.listActive.useQuery(undefined, {
    enabled: open && step === "preview",
  })
  const staff = staffData ?? EMPTY_STAFF

  const loading = phase === "parsing" || phase === "committing"

  const reset = React.useCallback(() => {
    setStep("upload")
    setPhase("idle")
    setFile(null)
    setPreview(null)
    setEditablePreview(null)
    setCommitResult(null)
    setAllowCreateStaff(true)
    setParseError(null)
    if (inputRef.current) inputRef.current.value = ""
  }, [])

  React.useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  const patchEditableRow = React.useCallback((rowIndex: number, patch: EditableRowPatch) => {
    setEditablePreview((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        rows: prev.rows.map((row) => (row.rowIndex === rowIndex ? { ...row, ...patch } : row)),
      }
    })
  }, [])

  const activePreview = editablePreview ?? preview

  const selectedCount = React.useMemo(
    () => activePreview?.rows.filter((r) => r.selectable && r.selected).length ?? 0,
    [activePreview],
  )

  const validationError = React.useMemo(() => {
    if (step !== "preview" || !activePreview) return null
    if (activePreview.duplicateRowKeys) {
      return "存在重复的租户 ID + 项目名称，请去重后重新上传"
    }
    if (selectedCount === 0) {
      return "请至少勾选一行可导入的数据"
    }
    return null
  }, [step, activePreview, selectedCount])

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
    if (next.size > OPPORTUNITY_IMPORT_MAX_BYTES) {
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
      const res = await fetch("/api/crm/projects/opportunity-import/preview", {
        method: "POST",
        body: formData,
        credentials: "include",
      })
      const body = (await res.json()) as OpportunityImportPreviewResult & { error?: string }
      if (!res.ok) {
        throw new Error(body.error ?? "解析失败")
      }

      setPreview(body)
      setEditablePreview(body)
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

  const onCommit = async () => {
    if (!preview || !editablePreview) return
    if (validationError) {
      toast.error(validationError)
      return
    }

    setPhase("committing")
    try {
      const res = await fetch("/api/crm/projects/opportunity-import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          previewToken: preview.previewToken,
          allowCreateStaff,
          rowOverrides: buildRowOverrides(preview, editablePreview),
        }),
      })
      const body = (await res.json()) as OpportunityImportCommitResult & { error?: string }
      if (!res.ok) {
        throw new Error(body.error ?? "导入失败")
      }

      setCommitResult(body)
      setStep("done")

      if (body.failed.length > 0) {
        toast.warning(`导入完成，${body.failed.length} 行失败`)
      } else {
        toast.success("商机信息导入完成")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "导入失败")
    } finally {
      setPhase("idle")
    }
  }

  const handleClose = (next: boolean) => {
    if (!next && step === "done") onSuccess?.()
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="grid max-h-[90vh] max-w-6xl min-w-[70vw] grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden p-4 sm:p-6"
        onPointerDownOutside={preventStaffSelectOutsideDismiss}
        onInteractOutside={preventStaffSelectOutsideDismiss}
        onFocusOutside={preventStaffSelectOutsideDismiss}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {step === "done" ? "导入完成" : step === "preview" ? "确认导入商机" : "导入商机"}
          </DialogTitle>
          <DialogDescription>
            {step === "done"
              ? "导入结果如下，关闭后将刷新项目列表。"
              : step === "preview"
                ? `共 ${activePreview?.summary.total ?? 0} 行，可导入 ${activePreview?.summary.ok ?? 0} 行，错误 ${activePreview?.summary.error ?? 0} 行。仅更新已存在项目的商机来源与四人组。`
                : "上传 Excel 批量更新商机来源、销售（客户经理）、交付、项目经理、售前。仅管理员可操作。"}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 min-w-0 overflow-x-auto overflow-y-auto overscroll-contain pr-1">
          {step === "upload" && (
            <div className="space-y-4 px-1">
              <div className="space-y-2">
                <Label htmlFor="opportunity-import-file">Excel 文件</Label>
                <Input
                  id="opportunity-import-file"
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
                    需包含列：项目名称、租户ID、业务线、商机来源、销售、交付、项目经理、售前。可有更多列（如创建时间），程序自动忽略无关列。每行生效日默认取「创建时间」列，可在预览中单独修改。商机来源：市场 / 销售 / 高管。空列表示不更新。
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

          {step === "preview" && activePreview && (
            <div className="space-y-4 px-1">
              {activePreview.ignoredColumnCount > 0 && (
                <p className="text-muted-foreground text-xs">
                  已忽略 {activePreview.ignoredColumnCount} 个无关列
                </p>
              )}

              {activePreview.duplicateRowKeys && (
                <Alert variant="destructive">
                  <IconAlertTriangle className="size-4" />
                  <AlertDescription>
                    文件中存在重复的「租户 ID + 项目名称」，请去重后重新上传。
                  </AlertDescription>
                </Alert>
              )}

              {activePreview.summary.error > 0 && (
                <Alert variant="destructive">
                  <IconAlertTriangle className="size-4" />
                  <AlertDescription>
                    有 {activePreview.summary.error} 行存在错误，将无法导入
                  </AlertDescription>
                </Alert>
              )}

              <div className="overflow-x-auto rounded-md border">
                <Table className="min-w-[1200px] w-max">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 shrink-0">选</TableHead>
                      <TableHead className="w-12 shrink-0">行</TableHead>
                      <TableHead className="min-w-[120px]">项目名</TableHead>
                      <TableHead className="min-w-[88px]">租户ID</TableHead>
                      <TableHead className="min-w-[140px]">匹配项目</TableHead>
                      <TableHead className="min-w-[140px]">商机来源</TableHead>
                      <TableHead className="min-w-[140px]">销售</TableHead>
                      <TableHead className="min-w-[140px]">交付</TableHead>
                      <TableHead className="min-w-[140px]">PM</TableHead>
                      <TableHead className="min-w-[140px]">售前</TableHead>
                      <TableHead className="min-w-[136px]">生效日</TableHead>
                      <TableHead className="min-w-[160px]">告警</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activePreview.rows.map((row) => (
                      <PreviewRow
                        key={row.rowIndex}
                        row={row}
                        staff={staff}
                        disabled={loading}
                        onPatch={patchEditableRow}
                      />
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
            <div className="space-y-4 px-1 text-sm">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <Stat label="商机来源" value={commitResult.updatedOpportunitySource} />
                <Stat label="销售" value={commitResult.updatedAccountManager} />
                <Stat label="交付" value={commitResult.updatedDeliveryManager} />
                <Stat label="项目经理" value={commitResult.updatedProjectManager} />
                <Stat label="售前" value={commitResult.updatedPreSales} />
                <Stat label="跳过" value={commitResult.skipped} />
              </div>
              {commitResult.failed.length > 0 && (
                <div className="max-h-40 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-14">行</TableHead>
                        <TableHead>原因</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commitResult.failed.map((err) => (
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
                  setEditablePreview(null)
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
                  `确认导入 ${selectedCount} 行`
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function PreviewRow({
  row,
  staff,
  disabled,
  onPatch,
}: {
  row: OpportunityImportPreviewRow
  staff: readonly UserStaff[]
  disabled: boolean
  onPatch: (rowIndex: number, patch: EditableRowPatch) => void
}) {
  const rowDisabled = !row.selectable || disabled
  const oppValue = row.opportunitySource ?? NONE_OPPORTUNITY

  return (
    <TableRow className={rowDisabled ? "bg-muted/40 opacity-80" : undefined}>
      <TableCell>
        <Checkbox
          checked={row.selected}
          disabled={!row.selectable || disabled}
          onCheckedChange={(v) => onPatch(row.rowIndex, { selected: v === true })}
        />
      </TableCell>
      <TableCell className="tabular-nums">{row.rowIndex}</TableCell>
      <TableCell className="truncate" title={row.projectName}>
        {row.projectName || "—"}
      </TableCell>
      <TableCell className="tabular-nums truncate" title={row.excelTenantId}>
        {row.excelTenantId || "—"}
      </TableCell>
      <TableCell>
        {row.errors.length > 0 ? (
          <Badge variant="destructive">错误</Badge>
        ) : (
          <div className="truncate" title={row.resolvedProjectName}>
            {row.resolvedProjectName ?? "—"}
          </div>
        )}
      </TableCell>
      <TableCell className="min-w-[140px]">
        <Select
          value={oppValue}
          disabled={rowDisabled}
          onValueChange={(v) => {
            if (v === NONE_OPPORTUNITY) {
              onPatch(row.rowIndex, {
                opportunitySource: null,
                opportunitySourceLabel: "（不更新）",
              })
            } else {
              const source = v as OpportunitySource
              onPatch(row.rowIndex, {
                opportunitySource: source,
                opportunitySourceLabel: OPPORTUNITY_SOURCE_LABELS[source],
              })
            }
          }}
        >
          <SelectTrigger className="h-8 w-full min-w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_OPPORTUNITY}>不更新</SelectItem>
            {OPPORTUNITY_SOURCE_VALUES.map((code) => (
              <SelectItem key={code} value={code}>
                {OPPORTUNITY_SOURCE_LABELS[code]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="min-w-[140px]">
        <StaffSelect
          value={row.accountManagerStaffId ?? ""}
          staff={staff}
          disabled={rowDisabled}
          allowEmpty
          placeholder="—"
          onChange={(v) => onPatch(row.rowIndex, { accountManagerStaffId: v || null })}
        />
      </TableCell>
      <TableCell className="min-w-[140px]">
        <StaffSelect
          value={row.deliveryManagerStaffId ?? ""}
          staff={staff}
          disabled={rowDisabled}
          allowEmpty
          placeholder="—"
          onChange={(v) => onPatch(row.rowIndex, { deliveryManagerStaffId: v || null })}
        />
      </TableCell>
      <TableCell className="min-w-[140px]">
        <StaffSelect
          value={row.projectManagerStaffId ?? ""}
          staff={staff}
          disabled={rowDisabled}
          allowEmpty
          placeholder="—"
          onChange={(v) => onPatch(row.rowIndex, { projectManagerStaffId: v || null })}
        />
      </TableCell>
      <TableCell className="min-w-[140px]">
        <StaffSelect
          value={row.preSalesStaffId ?? ""}
          staff={staff}
          disabled={rowDisabled}
          allowEmpty
          placeholder="—"
          onChange={(v) => onPatch(row.rowIndex, { preSalesStaffId: v || null })}
        />
      </TableCell>
      <TableCell className="min-w-[136px]">
        <Input
          type="date"
          className="h-8 w-full min-w-[128px]"
          value={row.effectiveFrom}
          disabled={rowDisabled}
          onChange={(e) => onPatch(row.rowIndex, { effectiveFrom: e.target.value })}
        />
      </TableCell>
      <TableCell className="text-muted-foreground min-w-[160px] text-xs whitespace-normal break-words">
        {[...row.errors, ...row.warnings].join("；") || "—"}
      </TableCell>
    </TableRow>
  )
}
