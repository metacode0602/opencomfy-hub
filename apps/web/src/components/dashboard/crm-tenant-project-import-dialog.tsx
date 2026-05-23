"use client"

import * as React from "react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
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
import { Textarea } from "@workspace/ui/components/textarea"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { IconAlertTriangle, IconCloudDownload, IconLoader2 } from "@tabler/icons-react"
import { toast } from "sonner"

import type { BusinessLine } from "@/lib/data/types"
import type { UserStaff } from "@/lib/types/crm"
import {
  emptyTenantProjectImportForm,
  PLATFORM_TENANT_IMPORT_MAX_IDS,
  TENANT_PROJECT_IMPORT_TAG_NAMES,
} from "@/lib/crm/tenant-project-import-utils"
import { trpc } from "@/lib/trpc/client"
import type {
  TenantProjectImportCommitResult,
  TenantProjectImportDialogPhase,
  TenantProjectImportFormValues,
  TenantProjectImportPreviewResult,
  TenantProjectImportPreviewRow,
} from "@/lib/types/tenant-project-import"
import { StaffSelect, STAFF_SELECT_DROPDOWN_ATTR } from "@/components/crm/staff-select"

const STAGE_OPTIONS = [
  { value: "lead" as const, label: "线索孵化" },
  { value: "testing" as const, label: "测试中" },
  { value: "converted" as const, label: "已转正" },
]

function actionBadge(action: TenantProjectImportPreviewRow["action"]) {
  switch (action) {
    case "create":
      return <Badge variant="default">新建</Badge>
    case "skip":
      return <Badge variant="outline">跳过</Badge>
    case "error":
      return <Badge variant="destructive">错误</Badge>
  }
}

function stageLabel(stage: TenantProjectImportFormValues["stage"]) {
  return STAGE_OPTIONS.find((s) => s.value === stage)?.label ?? stage
}

const NONE_TAG = "__none__"
const EMPTY_STAFF: UserStaff[] = []

function formValidationError(form: TenantProjectImportFormValues): string | null {
  if (!form.businessLineId) return "请选择业务线"
  if (!form.accountManagerStaffId) return "请选择客户经理"
  if (!form.deliveryManagerStaffId) return "请选择交付经理"
  if (!form.startDate) return "请选择开始日期"
  return null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessLines: BusinessLine[]
  onSuccess?: () => void
}

export function CrmTenantProjectImportDialog({
  open,
  onOpenChange,
  businessLines,
  onSuccess,
}: Props) {
  const { data: staffData, isLoading: staffLoading } = trpc.crm.staff.listActive.useQuery(
    undefined,
    { enabled: open },
  )
  const { data: allTags = [], isLoading: tagsLoading } = trpc.crm.projectTags.list.useQuery(
    undefined,
    { enabled: open },
  )
  const staff = staffData ?? EMPTY_STAFF

  const importTagOptions = React.useMemo(() => {
    const allowed = new Set<string>(TENANT_PROJECT_IMPORT_TAG_NAMES)
    return allTags.filter((tag) => allowed.has(tag.name))
  }, [allTags])

  const previewMutation = trpc.crm.projects.previewTenantProjectImport.useMutation()
  const commitMutation = trpc.crm.projects.commitTenantProjectImport.useMutation()

  const [phase, setPhase] = React.useState<TenantProjectImportDialogPhase>("idle")
  const [rawTenantIds, setRawTenantIds] = React.useState("")
  const [form, setForm] = React.useState<TenantProjectImportFormValues>(() =>
    emptyTenantProjectImportForm(),
  )
  const [preview, setPreview] = React.useState<TenantProjectImportPreviewResult | null>(null)
  const [commitResult, setCommitResult] = React.useState<TenantProjectImportCommitResult | null>(
    null,
  )

  const metaLoading = staffLoading || tagsLoading
  const loading =
    phase === "fetching" || phase === "committing" || previewMutation.isPending || commitMutation.isPending

  const staffDefaultsAppliedRef = React.useRef(false)

  const reset = React.useCallback(() => {
    setPhase("idle")
    setRawTenantIds("")
    setForm(emptyTenantProjectImportForm())
    setPreview(null)
    setCommitResult(null)
    staffDefaultsAppliedRef.current = false
  }, [])

  React.useEffect(() => {
    if (open) return
    reset()
  }, [open, reset])

  React.useEffect(() => {
    if (!open) return
    if (staff.length > 0 && !staffDefaultsAppliedRef.current) {
      staffDefaultsAppliedRef.current = true
      setForm(emptyTenantProjectImportForm(staff))
    }
  }, [open, staff])

  const patchForm = (patch: Partial<TenantProjectImportFormValues>) => {
    setForm((prev) => ({ ...prev, ...patch }))
    if (preview) {
      setPreview(null)
      setPhase("idle")
    }
  }

  const onTenantIdsChange = (value: string) => {
    setRawTenantIds(value)
    if (preview) {
      setPreview(null)
      setPhase("idle")
    }
  }

  const onFetchPreview = async () => {
    const validationError = formValidationError(form)
    if (validationError) {
      toast.error(validationError)
      return
    }
    if (!rawTenantIds.trim()) {
      toast.error("请输入至少一个平台租户 ID")
      return
    }

    setPhase("fetching")
    try {
      const result = await previewMutation.mutateAsync({ rawTenantIds, form })
      setPreview(result)
      setPhase("preview")

      const { summary } = result
      if (summary.error > 0) {
        toast.warning(
          `已拉取 ${summary.total} 个租户，${summary.toCreate} 个可新建，${summary.error} 个有误`,
        )
      } else if (summary.toCreate === 0) {
        toast.info(`共 ${summary.total} 个租户，均已存在项目，无需导入`)
      } else {
        toast.success(
          `已拉取 ${summary.total} 个租户，预计新建 ${summary.toCreate} 个项目，跳过 ${summary.toSkip} 个`,
        )
      }
    } catch (e) {
      setPhase("idle")
      toast.error(e instanceof Error ? e.message : "拉取失败，请稍后重试")
    }
  }

  const onConfirmImport = async () => {
    if (!preview) return
    const creatable = preview.summary.toCreate
    if (creatable === 0) {
      toast.error("没有可新建的项目")
      return
    }

    setPhase("committing")
    try {
      const result = await commitMutation.mutateAsync({ previewId: preview.previewId })
      setCommitResult(result)
      setPhase("done")

      if (result.errors.length > 0) {
        toast.warning(
          `导入完成：新建 ${result.created}，跳过 ${result.skipped}，${result.errors.length} 条失败`,
          { description: result.errors.slice(0, 2).map((e) => `${e.platformTenantId}: ${e.message}`).join("\n") },
        )
      } else {
        toast.success(`导入完成：新建 ${result.created} 个项目，跳过 ${result.skipped} 个`)
      }
    } catch (e) {
      setPhase("preview")
      toast.error(e instanceof Error ? e.message : "导入失败")
    }
  }

  const handleClose = (next: boolean) => {
    if (!next && phase === "done") onSuccess?.()
    onOpenChange(next)
  }

  const resolveStaffName = (id: string) =>
    id ? (staff.find((s) => s.id === id)?.display_name ?? "—") : "—"
  const resolveTagName = (id: string) =>
    id ? (importTagOptions.find((t) => t.id === id)?.name ?? allTags.find((t) => t.id === id)?.name ?? "—") : "—"
  const businessLineName =
    businessLines.find((b) => b.id === form.businessLineId)?.name ?? "—"

  const showForm = phase === "idle" || phase === "fetching"
  const showPreview = phase === "preview" || phase === "committing"
  const showDone = phase === "done"
  const formReady = !metaLoading && businessLines.length > 0 && staff.length > 0

  const preventStaffSelectOutsideDismiss = React.useCallback(
    (event: Event) => {
      const target = event.target
      if (
        target instanceof Element &&
        target.closest(`[${STAFF_SELECT_DROPDOWN_ATTR}]`)
      ) {
        event.preventDefault()
      }
    },
    [],
  )

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="grid max-h-[90vh] grid-rows-[auto_minmax(0,1fr)_auto] gap-4 overflow-hidden sm:max-w-4xl"
        onPointerDownOutside={preventStaffSelectOutsideDismiss}
        onInteractOutside={preventStaffSelectOutsideDismiss}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {showDone ? "导入完成" : showPreview ? "确认导入租户项目" : "导入租户项目"}
          </DialogTitle>
          <DialogDescription>
            {showDone
              ? "导入结果如下，关闭后将刷新项目列表。"
              : showPreview
                ? `共 ${preview?.summary.total ?? 0} 个租户，可新建 ${preview?.summary.toCreate ?? 0} 个，跳过 ${preview?.summary.toSkip ?? 0} 个，错误 ${preview?.summary.error ?? 0} 个。已存在项目仅跳过，不更新。`
                : `输入平台租户 ID（逗号、空格或换行分隔，单次最多 ${PLATFORM_TENANT_IMPORT_MAX_IDS} 个），配置统一项目属性后从算算力平台拉取并预览。`}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto overscroll-contain pr-1">
          {metaLoading && showForm && (
            <Alert className="mb-4">
              <IconLoader2 className="size-4 animate-spin" />
              <AlertDescription>正在加载业务线与员工数据…</AlertDescription>
            </Alert>
          )}

          {!metaLoading && !formReady && showForm && (
            <Alert variant="destructive" className="mb-4">
              <IconAlertTriangle className="size-4" />
              <AlertDescription>
                {businessLines.length === 0
                  ? "暂无可用业务线，请先在系统中配置业务线"
                  : "暂无可用员工，请先在系统中添加员工"}
              </AlertDescription>
            </Alert>
          )}

          {showForm && (
            <div className="space-y-4 px-1">
              <div className="space-y-2">
                <Label htmlFor="tenant-project-import-ids">平台租户 ID</Label>
                <Textarea
                  id="tenant-project-import-ids"
                  placeholder="例如：12724, 15052&#10;16462"
                  rows={4}
                  value={rawTenantIds}
                  disabled={loading || !formReady}
                  onChange={(e) => onTenantIdsChange(e.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  租户需已导入 CRM；若平台无此 ID 或本地未关联，预览中将标记为错误
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tenant-project-import-stage">当前阶段</Label>
                  <Select
                    value={form.stage}
                    onValueChange={(v) =>
                      patchForm({ stage: v as TenantProjectImportFormValues["stage"] })
                    }
                    disabled={loading || !formReady}
                  >
                    <SelectTrigger id="tenant-project-import-stage" className="w-full">
                      <SelectValue placeholder="请选择阶段" />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGE_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tenant-project-import-bl">业务线</Label>
                  <Select
                    value={form.businessLineId || undefined}
                    onValueChange={(v) => patchForm({ businessLineId: v })}
                    disabled={loading || !formReady}
                  >
                    <SelectTrigger id="tenant-project-import-bl" className="w-full">
                      <SelectValue placeholder="请选择业务线" />
                    </SelectTrigger>
                    <SelectContent>
                      {businessLines.map((bl) => (
                        <SelectItem key={bl.id} value={bl.id}>
                          {bl.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <StaffSelect
                  id="tenant-project-import-pre-sales"
                  label="售前经理"
                  value={form.preSalesStaffId}
                  staff={staff}
                  disabled={loading || !formReady}
                  placeholder="可选"
                  onChange={(v) => patchForm({ preSalesStaffId: v })}
                />
                <StaffSelect
                  id="tenant-project-import-am"
                  label="客户经理"
                  value={form.accountManagerStaffId}
                  staff={staff}
                  disabled={loading || !formReady}
                  allowEmpty={false}
                  onChange={(v) => patchForm({ accountManagerStaffId: v })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <StaffSelect
                  id="tenant-project-import-dm"
                  label="交付经理"
                  value={form.deliveryManagerStaffId}
                  staff={staff}
                  disabled={loading || !formReady}
                  allowEmpty={false}
                  onChange={(v) => patchForm({ deliveryManagerStaffId: v })}
                />
                <StaffSelect
                  id="tenant-project-import-pm"
                  label="项目经理"
                  value={form.projectManagerStaffId}
                  staff={staff}
                  disabled={loading || !formReady}
                  placeholder="可选"
                  onChange={(v) => patchForm({ projectManagerStaffId: v })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tenant-project-import-tag">项目标签</Label>
                  <Select
                    value={form.tagId || NONE_TAG}
                    onValueChange={(v) => patchForm({ tagId: v === NONE_TAG ? "" : v })}
                    disabled={loading || !formReady}
                  >
                    <SelectTrigger id="tenant-project-import-tag" className="w-full">
                      <SelectValue placeholder="可选" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_TAG}>不选择</SelectItem>
                      {importTagOptions.map((tag) => (
                        <SelectItem key={tag.id} value={tag.id}>
                          {tag.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tenant-project-import-start">开始日期</Label>
                  <Input
                    id="tenant-project-import-start"
                    type="date"
                    value={form.startDate}
                    disabled={loading || !formReady}
                    onChange={(e) => patchForm({ startDate: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {showPreview && preview && (
            <div className="space-y-4 px-1">
              <Alert>
                <IconCloudDownload className="size-4" />
                <AlertDescription className="text-sm">
                  统一配置：{stageLabel(preview.formSnapshot.stage)} ·{" "}
                  {businessLines.find((b) => b.id === preview.formSnapshot.businessLineId)?.name ??
                    businessLineName}{" "}
                  · 售前 {resolveStaffName(preview.formSnapshot.preSalesStaffId)} · 客户经理{" "}
                  {resolveStaffName(preview.formSnapshot.accountManagerStaffId)} · 交付{" "}
                  {resolveStaffName(preview.formSnapshot.deliveryManagerStaffId)} · 项目经理{" "}
                  {resolveStaffName(preview.formSnapshot.projectManagerStaffId)}
                  {preview.formSnapshot.tagId
                    ? ` · 标签 ${resolveTagName(preview.formSnapshot.tagId)}`
                    : ""}{" "}
                  · 开始 {preview.formSnapshot.startDate || "—"}
                </AlertDescription>
              </Alert>

              {preview.summary.error > 0 && (
                <Alert variant="destructive">
                  <IconAlertTriangle className="size-4" />
                  <AlertDescription>
                    有 {preview.summary.error} 个租户无法导入，确认时将忽略这些行
                  </AlertDescription>
                </Alert>
              )}

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">租户 ID</TableHead>
                      <TableHead>租户名称</TableHead>
                      <TableHead>客户</TableHead>
                      <TableHead>项目名称</TableHead>
                      <TableHead className="w-20">动作</TableHead>
                      <TableHead className="min-w-[140px]">说明</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map((row) => (
                      <PreviewRow key={row.platformTenantId} row={row} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {showDone && commitResult && (
            <div className="space-y-4 px-1">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <Stat label="新建项目" value={commitResult.created} />
                <Stat label="跳过" value={commitResult.skipped} />
                <Stat label="失败" value={commitResult.errors.length} />
              </div>
              {commitResult.errors.length > 0 && (
                <div className="max-h-40 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-28">租户 ID</TableHead>
                        <TableHead>原因</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commitResult.errors.map((err) => (
                        <TableRow key={err.platformTenantId}>
                          <TableCell className="font-mono text-sm">{err.platformTenantId}</TableCell>
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
          {showForm && (
            <>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                取消
              </Button>
              <Button
                type="button"
                disabled={!rawTenantIds.trim() || loading || !formReady}
                onClick={() => void onFetchPreview()}
              >
                {phase === "fetching" || previewMutation.isPending ? (
                  <>
                    <IconLoader2 className="mr-2 size-4 animate-spin" />
                    拉取中…
                  </>
                ) : (
                  "拉取并预览"
                )}
              </Button>
            </>
          )}

          {showPreview && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => {
                  setPreview(null)
                  setPhase("idle")
                }}
              >
                上一步
              </Button>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                取消
              </Button>
              <Button
                type="button"
                disabled={loading || (preview?.summary.toCreate ?? 0) === 0}
                onClick={() => void onConfirmImport()}
              >
                {phase === "committing" || commitMutation.isPending ? (
                  <>
                    <IconLoader2 className="mr-2 size-4 animate-spin" />
                    创建中…
                  </>
                ) : (
                  `确认创建 ${preview?.summary.toCreate ?? 0} 个项目`
                )}
              </Button>
            </>
          )}

          {showDone && (
            <Button
              type="button"
              onClick={() => {
                onSuccess?.()
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

function PreviewRow({ row }: { row: TenantProjectImportPreviewRow }) {
  const muted = row.action === "error"
  return (
    <TableRow className={muted ? "bg-muted/40 opacity-80" : undefined}>
      <TableCell className="font-mono text-sm">{row.platformTenantId}</TableCell>
      <TableCell>{row.tenantName}</TableCell>
      <TableCell className="text-sm">{row.customerName ?? "—"}</TableCell>
      <TableCell className="max-w-[180px] truncate" title={row.projectName}>
        {row.projectName}
      </TableCell>
      <TableCell>{actionBadge(row.action)}</TableCell>
      <TableCell className="text-xs">
        {row.errors.map((e) => (
          <p key={e} className="text-destructive">
            {e}
          </p>
        ))}
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
