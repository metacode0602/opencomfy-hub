"use client"

import { formatMoney, formatText } from "../../../../_lib/display"
import { enrichProjectCostGroups } from "@/lib/finance/project-cost-enrichment"
import { downloadProjectCostExcel } from "@/lib/finance/project-cost-export"
import { toMoneyString } from "@/lib/finance/income-row-utils"
import {
  computeProjectCostFromSourceLines,
  collectTenantPlatformIdsFromSourceLines,
  parseTenantPlatformIds,
  sumProjectCostGroups,
  type ProjectCostMetricRow,
  type ProjectCostResult,
  type ProjectCostTenantGroup,
} from "@/lib/finance/project-cost-from-source-lines"
import type { CostSourceLineDto } from "@/lib/server/dataaccess/finance/list-cost-source-lines"
import { trpc } from "@/lib/trpc/client"
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
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { ChevronDown, ChevronRight, Download } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

type ProjectCostDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceLines: CostSourceLineDto[]
  periodCode: string
}

function MetricCells({ row }: { row: ProjectCostMetricRow }) {
  return (
    <>
      <TableCell className="text-right tabular-nums">
        {formatMoney(toMoneyString(row.balanceConsumption))}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatMoney(toMoneyString(row.balanceCardHours))}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatMoney(toMoneyString(row.voucherCardHours))}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatMoney(toMoneyString(row.confirmedRevenueExclTax))}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatMoney(toMoneyString(row.soldDurationCostExclTax))}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatMoney(toMoneyString(row.giftedDurationCostExclTax))}
      </TableCell>
      <TableCell className="text-right tabular-nums font-medium">
        {formatMoney(toMoneyString(row.grossProfit))}
      </TableCell>
    </>
  )
}

function ProjectCostGroupRows({
  group,
  expanded,
  onToggle,
}: {
  group: ProjectCostTenantGroup
  expanded: boolean
  onToggle: () => void
}) {
  const hasDetails = group.detailRows.length > 0

  return (
    <>
      <TableRow className="bg-card">
        <TableCell className="p-1 align-middle">
          {hasDetails ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              aria-expanded={expanded}
              aria-label={expanded ? "收起分项" : "展开分项"}
              onClick={onToggle}
            >
              {expanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </Button>
          ) : (
            <span className="inline-flex size-8 items-center justify-center text-muted-foreground">
              ·
            </span>
          )}
        </TableCell>
        <TableCell className="font-medium">{formatText(group.tenantName)}</TableCell>
        <TableCell className="font-mono text-xs">
          {formatText(group.tenantPlatformId)}
        </TableCell>
        <TableCell />
        <TableCell />
        <TableCell />
        <MetricCells row={group.sumRow} />
      </TableRow>

      {expanded &&
        hasDetails &&
        group.detailRows.map((detail, index) => (
          <TableRow
            key={`${group.tenantPlatformId}-${detail.region}-${detail.cardType}-${index}`}
            className="border-l-2 border-l-primary/40 bg-muted/30"
          >
            <TableCell />
            <TableCell className="text-muted-foreground text-sm">分项</TableCell>
            <TableCell />
            <TableCell>{formatText(detail.dataCenterName)}</TableCell>
            <TableCell className="font-mono text-xs">
              {formatText(detail.region)}
            </TableCell>
            <TableCell>{formatText(detail.cardType)}</TableCell>
            <MetricCells row={detail} />
          </TableRow>
        ))}
    </>
  )
}

function ProjectCostResults({
  result,
  periodCode,
}: {
  result: ProjectCostResult
  periodCode: string
}) {
  const [openTenants, setOpenTenants] = useState<Set<string>>(() => new Set())
  const grandTotal = useMemo(
    () => sumProjectCostGroups(result.groups),
    [result.groups],
  )

  function toggleTenant(tenantPlatformId: string) {
    setOpenTenants((prev) => {
      const next = new Set(prev)
      if (next.has(tenantPlatformId)) next.delete(tenantPlatformId)
      else next.add(tenantPlatformId)
      return next
    })
  }

  function handleExportExcel() {
    const ok = downloadProjectCostExcel({
      groups: result.groups,
      periodCode,
    })
    if (ok) toast.success("项目成本毛利 Excel 已下载")
    else toast.error("导出失败")
  }

  if (result.groups.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        未找到匹配租户的中间表数据，请检查平台租户 ID 是否正确。
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {(result.unmatchedTenantPlatformIds.length > 0 ||
        result.skippedLineCount > 0) && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          {result.unmatchedTenantPlatformIds.length > 0 ? (
            <p>
              以下 ID 未匹配到中间表数据：
              {result.unmatchedTenantPlatformIds.join("、")}
            </p>
          ) : null}
          {result.skippedLineCount > 0 ? (
            <p>
              有 {result.skippedLineCount}{" "}
              行因缺少定价配置未纳入计算。
            </p>
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          共 {result.groups.length} 个项目，计算方式与成本毛利页客户经理汇总一致。
        </p>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={handleExportExcel}
        >
          <Download className="size-4" />
          导出 Excel
        </Button>
      </div>

      <div className="overflow-x-auto overflow-y-auto max-h-[min(55vh,560px)] rounded-md border">
        <Table className="min-w-max">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 p-2" aria-label="展开分项" />
              <TableHead className="min-w-40 whitespace-nowrap">项目</TableHead>
              <TableHead className="min-w-28 whitespace-nowrap">平台租户 ID</TableHead>
              <TableHead className="min-w-28 whitespace-nowrap">机房名称</TableHead>
              <TableHead className="min-w-24 whitespace-nowrap">区域</TableHead>
              <TableHead className="min-w-24 whitespace-nowrap">卡型</TableHead>
              <TableHead className="min-w-24 whitespace-nowrap text-right">
                余额消费
              </TableHead>
              <TableHead className="min-w-24 whitespace-nowrap text-right">
                余额卡时
              </TableHead>
              <TableHead className="min-w-24 whitespace-nowrap text-right">
                券卡时
              </TableHead>
              <TableHead className="min-w-28 whitespace-nowrap text-right">
                确认收入（不含税）
              </TableHead>
              <TableHead className="min-w-28 whitespace-nowrap text-right">
                售出时长成本（不含税）
              </TableHead>
              <TableHead className="min-w-28 whitespace-nowrap text-right">
                赠送时长成本（不含税）
              </TableHead>
              <TableHead className="min-w-24 whitespace-nowrap text-right">
                毛利
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.groups.map((group) => (
              <ProjectCostGroupRows
                key={group.tenantPlatformId}
                group={group}
                expanded={openTenants.has(group.tenantPlatformId)}
                onToggle={() => toggleTenant(group.tenantPlatformId)}
              />
            ))}
            {result.groups.length > 1 ? (
              <TableRow className="bg-muted/50 font-medium">
                <TableCell />
                <TableCell colSpan={5}>合计</TableCell>
                <MetricCells row={grandTotal} />
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export function ProjectCostDialog({
  open,
  onOpenChange,
  sourceLines,
  periodCode,
}: ProjectCostDialogProps) {
  const [tenantIdInput, setTenantIdInput] = useState("")
  const [allProjects, setAllProjects] = useState(false)
  const [result, setResult] = useState<ProjectCostResult | null>(null)
  const [computing, setComputing] = useState(false)
  const utils = trpc.useUtils()

  const allProjectCount = useMemo(
    () => collectTenantPlatformIdsFromSourceLines(sourceLines).length,
    [sourceLines],
  )

  async function finalizeResult(next: ProjectCostResult) {
    if (next.groups.length === 0) {
      setResult(next)
      return next
    }

    try {
      const metadata = await utils.finance.periods.listProjectCostMetadata.fetch({
        tenantPlatformIds: next.groups.map((group) => group.tenantPlatformId),
        settlementMonth: periodCode,
      })
      const enriched = {
        ...next,
        groups: enrichProjectCostGroups(next.groups, metadata),
      }
      setResult(enriched)
      return enriched
    } catch {
      setResult(next)
      return next
    }
  }

  async function handleCompute() {
    setComputing(true)
    try {
      if (allProjects) {
        if (sourceLines.length === 0) {
          toast.error("当前中间表暂无数据")
          return
        }

        const next = computeProjectCostFromSourceLines({
          lines: sourceLines,
          allProjects: true,
        })

        if (next.groups.length === 0) {
          setResult(next)
          toast.error("未找到可计算的项目成本数据")
          return
        }

        await finalizeResult(next)
        toast.success(`已计算全部 ${next.groups.length} 个项目的成本毛利`)
        return
      }

      const tenantPlatformIds = parseTenantPlatformIds(tenantIdInput)
      if (tenantPlatformIds.length === 0) {
        toast.error("请输入至少一个平台租户 ID，或勾选「当前全部项目」")
        return
      }

      const next = computeProjectCostFromSourceLines({
        lines: sourceLines,
        tenantPlatformIds,
      })

      if (next.groups.length === 0) {
        setResult(next)
        toast.error("未找到匹配租户的中间表数据")
        return
      }

      await finalizeResult(next)
      toast.success(`已计算 ${next.groups.length} 个项目的成本毛利`)
    } finally {
      setComputing(false)
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setResult(null)
      setTenantIdInput("")
      setAllProjects(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[min(96vw,1440px)] max-w-[96vw] flex-col gap-4 overflow-hidden sm:max-w-[96vw]">
        <DialogHeader className="shrink-0">
          <DialogTitle>项目成本 · {periodCode}</DialogTitle>
          <DialogDescription>
            可指定平台租户 ID，或勾选「当前全部项目」基于中间表实时计算成本与毛利，不写入数据库。
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          <div className="flex items-start gap-2 rounded-md border px-3 py-2">
            <Checkbox
              id="project-cost-all-projects"
              checked={allProjects}
              onCheckedChange={(checked) => {
                setAllProjects(checked === true)
                setResult(null)
              }}
            />
            <div className="space-y-1">
              <Label
                htmlFor="project-cost-all-projects"
                className="cursor-pointer font-medium"
              >
                当前全部项目
              </Label>
              <p className="text-muted-foreground text-xs">
                自动包含中间表中的 {allProjectCount} 个平台租户，无需手动输入 ID
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-cost-tenant-ids">平台租户 ID</Label>
            <Textarea
              id="project-cost-tenant-ids"
              value={tenantIdInput}
              onChange={(event) => setTenantIdInput(event.target.value)}
              placeholder="例如：100001, 100002&#10;100003"
              rows={4}
              disabled={allProjects}
              className="font-mono text-sm"
            />
          </div>

          {result ? <ProjectCostResults result={result} periodCode={periodCode} /> : null}
        </div>

        <DialogFooter className="shrink-0 gap-2 sm:justify-between">
          <p className="text-muted-foreground text-xs">
            {allProjects
              ? "将计算中间表内全部平台租户"
              : "支持匹配平台租户 ID 或 CRM 租户 ID"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              关闭
            </Button>
            <Button onClick={() => void handleCompute()} disabled={computing}>
              {computing ? "计算中…" : "计算"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
