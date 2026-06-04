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
import { LocaleLink } from "@/lib/i18n/navigation"
import { TENANT_PROJECT_IMPORT_TAG_NAMES } from "@/lib/crm/tenant-project-import-utils"
import { trpc } from "@/lib/trpc/client"
import { IconCalendarOff, IconEye, IconPlus, IconUpload } from "@tabler/icons-react"
import { CrmTenantImportDialog } from "./crm-tenant-import-dialog"
import { CrmPlatformTenantImportDialog } from "./crm-platform-tenant-import-dialog"
import {
  CrmTenantInternalSettingDialog,
  type TenantInternalSettingTarget,
} from "./crm-tenant-internal-setting-dialog"
import type { BillingTenantListItem } from "@/lib/types/billing-tenant"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { useListPagination } from "@/hooks/use-list-pagination"
import { ListPagination } from "@/components/shared/list-pagination"

const ALL_TAGS = "__all__"

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

function formatTenantType(type: "internal" | "external") {
  return type === "internal" ? "内部租户" : "外部租户"
}

function formatInternalExclusionSummary(t: BillingTenantListItem) {
  if (t.type !== "internal") return null
  if (!t.internalEffectiveFrom && !t.internalEffectiveTo) return "全历史排除"
  const from = t.internalEffectiveFrom ?? "…"
  const to = t.internalEffectiveTo ?? "…"
  return `${from}～${to}`
}

export function CrmTenantsListClient() {
  const utils = trpc.useUtils()
  const [searchInput, setSearchInput] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [tagFilter, setTagFilter] = React.useState(ALL_TAGS)
  const [platformImportOpen, setPlatformImportOpen] = React.useState(false)
  const [excelImportOpen, setExcelImportOpen] = React.useState(false)
  const [internalSettingTenant, setInternalSettingTenant] =
    React.useState<TenantInternalSettingTarget | null>(null)

  React.useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => window.clearTimeout(t)
  }, [searchInput])

  const { data: allTags = [] } = trpc.crm.projectTags.list.useQuery()
  const tagFilterOptions = React.useMemo(() => {
    const allowed = new Set<string>(TENANT_PROJECT_IMPORT_TAG_NAMES)
    return allTags.filter((tag) => allowed.has(tag.name))
  }, [allTags])

  const { data: tenants = [], isLoading, isFetching } = trpc.crm.tenants.list.useQuery(
    {
      search: search || undefined,
      tagId: tagFilter === ALL_TAGS ? undefined : tagFilter,
    },
    { placeholderData: (prev) => prev },
  )

  const onImportSuccess = React.useCallback(() => {
    void utils.crm.tenants.list.invalidate()
  }, [utils])

  const pagination = useListPagination(tenants, {
    resetDeps: [search, tagFilter],
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              placeholder="搜索：平台租户ID / 租户名 / 手机号 / 客户名"
              className="max-w-md"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="项目标签" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_TAGS}>全部标签</SelectItem>
                {tagFilterOptions.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    {tag.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>平台租户ID</TableHead>
                  <TableHead>租户名</TableHead>
                  <TableHead>租户类型</TableHead>
                  <TableHead>租户手机</TableHead>
                  <TableHead>客户</TableHead>
                  <TableHead>项目标签</TableHead>
                  <TableHead>联系人</TableHead>
                  <TableHead className="text-right">余额</TableHead>
                  <TableHead>欠费时间</TableHead>
                  <TableHead>平台注册时间</TableHead>
                  <TableHead>导入时间</TableHead>
                  <TableHead className="text-right">授信额度</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="w-24 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-muted-foreground py-8 text-center text-sm">
                      加载中…
                    </TableCell>
                  </TableRow>
                ) : tenants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-muted-foreground py-8 text-center text-sm">
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  pagination.items.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-sm">{t.platformTenantId ?? "—"}</TableCell>
                      <TableCell>{t.name}</TableCell>
                      <TableCell className="text-sm">
                        <span>{formatTenantType(t.type)}</span>
                        {formatInternalExclusionSummary(t) ? (
                          <span className="text-muted-foreground block text-xs">
                            {formatInternalExclusionSummary(t)}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>{maskPhoneMiddle(t.phone)}</TableCell>
                      <TableCell>
                        <LocaleLink
                          href={`/crm/customers/${t.customerId}`}
                          className="text-primary hover:underline"
                        >
                          {t.customerName}
                        </LocaleLink>
                      </TableCell>
                      <TableCell>
                        {t.projectTags.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1">
                            {t.projectTags.map((tag) => (
                              <Badge key={tag.id} variant="secondary" className="font-normal">
                                {tag.name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          "—"
                        )}
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
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            title="收入排除设置"
                            onClick={() => setInternalSettingTenant(t)}
                          >
                            <IconCalendarOff className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" asChild>
                            <LocaleLink href={`/crm/tenants/${t.id}`} title="查看详情">
                              <IconEye className="size-4" />
                            </LocaleLink>
                          </Button>
                        </div>
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

      <CrmTenantInternalSettingDialog
        open={internalSettingTenant != null}
        onOpenChange={(open) => {
          if (!open) setInternalSettingTenant(null)
        }}
        tenant={internalSettingTenant}
        onUpdated={() => {
          void utils.crm.tenants.list.invalidate()
        }}
      />
    </div>
  )
}
