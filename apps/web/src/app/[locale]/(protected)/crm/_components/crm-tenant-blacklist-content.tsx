"use client"

import * as React from "react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
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
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { ListPagination } from "@/components/shared/list-pagination"
import { formatBlacklistStatus } from "@/lib/crm/tenant-blacklist-utils"
import { LocaleLink } from "@/lib/i18n/navigation"
import { trpc } from "@/lib/trpc/client"
import { IconEye, IconRefresh } from "@tabler/icons-react"
import { AlertCircle, Loader2 } from "lucide-react"
import { CrmTenantBlacklistSyncDialog } from "./crm-tenant-blacklist-sync-dialog"

const ALL_STATUS = "__all__"
const PAGE_SIZE = 20

function formatDateTime(iso?: string) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString("zh-CN", { hour12: false })
  } catch {
    return iso
  }
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: string }).message)
  }
  return "加载失败"
}

function StatusBadge({ status }: { status: string }) {
  const label = formatBlacklistStatus(status)
  if (status === "Open") {
    return <Badge variant="destructive">{label}</Badge>
  }
  if (status === "Close") {
    return <Badge variant="secondary">{label}</Badge>
  }
  return <Badge variant="outline">{label}</Badge>
}

export function CrmTenantBlacklistContent() {
  const [statusFilter, setStatusFilter] = React.useState(ALL_STATUS)
  const [startTime, setStartTime] = React.useState("")
  const [endTime, setEndTime] = React.useState("")
  const [platformTenantId, setPlatformTenantId] = React.useState("")
  const [tenantName, setTenantName] = React.useState("")
  const [applied, setApplied] = React.useState({
    status: ALL_STATUS,
    startTime: "",
    endTime: "",
    platformTenantId: "",
    tenantName: "",
  })
  const [page, setPage] = React.useState(1)
  const [syncOpen, setSyncOpen] = React.useState(false)

  const applyFilters = React.useCallback(() => {
    setApplied({
      status: statusFilter,
      startTime,
      endTime,
      platformTenantId: platformTenantId.trim(),
      tenantName: tenantName.trim(),
    })
    setPage(1)
  }, [statusFilter, startTime, endTime, platformTenantId, tenantName])

  const { data, isLoading, isFetching, isError, error, refetch } =
    trpc.crm.tenantBlacklist.list.useQuery(
      {
        status: applied.status === ALL_STATUS ? undefined : applied.status,
        startTime: applied.startTime || undefined,
        endTime: applied.endTime || undefined,
        platformTenantId: applied.platformTenantId || undefined,
        tenantName: applied.tenantName || undefined,
        page,
        pageSize: PAGE_SIZE,
      },
      { placeholderData: (prev) => prev },
    )

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE))

  return (
    <div className="bg-background p-4 md:p-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>租户黑名单</CardTitle>
            <CardDescription>
              本地共 {data?.activeCount ?? "—"} 条有效记录
              {data?.lastPullEndDate ? ` · 游标结束日 ${data.lastPullEndDate}` : ""}
              {data?.defaultSafetyDays != null ? ` · 默认滑动窗口 ${data.defaultSafetyDays} 天` : ""}
              {isFetching && !isLoading ? " · 刷新中…" : ""}
            </CardDescription>
          </div>
          <Button size="sm" className="gap-2" type="button" onClick={() => setSyncOpen(true)}>
            <IconRefresh className="size-4" />
            同步平台数据
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-[140px]">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_STATUS}>全部状态</SelectItem>
                <SelectItem value="Open">封禁中</SelectItem>
                <SelectItem value="Close">已解除</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              className="w-full lg:w-[160px]"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              aria-label="更新开始日期"
            />
            <Input
              type="date"
              className="w-full lg:w-[160px]"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              aria-label="更新结束日期"
            />
            <Input
              placeholder="平台租户 ID"
              className="w-full lg:w-[160px] font-mono text-sm"
              value={platformTenantId}
              onChange={(e) => setPlatformTenantId(e.target.value)}
            />
            <Input
              placeholder="平台租户名"
              className="w-full lg:max-w-[200px]"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
            />
            <Button type="button" variant="secondary" onClick={applyFilters}>
              查询
            </Button>
          </div>

          {isError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex flex-wrap items-center gap-3">
                <span>{getErrorMessage(error)}</span>
                <Button variant="outline" size="sm" onClick={() => void refetch()}>
                  重试
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>记录 ID</TableHead>
                      <TableHead>平台租户 ID</TableHead>
                      <TableHead>平台租户名</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>备注</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead>更新时间</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-muted-foreground py-12 text-center">
                          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                          加载中…
                        </TableCell>
                      </TableRow>
                    ) : !data?.items.length ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-muted-foreground py-12 text-center text-sm">
                          {data?.activeCount === 0
                            ? "暂无数据，请点击「同步平台数据」从平台拉取"
                            : "无匹配记录"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.items.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-mono text-sm">{row.platformBlacklistId}</TableCell>
                          <TableCell className="font-mono text-sm">{row.platformTenantId}</TableCell>
                          <TableCell>{row.platformTenantName ?? "—"}</TableCell>
                          <TableCell>
                            <StatusBadge status={row.status} />
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm" title={row.remark}>
                            {row.remark ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {formatDateTime(row.platformCreatedAt)}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {formatDateTime(row.platformUpdatedAt)}
                          </TableCell>
                          <TableCell>
                            {row.localTenantId ? (
                              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                <LocaleLink
                                  href={`/crm/tenants/${row.localTenantId}`}
                                  title="查看 CRM 计费租户"
                                >
                                  <IconEye className="size-4" />
                                </LocaleLink>
                              </Button>
                            ) : (
                              <span className="text-muted-foreground text-xs">未导入</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {(data?.total ?? 0) > 0 ? (
                <ListPagination
                  page={page}
                  totalPages={totalPages}
                  totalItems={data?.total ?? 0}
                  pageSize={PAGE_SIZE}
                  onPageChange={setPage}
                />
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <CrmTenantBlacklistSyncDialog
        open={syncOpen}
        onOpenChange={setSyncOpen}
        onSuccess={() => {
          setPage(1)
          void refetch()
        }}
      />
    </div>
  )
}
