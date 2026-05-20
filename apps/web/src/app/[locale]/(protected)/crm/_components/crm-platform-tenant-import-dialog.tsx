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
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group"
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
import { Badge } from "@workspace/ui/components/badge"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { IconAlertTriangle, IconLoader2 } from "@tabler/icons-react"
import { toast } from "sonner"

import {
  defaultCreateCustomerFromPlatform,
  parsePlatformTenantIds,
  PLATFORM_TENANT_IMPORT_MAX_IDS,
} from "@/lib/crm/platform-tenant-import-utils"
import { trpc } from "@/lib/trpc/client"
import type {
  PlatformImportCommitItem,
  PlatformImportCommitResult,
  PlatformImportCustomerAssignment,
  PlatformImportPreviewResult,
  PlatformTenantPreviewItem,
} from "@/lib/types/platform-tenant-import"

type Step = "input" | "preview" | "done"

type RowAssignment = {
  platformTenantId: string
  customer: PlatformImportCustomerAssignment
}

function formatMoney(n: number) {
  return `¥${n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function buildInitialAssignments(preview: PlatformImportPreviewResult): RowAssignment[] {
  return preview.items
    .filter((item) => !item.missingOnPlatform && !item.local)
    .map((item) => ({
      platformTenantId: item.platformTenantId,
      customer: defaultCreateCustomerFromPlatform(item),
    }))
}

function CustomerSearchSelect({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (customerId: string) => void
  disabled?: boolean
}) {
  const [search, setSearch] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")

  React.useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(t)
  }, [search])

  const { data: customers = [], isFetching } = trpc.crm.customers.list.useQuery(
    { search: debouncedSearch || undefined },
    { enabled: !disabled },
  )

  const selectedLabel = customers.find((c) => c.id === value)?.name

  return (
    <div className="space-y-2">
      <Input
        placeholder="搜索客户名称、联系人…"
        value={search}
        disabled={disabled}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 text-sm"
      />
      <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={isFetching ? "加载中…" : "选择客户"}>
            {value && !selectedLabel ? value : selectedLabel}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {customers.length === 0 ? (
            <p className="text-muted-foreground px-2 py-4 text-center text-xs">
              {debouncedSearch ? "未找到匹配客户" : "输入关键词搜索客户"}
            </p>
          ) : (
            customers.slice(0, 50).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
                <span className="text-muted-foreground ml-2">
                  ({c.type === "B" ? "企业" : "个人"})
                </span>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  )
}

export function CrmPlatformTenantImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const [step, setStep] = React.useState<Step>("input")
  const [idsRaw, setIdsRaw] = React.useState("")
  const [preview, setPreview] = React.useState<PlatformImportPreviewResult | null>(null)
  const [assignments, setAssignments] = React.useState<RowAssignment[]>([])
  const [confirmedNoCustomerUpdate, setConfirmedNoCustomerUpdate] = React.useState(false)
  const [commitResult, setCommitResult] = React.useState<PlatformImportCommitResult | null>(null)

  const previewMutation = trpc.crm.tenants.previewPlatformImport.useMutation()
  const commitMutation = trpc.crm.tenants.commitPlatformImport.useMutation()

  const loading = previewMutation.isPending || commitMutation.isPending

  const reset = React.useCallback(() => {
    setStep("input")
    setIdsRaw("")
    setPreview(null)
    setAssignments([])
    setConfirmedNoCustomerUpdate(false)
    setCommitResult(null)
  }, [])

  React.useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  const previewById = React.useMemo(() => {
    const map = new Map<string, PlatformTenantPreviewItem>()
    preview?.items.forEach((item) => map.set(item.platformTenantId, item))
    return map
  }, [preview])

  const assignmentById = React.useMemo(() => {
    const map = new Map<string, RowAssignment>()
    assignments.forEach((a) => map.set(a.platformTenantId, a))
    return map
  }, [assignments])

  const actionableItems = React.useMemo(
    () => preview?.items.filter((i) => !i.missingOnPlatform) ?? [],
    [preview],
  )

  const needsCustomerChoice = React.useMemo(
    () => actionableItems.filter((i) => !i.local),
    [actionableItems],
  )

  const validationError = React.useMemo(() => {
    if (step !== "preview") return null
    if (actionableItems.length === 0) {
      return "没有可导入的租户，请检查平台 ID 或重新拉取"
    }
    for (const item of needsCustomerChoice) {
      const a = assignmentById.get(item.platformTenantId)
      if (!a) return `请为平台租户 ${item.platformTenantId} 配置客户关联`
      if (a.customer.mode === "existing" && !a.customer.customerId) {
        return `请为平台租户 ${item.platformTenantId} 选择客户`
      }
      if (a.customer.mode === "create" && !a.customer.name.trim()) {
        return `请为平台租户 ${item.platformTenantId} 填写客户名称`
      }
    }
    const hasNewCustomer = needsCustomerChoice.some(
      (i) => assignmentById.get(i.platformTenantId)?.customer.mode === "create",
    )
    if (hasNewCustomer && !confirmedNoCustomerUpdate) {
      return "请勾选确认：不会修改已有客户的资料"
    }
    return null
  }, [step, actionableItems, needsCustomerChoice, assignmentById, confirmedNoCustomerUpdate])

  const updateAssignment = (
    platformTenantId: string,
    patch: Partial<PlatformImportCustomerAssignment>,
  ) => {
    setAssignments((prev) => {
      const idx = prev.findIndex((a) => a.platformTenantId === platformTenantId)
      if (idx < 0) return prev
      const next = [...prev]
      const current = next[idx]!
      next[idx] = {
        platformTenantId,
        customer: { ...current.customer, ...patch } as PlatformImportCustomerAssignment,
      }
      return next
    })
  }

  const setAssignmentMode = (platformTenantId: string, mode: "create" | "existing") => {
    const item = previewById.get(platformTenantId)
    if (!item) return
    if (mode === "create") {
      setAssignments((prev) => {
        const rest = prev.filter((a) => a.platformTenantId !== platformTenantId)
        return [...rest, { platformTenantId, customer: defaultCreateCustomerFromPlatform(item) }]
      })
    } else {
      setAssignments((prev) => {
        const rest = prev.filter((a) => a.platformTenantId !== platformTenantId)
        return [
          ...rest,
          { platformTenantId, customer: { mode: "existing", customerId: "" } },
        ]
      })
    }
  }

  const onFetchPreview = async () => {
    const ids = parsePlatformTenantIds(idsRaw)
    if (ids.length === 0) {
      toast.error("请输入有效的平台租户 ID（纯数字）")
      return
    }
    if (ids.length > PLATFORM_TENANT_IMPORT_MAX_IDS) {
      toast.error(`单次最多 ${PLATFORM_TENANT_IMPORT_MAX_IDS} 个 ID`)
      return
    }
    try {
      const result = await previewMutation.mutateAsync({ platformTenantIds: ids })
      setPreview(result)
      setAssignments(buildInitialAssignments(result))
      setStep("preview")
      if (result.missingPlatformIds.length > 0) {
        toast.warning(`有 ${result.missingPlatformIds.length} 个 ID 平台未返回`)
      } else if (result.items.filter((i) => !i.missingOnPlatform).length === 0) {
        toast.error("平台未返回任何有效租户")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "拉取失败")
    }
  }

  const onCommit = async () => {
    if (validationError) {
      toast.error(validationError)
      return
    }
    const commitItems: PlatformImportCommitItem[] = actionableItems.map((item) => {
      if (item.local) {
        return { platformTenantId: item.platformTenantId }
      }
      return {
        platformTenantId: item.platformTenantId,
        customer: assignmentById.get(item.platformTenantId)!.customer,
      }
    })
    try {
      const result = await commitMutation.mutateAsync({ items: commitItems })
      setCommitResult(result)
      setStep("done")
      const fail = result.errors.length
      if (fail > 0) {
        toast.warning(
          `导入完成：新增租户 ${result.createdTenants}，更新 ${result.updatedTenants}，${fail} 条失败`,
        )
      } else {
        toast.success(
          `导入完成：新增租户 ${result.createdTenants}，更新 ${result.updatedTenants}，新建客户 ${result.createdCustomers}`,
        )
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "导入失败")
    }
  }

  const handleClose = (next: boolean) => {
    if (!next && step === "done") onSuccess()
    onOpenChange(next)
  }

  const previewSummary =
    preview &&
    `共 ${preview.items.length} 条，平台返回 ${preview.items.filter((i) => !i.missingOnPlatform).length} 条，本地已有 ${preview.items.filter((i) => i.local).length} 条`

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {step === "input" && "从平台导入租户"}
            {step === "preview" && "确认导入"}
            {step === "done" && "导入完成"}
          </DialogTitle>
          <DialogDescription>
            {step === "input" &&
              `输入平台租户 ID，多个可用逗号或换行分隔（最多 ${PLATFORM_TENANT_IMPORT_MAX_IDS} 个）。`}
            {step === "preview" &&
              (previewSummary ??
                "核对平台数据并配置客户关联；已有本地租户仅更新计费账户，不修改客户资料。")}
            {step === "done" && "导入结果如下，关闭后将刷新租户列表。"}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {step === "input" && (
            <div className="space-y-3 px-1">
              <Label htmlFor="platform-tenant-ids">平台租户 ID</Label>
              <Textarea
                id="platform-tenant-ids"
                placeholder={"16462\n16463, 16464"}
                rows={6}
                value={idsRaw}
                disabled={loading}
                onChange={(e) => setIdsRaw(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                支持半角/中文逗号、空格、换行分隔；仅保留纯数字 ID。
              </p>
            </div>
          )}

          {step === "preview" && preview && (
            <div className="space-y-4 px-1">
              {preview.missingPlatformIds.length > 0 && (
                <Alert variant="destructive">
                  <IconAlertTriangle className="size-4" />
                  <AlertDescription>
                    平台未返回：{preview.missingPlatformIds.join("、")}
                  </AlertDescription>
                </Alert>
              )}

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">平台 ID</TableHead>
                      <TableHead>租户名</TableHead>
                      <TableHead>手机</TableHead>
                      <TableHead className="text-right">余额</TableHead>
                      <TableHead className="w-20">本地</TableHead>
                      <TableHead className="min-w-[280px]">客户关联</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.items.map((item) => (
                      <PreviewRow
                        key={item.platformTenantId}
                        item={item}
                        assignment={assignmentById.get(item.platformTenantId)}
                        onModeChange={setAssignmentMode}
                        onAssignmentChange={updateAssignment}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>

              {needsCustomerChoice.some(
                (i) => assignmentById.get(i.platformTenantId)?.customer.mode === "create",
              ) && (
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <Checkbox
                    checked={confirmedNoCustomerUpdate}
                    onCheckedChange={(v) => setConfirmedNoCustomerUpdate(v === true)}
                  />
                  <span>我已确认：不会修改已有客户的资料（仅新建客户或关联已有客户）</span>
                </label>
              )}
            </div>
          )}

          {step === "done" && commitResult && (
            <div className="space-y-4 px-1">
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <Stat label="新增租户" value={commitResult.createdTenants} />
                <Stat label="更新租户" value={commitResult.updatedTenants} />
                <Stat label="新建客户" value={commitResult.createdCustomers} />
                <Stat label="失败" value={commitResult.errors.length} />
              </div>
              {commitResult.errors.length > 0 && (
                <div className="max-h-40 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>平台 ID</TableHead>
                        <TableHead>原因</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commitResult.errors.map((err) => (
                        <TableRow key={err.platformTenantId}>
                          <TableCell className="font-mono">{err.platformTenantId}</TableCell>
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

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "input" && (
            <>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                取消
              </Button>
              <Button type="button" disabled={loading} onClick={() => void onFetchPreview()}>
                {loading ? (
                  <>
                    <IconLoader2 className="mr-2 size-4 animate-spin" />
                    正在从平台拉取…
                  </>
                ) : (
                  "拉取并预览"
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
                  setStep("input")
                  setPreview(null)
                  setAssignments([])
                  setConfirmedNoCustomerUpdate(false)
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
                {loading ? (
                  <>
                    <IconLoader2 className="mr-2 size-4 animate-spin" />
                    导入中…
                  </>
                ) : (
                  "确认导入"
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

function PreviewRow({
  item,
  assignment,
  onModeChange,
  onAssignmentChange,
}: {
  item: PlatformTenantPreviewItem
  assignment?: RowAssignment
  onModeChange: (platformTenantId: string, mode: "create" | "existing") => void
  onAssignmentChange: (
    platformTenantId: string,
    patch: Partial<PlatformImportCustomerAssignment>,
  ) => void
}) {
  const { platformTenantId, platform, local, missingOnPlatform } = item

  if (missingOnPlatform) {
    return (
      <TableRow className="bg-muted/40 opacity-60">
        <TableCell className="font-mono text-sm">{platformTenantId}</TableCell>
        <TableCell colSpan={4}>—</TableCell>
        <TableCell>
          <Badge variant="secondary">平台无数据</Badge>
        </TableCell>
      </TableRow>
    )
  }

  if (local) {
    return (
      <TableRow>
        <TableCell className="font-mono text-sm">{platformTenantId}</TableCell>
        <TableCell className="max-w-[120px] truncate" title={platform.tenantName}>
          {platform.tenantName}
        </TableCell>
        <TableCell className="text-sm">{platform.adminPhone ?? "—"}</TableCell>
        <TableCell className="text-right tabular-nums">{formatMoney(platform.coin)}</TableCell>
        <TableCell>
          <Badge variant="outline">更新</Badge>
        </TableCell>
        <TableCell className="text-muted-foreground text-sm">
          已关联：
          <span className="text-foreground font-medium">{local.customerName}</span>
          <span className="block text-xs">（不可改绑客户）</span>
        </TableCell>
      </TableRow>
    )
  }

  const customer = assignment?.customer
  const mode = customer?.mode ?? "create"

  return (
    <TableRow>
      <TableCell className="font-mono text-sm">{platformTenantId}</TableCell>
      <TableCell className="max-w-[120px] truncate" title={platform.tenantName}>
        {platform.tenantName}
      </TableCell>
      <TableCell className="text-sm">{platform.adminPhone ?? "—"}</TableCell>
      <TableCell className="text-right tabular-nums">{formatMoney(platform.coin)}</TableCell>
      <TableCell>
        <Badge>新建</Badge>
      </TableCell>
      <TableCell>
        <div className="space-y-3 py-1">
          <RadioGroup
            value={mode}
            onValueChange={(v) => onModeChange(platformTenantId, v as "create" | "existing")}
            className="flex flex-wrap gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="create" id={`${platformTenantId}-create`} />
              <Label htmlFor={`${platformTenantId}-create`} className="font-normal">
                新建客户
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="existing" id={`${platformTenantId}-existing`} />
              <Label htmlFor={`${platformTenantId}-existing`} className="font-normal">
                关联已有
              </Label>
            </div>
          </RadioGroup>

          {mode === "existing" && customer?.mode === "existing" && (
            <CustomerSearchSelect
              value={customer.customerId}
              onChange={(customerId) =>
                onAssignmentChange(platformTenantId, { mode: "existing", customerId })
              }
            />
          )}

          {mode === "create" && customer?.mode === "create" && (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-1 sm:col-span-2">
                <Label className="text-xs">客户名称</Label>
                <Input
                  value={customer.name}
                  onChange={(e) =>
                    onAssignmentChange(platformTenantId, { mode: "create", name: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">客户类型</Label>
                <Select
                  value={customer.type}
                  onValueChange={(v) =>
                    onAssignmentChange(platformTenantId, {
                      mode: "create",
                      type: v as "B" | "C",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="B">B 端（企业）</SelectItem>
                    <SelectItem value="C">C 端（个人）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">联系人</Label>
                <Input
                  value={customer.contactPerson}
                  onChange={(e) =>
                    onAssignmentChange(platformTenantId, {
                      mode: "create",
                      contactPerson: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid gap-1 sm:col-span-2">
                <Label className="text-xs">联系电话</Label>
                <Input
                  value={customer.contactPhone}
                  onChange={(e) =>
                    onAssignmentChange(platformTenantId, {
                      mode: "create",
                      contactPhone: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          )}
        </div>
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
