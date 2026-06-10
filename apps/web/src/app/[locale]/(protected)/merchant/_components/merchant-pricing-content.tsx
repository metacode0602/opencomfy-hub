'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { MerchantPurchasePrice } from '@/lib/types/merchant'
import { trpc } from '@/lib/trpc/client'
import { platformProductLineNames } from '@/lib/types/platform-pricing'
import { PRODUCT_LINES } from '@/app/[locale]/(protected)/supplier/components/platform-pricing/platform-pricing-utils'
import { MerchantDetailNav } from './merchant-detail-nav'
import { formatMoney } from './merchant-utils'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent } from '@workspace/ui/components/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'

function purchasePriceSourceLabel(source: MerchantPurchasePrice['source']): string {
  switch (source) {
    case 'inherit_l1':
      return '继承刊例'
    case 'platform_sync':
      return '平台同步'
    default:
      return '手工'
  }
}

export function MerchantPricingContent({ merchantId }: { merchantId: string }) {
  const merchantQuery = trpc.merchant.getById.useQuery({ id: merchantId })
  const pricingQuery = trpc.merchant.pricing.list.useQuery({ merchantId })
  const searchParams = useSearchParams()
  const dcFilter = searchParams.get('dc') ?? 'all'
  const [tab, setTab] = useState<'by-card' | 'by-dc'>('by-card')

  const allPrices = pricingQuery.data ?? []

  const prices = useMemo(() => {
    if (dcFilter === 'all') return allPrices
    return allPrices.filter((p) => p.dataCenterId === dcFilter)
  }, [allPrices, dcFilter])

  const dcFilterLabel = useMemo(() => {
    if (dcFilter === 'all') return null
    return allPrices.find((p) => p.dataCenterId === dcFilter)?.dataCenterName ?? dcFilter
  }, [allPrices, dcFilter])

  const byCard = useMemo(() => {
    const map = new Map<string, MerchantPurchasePrice[]>()
    for (const p of prices) {
      const list = map.get(p.gpuCardTypeId) ?? []
      list.push(p)
      map.set(p.gpuCardTypeId, list)
    }
    return [...map.entries()].map(([cardTypeId, rows]) => ({
      cardTypeId,
      cardTypeName: rows[0]?.cardTypeName ?? cardTypeId,
      rows,
    }))
  }, [prices])

  const byDc = useMemo(() => {
    const map = new Map<string, MerchantPurchasePrice[]>()
    for (const p of prices) {
      const list = map.get(p.dataCenterId) ?? []
      list.push(p)
      map.set(p.dataCenterId, list)
    }
    return [...map.entries()].map(([dataCenterId, rows]) => ({
      dataCenterId,
      dataCenterName: rows[0]?.dataCenterName ?? dataCenterId,
      rows,
    }))
  }, [prices])

  if (merchantQuery.isLoading || pricingQuery.isLoading) {
    return <p className="text-muted-foreground py-8">加载中…</p>
  }

  const merchant = merchantQuery.data
  if (!merchant) {
    return <p className="text-muted-foreground">商户不存在</p>
  }

  if (pricingQuery.isError) {
    return (
      <p className="text-muted-foreground py-8">
        {pricingQuery.error.message || '加载进货价失败'}
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <MerchantDetailNav merchant={merchant} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          L3 商户进货价；未配置时默认继承 L1 平台刊例价。
          {dcFilterLabel ? (
            <Badge variant="outline" className="ml-2">
              机房筛选：{dcFilterLabel}
            </Badge>
          ) : null}
        </p>
      </div>

      {prices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            暂无进货价配置；默认使用平台刊例价。可在「机房区域」中为各区域配置进货价。
          </CardContent>
        </Card>
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="by-card">按卡型</TabsTrigger>
            <TabsTrigger value="by-dc">按机房</TabsTrigger>
          </TabsList>

          <TabsContent value="by-card" className="mt-4 space-y-4">
            {byCard.map((group) => (
              <Card key={group.cardTypeId}>
                <CardContent className="p-0">
                  <div className="border-b px-4 py-3 font-medium">{group.cardTypeName}</div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>机房</TableHead>
                        {PRODUCT_LINES.map((pl) => (
                          <TableHead key={pl} className="text-center text-xs">
                            {platformProductLineNames[pl]}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...new Set(group.rows.map((r) => r.dataCenterId))].map((dcId) => {
                        const dcName =
                          group.rows.find((r) => r.dataCenterId === dcId)?.dataCenterName ?? dcId
                        return (
                          <TableRow key={dcId}>
                            <TableCell className="text-sm">{dcName}</TableCell>
                            {PRODUCT_LINES.map((pl) => {
                              const row = group.rows.find(
                                (r) => r.dataCenterId === dcId && r.productLine === pl,
                              )
                              return (
                                <TableCell key={pl} className="text-center text-sm tabular-nums">
                                  {row ? (
                                    <div>
                                      <div>¥{formatMoney(row.purchasePrice)}</div>
                                      {row.platformListPrice != null &&
                                      row.purchasePrice !== row.platformListPrice ? (
                                        <div className="text-[10px] text-muted-foreground">
                                          刊例 ¥{formatMoney(row.platformListPrice)}
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                              )
                            })}
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="by-dc" className="mt-4 space-y-4">
            {byDc.map((group) => (
              <Card key={group.dataCenterId}>
                <CardContent className="p-0">
                  <div className="border-b px-4 py-3 font-medium">{group.dataCenterName}</div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>卡型</TableHead>
                        <TableHead>产品线</TableHead>
                        <TableHead className="text-right">进货价</TableHead>
                        <TableHead className="text-right">刊例价</TableHead>
                        <TableHead>来源</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="text-sm">{row.cardTypeName}</TableCell>
                          <TableCell className="text-sm">
                            {platformProductLineNames[row.productLine]}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            ¥{formatMoney(row.purchasePrice)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {row.platformListPrice != null
                              ? `¥${formatMoney(row.platformListPrice)}`
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {purchasePriceSourceLabel(row.source)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
