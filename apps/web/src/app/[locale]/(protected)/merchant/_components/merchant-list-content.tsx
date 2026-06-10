'use client'

import { useMemo, useState } from 'react'
import { Building2, Plus, RefreshCw, Search, Store } from 'lucide-react'
import { toast } from 'sonner'
import { LocaleLink } from '@/lib/i18n/navigation'
import { trpc } from '@/lib/trpc/client'
import { MerchantPlatformSyncDialog } from './merchant-platform-sync-dialog'
import {
  formatMoney,
  MERCHANT_STATUS_BADGE,
  merchantAccessModeLabels,
  merchantStatusLabels,
  merchantTypeLabels,
} from './merchant-utils'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import { Input } from '@workspace/ui/components/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'

export function MerchantListContent() {
  const [search, setSearch] = useState('')
  const [syncOpen, setSyncOpen] = useState(false)
  const { data: rows = [], isLoading, refetch } = trpc.merchant.list.useQuery(
    { search: search.trim() || undefined },
    { placeholderData: (prev) => prev },
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        row.code.toLowerCase().includes(q) ||
        row.companyFullName.toLowerCase().includes(q) ||
        row.unifiedSocialCreditCode.toLowerCase().includes(q) ||
        String(row.platformMerchantId).includes(q),
    )
  }, [rows, search])

  const stats = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((r) => r.status === 'active').length,
      partners: rows.filter((r) => r.type === 'partner').length,
      monthTotal: rows.reduce((s, r) => s + r.monthConsumption, 0),
    }),
    [rows],
  )

  const handleSync = () => {
    setSyncOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">商户管理</h1>
          <p className="text-sm text-muted-foreground">管理平台商户主体、机房区域、进货价与消耗</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleSync}>
            <RefreshCw className="size-4" />
            同步平台
          </Button>
          <Button className="gap-2" onClick={() => toast.info('创建商户：待接入')}>
            <Plus className="size-4" />
            新建商户
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Store className="size-8 text-primary opacity-80" />
            <div>
              <p className="text-xs text-muted-foreground">商户总数</p>
              <p className="text-xl font-semibold tabular-nums">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Building2 className="size-8 text-green-600 opacity-80" />
            <div>
              <p className="text-xs text-muted-foreground">正常运营</p>
              <p className="text-xl font-semibold tabular-nums">{stats.active}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">合作伙伴</p>
            <p className="text-xl font-semibold tabular-nums">{stats.partners}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">本月总消耗</p>
            <p className="text-xl font-semibold tabular-nums">¥{formatMoney(stats.monthTotal)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="搜索简称、公司全称、信用代码、平台 ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>简称 / Code</TableHead>
              <TableHead>公司全称</TableHead>
              <TableHead>统一社会信用代码</TableHead>
              <TableHead className="text-center">平台 ID</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>接入模式</TableHead>
              <TableHead className="text-center">关联租户</TableHead>
              <TableHead className="text-center">开放区域</TableHead>
              <TableHead className="text-right">本月消耗</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">
                  加载中…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="py-8 text-center text-muted-foreground">
                  暂无匹配商户
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">{row.name}</div>
                    <div className="text-xs text-muted-foreground">{row.code}</div>
                    {row.isDefault ? (
                      <Badge variant="outline" className="mt-1 text-[10px]">
                        默认
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm" title={row.companyFullName}>
                    {row.companyFullName}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.unifiedSocialCreditCode}</TableCell>
                  <TableCell className="text-center tabular-nums">{row.platformMerchantId}</TableCell>
                  <TableCell className="text-sm">{merchantTypeLabels[row.type]}</TableCell>
                  <TableCell className="text-sm">{merchantAccessModeLabels[row.accessMode]}</TableCell>
                  <TableCell className="text-center tabular-nums">{row.tenantCount}</TableCell>
                  <TableCell className="text-center tabular-nums">{row.openRegionCount}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    ¥{formatMoney(row.monthConsumption)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={MERCHANT_STATUS_BADGE[row.status]}>
                      {merchantStatusLabels[row.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild>
                      <LocaleLink href={`/merchant/${row.id}`}>详情</LocaleLink>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <MerchantPlatformSyncDialog
        open={syncOpen}
        onOpenChange={setSyncOpen}
        onSuccess={() => void refetch()}
      />
    </div>
  )
}
