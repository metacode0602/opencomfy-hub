"use client"

import * as React from "react"
import { Badge } from "@workspace/ui/components/badge"
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
import { Textarea } from "@workspace/ui/components/textarea"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { IconDownload, IconLoader2, IconPlus, IconSearch } from "@tabler/icons-react"
import { toast } from "sonner"

import { shanghaiUsageMonth } from "@/lib/crm/balance-snapshot-utils"
import {
  defaultCreateCustomerFromPlatform,
  PLATFORM_TENANT_IMPORT_MAX_IDS,
} from "@/lib/crm/platform-tenant-import-utils"
import { downloadTenantRechargeBalanceQueryExcel } from "@/lib/crm/tenant-recharge-balance-query-export"
import {
  chunkArray,
  TENANT_RECHARGE_BALANCE_QUERY_MAX_IDS,
} from "@/lib/crm/tenant-recharge-balance-query-utils"
import { trpc } from "@/lib/trpc/client"
import type { PlatformImportCommitItem } from "@/lib/types/platform-tenant-import"
import type { TenantRechargeBalanceQueryResult } from "@/lib/types/tenant-recharge-balance-query"

type Phase = "idle" | "querying" | "results" | "importing"

function formatMoney(n: number) {
  return `¥${n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDateTime(iso?: string) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString("zh-CN", { hour12: false })
  } catch {
    return iso
  }
}

function defaultSelectedImportIds(rows: TenantRechargeBalanceQueryResult["rows"]) {
  return rows.filter((row) => !row.found).map((row) => row.platformTenantId)
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported?: () => void
}

export function CrmTenantRechargeBalanceQueryDialog({ open, onOpenChange, onImported }: Props) {
  const queryMutation = trpc.crm.tenants.queryRechargeBalance.useMutation()
  const previewMutation = trpc.crm.tenants.previewPlatformImport.useMutation()
  const commitMutation = trpc.crm.tenants.commitPlatformImport.useMutation()

  const [phase, setPhase] = React.useState<Phase>("idle")
  const [rawTenantIds, setRawTenantIds] = React.useState("")
  const [usageMonth, setUsageMonth] = React.useState(() => shanghaiUsageMonth())
  const [result, setResult] = React.useState<TenantRechargeBalanceQueryResult | null>(null)
  const [selectedImportIds, setSelectedImportIds] = React.useState<string[]>([])

  const loading =
    phase === "querying" ||
    phase === "importing" ||
    queryMutation.isPending ||
    previewMutation.isPending ||
    commitMutation.isPending

  const notFoundRows = React.useMemo(
    () => result?.rows.filter((row) => !row.found) ?? [],
    [result],
  )

  const allNotFoundSelected =
    notFoundRows.length > 0 &&
    notFoundRows.every((row) => selectedImportIds.includes(row.platformTenantId))

  const reset = React.useCallback(() => {
    setPhase("idle")
    setRawTenantIds("")
    setUsageMonth(shanghaiUsageMonth())
    setResult(null)
    setSelectedImportIds([])
  }, [])

  React.useEffect(() => {
    if (open) return
    reset()
  }, [open, reset])

  const runQuery = React.useCallback(
    async (params: { rawTenantIds: string; usageMonth: string }) => {
      const data = await queryMutation.mutateAsync(params)
      setResult(data)
      setSelectedImportIds(defaultSelectedImportIds(data.rows))
      setPhase("results")
      return data
    },
    [queryMutation],
  )

  const importPlatformTenants = React.useCallback(
    async (platformTenantIds: string[]) => {
      if (platformTenantIds.length === 0) return 0

      let importedCount = 0
      const missingOnPlatform: string[] = []

      for (const chunk of chunkArray(platformTenantIds, PLATFORM_TENANT_IMPORT_MAX_IDS)) {
        const preview = await previewMutation.mutateAsync({ platformTenantIds: chunk })

        for (const id of preview.missingPlatformIds) {
          missingOnPlatform.push(id)
        }

        const commitItems: PlatformImportCommitItem[] = []
        for (const item of preview.items) {
          if (item.missingOnPlatform) continue
          if (item.local) {
            importedCount += 1
            continue
          }
          commitItems.push({
            platformTenantId: item.platformTenantId,
            customer: defaultCreateCustomerFromPlatform(item),
          })
        }

        if (commitItems.length === 0) continue

        const commitResult = await commitMutation.mutateAsync({ items: commitItems })
        importedCount += commitResult.importedTenants.length
      }

      if (missingOnPlatform.length > 0) {
        toast.warning(`有 ${missingOnPlatform.length} 个 ID 平台未返回`)
      }

      return importedCount
    },
    [previewMutation, commitMutation],
  )

  const onQuery = async () => {
    if (!rawTenantIds.trim()) {
      toast.error("请输入至少一个平台租户 ID")
      return
    }
    if (!usageMonth) {
      toast.error("请选择查询月份")
      return
    }

    setPhase("querying")
    try {
      const data = await runQuery({ rawTenantIds, usageMonth })
      const { summary } = data
      if (summary.matched === 0) {
        toast.info(`查询完成：输入 ${summary.total} 个租户，均未匹配`)
      } else {
        toast.success(
          `查询完成：输入 ${summary.total} 个租户，匹配 ${summary.matched} 个，未找到 ${summary.notFound} 个`,
        )
      }
    } catch (e) {
      setPhase("idle")
      toast.error(e instanceof Error ? e.message : "查询失败，请稍后重试")
    }
  }

  const onImportSelected = async () => {
    if (selectedImportIds.length === 0) {
      toast.error("请至少选择一个未匹配的租户")
      return
    }

    setPhase("importing")
    try {
      const importedCount = await importPlatformTenants(selectedImportIds)
      if (importedCount === 0) {
        toast.error("未能导入任何租户，请确认平台 ID 是否有效")
        setPhase("results")
        return
      }

      await runQuery({ rawTenantIds, usageMonth })
      onImported?.()
      toast.success(`已导入 ${importedCount} 个租户，查询结果已刷新`)
    } catch (e) {
      setPhase("results")
      toast.error(e instanceof Error ? e.message : "导入失败")
    }
  }

  const toggleImportRow = (platformTenantId: string, checked: boolean) => {
    setSelectedImportIds((prev) =>
      checked
        ? prev.includes(platformTenantId)
          ? prev
          : [...prev, platformTenantId]
        : prev.filter((id) => id !== platformTenantId),
    )
  }

  const toggleAllNotFound = (checked: boolean) => {
    setSelectedImportIds(checked ? notFoundRows.map((row) => row.platformTenantId) : [])
  }

  const onTenantIdsChange = (value: string) => {
    setRawTenantIds(value)
    if (result) {
      setResult(null)
      setSelectedImportIds([])
      setPhase("idle")
    }
  }

  const onUsageMonthChange = (value: string) => {
    setUsageMonth(value)
    if (result) {
      setResult(null)
      setSelectedImportIds([])
      setPhase("idle")
    }
  }

  const onDownloadExcel = () => {
    if (!result || result.rows.length === 0) {
      toast.error("暂无数据可导出")
      return
    }
    const ok = downloadTenantRechargeBalanceQueryExcel({
      rows: result.rows,
      usageMonth: result.usageMonth,
    })
    if (ok) {
      toast.success("Excel 已下载")
    } else {
      toast.error("导出失败")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] min-w-[50vw] max-w-6xl flex-col gap-4 overflow-hidden p-4 sm:w-full sm:p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle>租户充值与余额查询</DialogTitle>
          <DialogDescription>
            输入多个平台租户 ID，选择月份，查询该月充值总额与当前账户余额。未在系统中的租户可勾选后导入。
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="tenant-recharge-balance-query-ids">平台租户 ID</Label>
              <Textarea
                id="tenant-recharge-balance-query-ids"
                placeholder={`输入租户 ID，支持逗号、空格或换行分隔，单次最多 ${TENANT_RECHARGE_BALANCE_QUERY_MAX_IDS} 个`}
                value={rawTenantIds}
                disabled={loading}
                className="h-28 resize-none overflow-y-auto"
                onChange={(e) => onTenantIdsChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-recharge-balance-query-month">查询月份</Label>
              <Input
                id="tenant-recharge-balance-query-month"
                type="month"
                className="w-full sm:w-[160px]"
                value={usageMonth}
                disabled={loading}
                onChange={(e) => onUsageMonthChange(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            {result && notFoundRows.length > 0 ? (
              <Button
                type="button"
                variant="secondary"
                disabled={loading || selectedImportIds.length === 0}
                onClick={() => void onImportSelected()}
              >
                {phase === "importing" ? (
                  <IconLoader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <IconPlus className="mr-2 size-4" />
                )}
                导入（{selectedImportIds.length}）
              </Button>
            ) : null}
            {result && result.rows.length > 0 ? (
              <Button type="button" variant="outline" disabled={loading} onClick={onDownloadExcel}>
                <IconDownload className="mr-2 size-4" />
                导出 Excel
              </Button>
            ) : null}
            <Button type="button" disabled={loading} onClick={() => void onQuery()}>
              {phase === "querying" ? (
                <IconLoader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <IconSearch className="mr-2 size-4" />
              )}
              查询
            </Button>
          </div>

          {result ? (
            <div className="space-y-4">
              <Alert>
                <AlertDescription className="text-sm">
                  账期 {result.usageMonth} · 输入 {result.summary.total} 个租户 · 匹配{" "}
                  {result.summary.matched} 个 · 未找到 {result.summary.notFound} 个 · 充值合计{" "}
                  {formatMoney(result.summary.monthlyRechargeGrandTotal)} · 余额合计{" "}
                  {formatMoney(result.summary.currentBalanceGrandTotal)}
                </AlertDescription>
              </Alert>

              {result.rows.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">暂无查询结果</p>
              ) : (
                <div className="min-w-0 rounded-md border">
                  <div className="overflow-x-auto overscroll-x-contain">
                    <Table className="min-w-[72rem] w-max">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="sticky left-0 z-10 w-10 bg-background">
                            {notFoundRows.length > 0 ? (
                              <Checkbox
                                checked={allNotFoundSelected}
                                disabled={loading}
                                aria-label="全选未匹配租户"
                                onCheckedChange={(checked) => toggleAllNotFound(checked === true)}
                              />
                            ) : null}
                          </TableHead>
                          <TableHead className="min-w-[7rem] whitespace-nowrap">平台租户 ID</TableHead>
                          <TableHead className="min-w-[8rem]">租户名称</TableHead>
                          <TableHead className="min-w-[10rem]">客户全称</TableHead>
                          <TableHead className="min-w-[8rem]">项目标签</TableHead>
                          <TableHead className="min-w-[7rem] whitespace-nowrap text-right">
                            {result.usageMonth} 充值总额
                          </TableHead>
                          <TableHead className="min-w-[7rem] whitespace-nowrap text-right">当前余额</TableHead>
                          <TableHead className="min-w-[9rem] whitespace-nowrap">首次充值时间</TableHead>
                          <TableHead className="min-w-[5rem] whitespace-nowrap">状态</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.rows.map((row) => (
                          <TableRow key={row.platformTenantId}>
                            <TableCell className="sticky left-0 z-10 bg-background">
                              {!row.found ? (
                                <Checkbox
                                  checked={selectedImportIds.includes(row.platformTenantId)}
                                  disabled={loading}
                                  aria-label={`选择导入租户 ${row.platformTenantId}`}
                                  onCheckedChange={(checked) =>
                                    toggleImportRow(row.platformTenantId, checked === true)
                                  }
                                />
                              ) : null}
                            </TableCell>
                            <TableCell className="font-mono text-sm whitespace-nowrap">
                              {row.platformTenantId}
                            </TableCell>
                            <TableCell className="max-w-[12rem] truncate" title={row.tenantName}>
                              {row.found ? (row.tenantName ?? "—") : "—"}
                            </TableCell>
                            <TableCell className="max-w-[14rem] truncate" title={row.customerName}>
                              {row.found ? (row.customerName ?? "—") : "—"}
                            </TableCell>
                            <TableCell className="min-w-[8rem]">
                              {row.found && row.projectTags.length > 0 ? (
                                <div className="flex flex-wrap items-center gap-1">
                                  {row.projectTags.map((tag) => (
                                    <Badge key={tag.id} variant="secondary" className="font-normal">
                                      {tag.name}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right tabular-nums">
                              {row.found ? formatMoney(row.monthlyRechargeTotal) : "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right tabular-nums">
                              {row.found ? formatMoney(row.currentBalance) : "—"}
                            </TableCell>
                            <TableCell className="text-sm whitespace-nowrap">
                              {row.found ? formatDateTime(row.firstRechargeAt) : "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {row.found ? (
                                <Badge variant="secondary">已匹配</Badge>
                              ) : (
                                <Badge variant="outline">未找到</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter className="shrink-0">
          <Button type="button" variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
