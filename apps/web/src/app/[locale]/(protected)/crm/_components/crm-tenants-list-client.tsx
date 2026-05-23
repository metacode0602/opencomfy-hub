"use client"

import * as React from "react"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { LocaleLink } from "@/lib/i18n/navigation"
import { trpc } from "@/lib/trpc/client"
import { IconEye, IconPlus, IconUpload } from "@tabler/icons-react"
import { CrmTenantImportDialog } from "./crm-tenant-import-dialog"
import { CrmPlatformTenantImportDialog } from "./crm-platform-tenant-import-dialog"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { useListPagination } from "@/hooks/use-list-pagination"
import { ListPagination } from "@/components/shared/list-pagination"

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

/** 列表展示：遮挡手机号中间 4 位，如 13812345678 → 138****5678 */
function maskPhoneMiddle(raw?: string | null): string {
  if (!raw?.trim()) return "—"
  const digits = raw.replace(/\D/g, "")
  const local =
    digits.length === 13 && digits.startsWith("86")
      ? digits.slice(2)
      : digits.length >= 11
        ? digits.slice(-11)
        : digits
  if (local.length === 11) {
    const prefix =
      digits.length === 13 && digits.startsWith("86") ? "+86 " : ""
    return `${prefix}${local.slice(0, 3)}****${local.slice(7)}`
  }
  if (digits.length >= 7) {
    const start = Math.floor((digits.length - 4) / 2)
    return `${digits.slice(0, start)}****${digits.slice(start + 4)}`
  }
  return raw.trim()
}

export function CrmTenantsListClient() {
  const utils = trpc.useUtils()
  const [searchInput, setSearchInput] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [platformImportOpen, setPlatformImportOpen] = React.useState(false)
  const [excelImportOpen, setExcelImportOpen] = React.useState(false)

  React.useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => window.clearTimeout(t)
  }, [searchInput])

  const { data: tenants = [], isLoading, isFetching } = trpc.crm.tenants.list.useQuery(
    { search: search || undefined },
    { placeholderData: (prev) => prev },
  )

  const onImportSuccess = React.useCallback(() => {
    void utils.crm.tenants.list.invalidate()
  }, [utils])

  const pagination = useListPagination(tenants, {
    resetDeps: [search],
  })

  return (
    <div className="bg-background p-4 md:p-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>计费租户</CardTitle>
            <CardDescription>
              平台计费账户与客户关联；支持 Excel 批量导入（共 {tenants.length} 条
              {isFetching && !isLoading ? "，刷新中…" : ""}）
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              type="button"
              onClick={() => setPlatformImportOpen(true)}
            >
              <IconPlus className="size-4" />
              导入租户
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              type="button"
              onClick={() => setExcelImportOpen(true)}
            >
              <IconUpload className="size-4" />
              导入 Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="搜索：平台租户ID / 租户名 / 手机号 / 客户名"
            className="max-w-md"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>平台租户ID</TableHead>
                  <TableHead>租户名</TableHead>
                  <TableHead>租户手机</TableHead>
                  <TableHead>客户</TableHead>
                  <TableHead>联系人</TableHead>
                  <TableHead className="text-right">余额</TableHead>
                  <TableHead>欠费时间</TableHead>
                  <TableHead>平台注册时间</TableHead>
                  <TableHead>导入时间</TableHead>
                  <TableHead className="text-right">授信额度</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-muted-foreground py-8 text-center text-sm">
                      加载中…
                    </TableCell>
                  </TableRow>
                ) : tenants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-muted-foreground py-8 text-center text-sm">
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  pagination.items.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-sm">{t.platformTenantId ?? "—"}</TableCell>
                      <TableCell>{t.name}</TableCell>
                      <TableCell>{maskPhoneMiddle(t.phone)}</TableCell>
                      <TableCell>
                        <LocaleLink
                          href={`/crm/customers/${t.customerId}`}
                          className="text-primary hover:underline"
                        >
                          {t.customerName}
                        </LocaleLink>
                      </TableCell>
                      <TableCell className="text-sm">
                        {t.contactPerson || "—"}
                        {t.contactPhone ? (
                          <span className="text-muted-foreground block text-xs">
                            {maskPhoneMiddle(t.contactPhone)}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(t.balance)}</TableCell>
                      <TableCell className="text-sm">{formatDateTime(t.overdueAt)}</TableCell>
                      <TableCell className="text-sm">{formatDateTime(t.platformRegisteredAt)}</TableCell>
                      <TableCell className="text-sm">{formatDateTime(t.createdAt)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {t.creditLimit != null ? formatMoney(t.creditLimit) : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={t.status} />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" asChild>
                          <LocaleLink href={`/crm/tenants/${t.id}`} title="查看详情">
                            <IconEye className="size-4" />
                          </LocaleLink>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <ListPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            pageSize={pagination.pageSize}
            onPageChange={pagination.setPage}
            className="border-t-0 px-0"
          />
        </CardContent>
      </Card>

      {platformImportOpen ? (
        <CrmPlatformTenantImportDialog
          open
          onOpenChange={setPlatformImportOpen}
          onSuccess={onImportSuccess}
        />
      ) : null}
      {excelImportOpen ? (
        <CrmTenantImportDialog
          open
          onOpenChange={setExcelImportOpen}
          onSuccess={onImportSuccess}
        />
      ) : null}
    </div>
  )
}
