"use client"

import { formatText } from "../../../_lib/display"
import { STAFF_DEPARTMENTS } from "@/lib/crm/staff-constants"
import { LocaleLink } from "@/lib/i18n/navigation"
import { trpc } from "@/lib/trpc/client"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
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
import { cn } from "@workspace/ui/lib/utils"
import { useParams } from "next/navigation"
import { useMemo, useState } from "react"

const FILTER_ALL = "all"

const importSourceLabels: Record<string, string> = {
  tenant_bill: "客户账单",
  baremetal: "裸金属订单",
}

const enrichmentSourceLabels: Record<string, string> = {
  auto_single: "自动（单项目）",
  auto_preset: "预置分成",
  manual_period: "账期手动",
}

function formatTenantType(type: string | null) {
  if (type === "internal") return "内部租户"
  if (type === "external") return "外部租户"
  return "—"
}

function formatCustomerType(type: string | null) {
  if (type === "B") return "B 端（企业）"
  if (type === "C") return "C 端（个人）"
  return "—"
}

function formatImportSources(sources: string[]) {
  if (sources.length === 0) return "—"
  return sources.map((s) => importSourceLabels[s] ?? s).join("、")
}

function parseTenantIdSearch(input: string): string[] {
  return [...new Set(input.split(/[,，]/).map((s) => s.trim()).filter(Boolean))]
}

function rowMatchesTenantIds(
  row: { tenant_platform_id: string; tenant_id: string | null },
  tenantIds: string[],
): boolean {
  if (tenantIds.length === 0) return true
  return tenantIds.some(
    (id) => row.tenant_platform_id === id || row.tenant_id === id,
  )
}

export default function FinanceImportTenantBindingsPage() {
  const params = useParams<{ id: string }>()
  const id = params.id

  const [tenantType, setTenantType] = useState<string>(FILTER_ALL)
  const [customerType, setCustomerType] = useState<string>(FILTER_ALL)
  const [staffId, setStaffId] = useState<string>(FILTER_ALL)
  const [department, setDepartment] = useState<string>(FILTER_ALL)
  const [tenantIdSearch, setTenantIdSearch] = useState("")

  const { data: period } = trpc.finance.periods.getById.useQuery(
    { id: id ?? "" },
    { enabled: Boolean(id) },
  )

  const { data: activeStaff = [] } = trpc.crm.staff.listActive.useQuery(undefined, {
    enabled: Boolean(id),
  })

  const { data: rows = [], isLoading } = trpc.finance.periods.listImportTenantBindings.useQuery(
    {
      billingPeriodId: id ?? "",
      tenantType:
        tenantType === FILTER_ALL
          ? undefined
          : (tenantType as "internal" | "external"),
      customerType:
        customerType === FILTER_ALL ? undefined : (customerType as "B" | "C"),
      staffId: staffId === FILTER_ALL ? undefined : staffId,
      department: department === FILTER_ALL ? undefined : department,
    },
    { enabled: Boolean(id) },
  )

  const staffOptions = useMemo(() => {
    const seen = new Set<string>()
    const sortByName = (a: { name: string }, b: { name: string }) =>
      a.name.localeCompare(b.name, "zh-CN")

    const fromRows = rows
      .filter((r) => r.staff_id && r.account_manager_name)
      .map((r) => ({ id: r.staff_id!, name: r.account_manager_name! }))
      .filter((s) => {
        if (seen.has(s.id)) return false
        seen.add(s.id)
        return true
      })
    if (fromRows.length > 0) {
      return fromRows.sort(sortByName)
    }
    return activeStaff
      .map((s) => ({ id: s.id, name: s.display_name }))
      .filter((s) => s.name.length > 0)
      .sort(sortByName)
  }, [rows, activeStaff])

  const tenantIdFilters = useMemo(
    () => parseTenantIdSearch(tenantIdSearch),
    [tenantIdSearch],
  )

  const displayRows = useMemo(
    () => rows.filter((r) => rowMatchesTenantIds(r, tenantIdFilters)),
    [rows, tenantIdFilters],
  )

  const hasActiveFilters =
    tenantType !== FILTER_ALL ||
    customerType !== FILTER_ALL ||
    staffId !== FILTER_ALL ||
    department !== FILTER_ALL ||
    tenantIdFilters.length > 0

  if (!id) {
    return (
      <div className="bg-background p-4 md:p-6">
        <p className="text-muted-foreground">无效账期 ID</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="bg-background p-4 md:p-6">
        <p className="text-muted-foreground">加载中…</p>
      </div>
    )
  }

  return (
    <div className="bg-background p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <LocaleLink href={`/finance/${id}/cost`}>← 成本毛利</LocaleLink>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <LocaleLink href={`/finance/${id}/cost/source-lines`}>查看中间表</LocaleLink>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>租户项目映射 · {period?.period_code ?? id}</CardTitle>
          <CardDescription>
            导入的客户账单详情与裸金属订单中的平台租户 ID，与 CRM 项目、客户经理的对应关系（
            billing_period_tenant_project_enrichment）
            {period
              ? ` · 账期 ${period.period_start} ~ ${period.period_end}`
              : null}
            · 共 {displayRows.length} 行
            {tenantIdFilters.length > 0 && rows.length !== displayRows.length
              ? `（已筛选，共 ${rows.length} 行）`
              : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              className="max-w-md"
              placeholder="租户 ID 搜索，多个以逗号分隔（平台租户 ID 或 CRM 租户 ID）"
              value={tenantIdSearch}
              onChange={(e) => setTenantIdSearch(e.target.value)}
            />

            <Select value={tenantType} onValueChange={setTenantType}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="租户类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>全部租户类型</SelectItem>
                <SelectItem value="internal">内部租户</SelectItem>
                <SelectItem value="external">外部租户</SelectItem>
              </SelectContent>
            </Select>

            <Select value={customerType} onValueChange={setCustomerType}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="客户类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>全部客户类型</SelectItem>
                <SelectItem value="B">B 端（企业）</SelectItem>
                <SelectItem value="C">C 端（个人）</SelectItem>
              </SelectContent>
            </Select>

            <Select value={staffId} onValueChange={setStaffId}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="客户经理" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>全部客户经理</SelectItem>
                {staffOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="所属部门" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={FILTER_ALL}>全部部门</SelectItem>
                {STAFF_DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasActiveFilters ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTenantType(FILTER_ALL)
                  setCustomerType(FILTER_ALL)
                  setStaffId(FILTER_ALL)
                  setDepartment(FILTER_ALL)
                  setTenantIdSearch("")
                }}
              >
                清除筛选
              </Button>
            ) : null}
          </div>

          {displayRows.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {hasActiveFilters
                ? "当前筛选条件下无匹配数据。"
                : "暂无映射数据。请先导入客户账单详情或裸金属订单。"}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-28">平台租户 ID</TableHead>
                    <TableHead className="min-w-28">导入来源</TableHead>
                    <TableHead className="min-w-24">租户类型</TableHead>
                    <TableHead className="min-w-24">客户类型</TableHead>
                    <TableHead className="min-w-32">租户名称</TableHead>
                    <TableHead className="min-w-32">客户全称</TableHead>
                    <TableHead className="min-w-32">项目名称</TableHead>
                    <TableHead className="min-w-28">客户经理</TableHead>
                    <TableHead className="min-w-24">经理部门</TableHead>
                    <TableHead className="min-w-24">项目归属部门</TableHead>
                    <TableHead className="min-w-20 text-right">分成 %</TableHead>
                    <TableHead className="min-w-28">补全来源</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayRows.map((r) => (
                    <TableRow
                      key={`${r.tenant_platform_id}-${r.project_id ?? "none"}`}
                      className={cn(!r.project_id && "bg-muted/30")}
                    >
                      <TableCell className="font-mono text-xs">
                        {formatText(r.tenant_platform_id)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatImportSources(r.import_sources)}
                      </TableCell>
                      <TableCell>{formatTenantType(r.tenant_type)}</TableCell>
                      <TableCell>{formatCustomerType(r.customer_type)}</TableCell>
                      <TableCell>{formatText(r.tenant_name)}</TableCell>
                      <TableCell>{formatText(r.customer_full_name)}</TableCell>
                      <TableCell>{formatText(r.project_name)}</TableCell>
                      <TableCell>{formatText(r.account_manager_name)}</TableCell>
                      <TableCell>{formatText(r.staff_department)}</TableCell>
                      <TableCell>{formatText(r.project_revenue_department)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatText(r.allocation_percent)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.enrichment_source
                          ? (enrichmentSourceLabels[r.enrichment_source] ??
                            r.enrichment_source)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
