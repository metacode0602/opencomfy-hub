'use client'

import { Loader2, Star } from 'lucide-react'
import { LocaleLink } from '@/lib/i18n/navigation'
import { trpc } from '@/lib/trpc/client'
import { MerchantDetailNav } from './merchant-detail-nav'
import { bindingRoleLabels } from './merchant-utils'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent } from '@workspace/ui/components/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'

export function MerchantTenantsContent({ merchantId }: { merchantId: string }) {
  const merchantQuery = trpc.merchant.getById.useQuery({ id: merchantId })
  const tenantsQuery = trpc.merchant.tenant.list.useQuery({ id: merchantId })

  if (merchantQuery.isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        加载中…
      </div>
    )
  }

  const merchant = merchantQuery.data
  if (!merchant) {
    return <p className="text-muted-foreground">商户不存在</p>
  }

  const rows = tenantsQuery.data ?? []

  return (
    <div className="space-y-6">
      <MerchantDetailNav merchant={merchant} />

      <p className="text-sm text-muted-foreground">
        展示当前商户与计费租户的绑定关系（只读）。商务附加绑定（commercial）本期不实现，绑定变更由平台同步或后续迭代提供。
      </p>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>租户</TableHead>
              <TableHead>平台租户 ID</TableHead>
              <TableHead>客户</TableHead>
              <TableHead>绑定角色</TableHead>
              <TableHead>主绑定</TableHead>
              <TableHead>生效日</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenantsQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  加载中…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  暂无关联租户
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">{row.tenantName}</div>
                    <div className="text-xs text-muted-foreground">{row.tenantId}</div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{row.platformTenantId}</TableCell>
                  <TableCell>
                    {row.customerId !== '—' ? (
                      <LocaleLink
                        href={`/crm/customers/${row.customerId}`}
                        className="text-sm hover:underline"
                      >
                        {row.customerName}
                      </LocaleLink>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {bindingRoleLabels[row.bindingRole]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.isPrimary ? (
                      <Star className="size-4 fill-amber-400 text-amber-400" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{row.effectiveFrom}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
