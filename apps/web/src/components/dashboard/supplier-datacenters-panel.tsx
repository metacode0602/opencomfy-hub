'use client'

import Link from 'next/link'
import {
  AlertCircle,
  ChevronRight,
  Cpu,
  Loader2,
  MapPin,
  MoreHorizontal,
  Plus,
} from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardDescription, CardHeader } from '@workspace/ui/components/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { Progress } from '@workspace/ui/components/progress'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import type { Supplier } from '@/lib/data/types'
import { trpc } from '@/lib/trpc/client'
import { dcStatusColors, statusNames } from '@/components/dashboard/supplier-detail-constants'
import { ListPagination } from '@/components/shared/list-pagination'
import { useListPagination } from '@/hooks/use-list-pagination'

interface SupplierDatacentersPanelProps {
  supplier: Supplier
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return '加载失败，请稍后重试'
}

export function SupplierDatacentersPanel({ supplier }: SupplierDatacentersPanelProps) {
  const utils = trpc.useUtils()
  const {
    data: dataCenters = [],
    isLoading: isLoadingDataCenters,
    isError: isDataCentersError,
    error: dataCentersError,
    refetch: refetchDataCenters,
  } = trpc.supplier.listDataCenters.useQuery({
    supplierId: supplier.id,
  })
  const {
    data: devices = [],
    isLoading: isLoadingDevices,
    isError: isDevicesError,
    error: devicesError,
    refetch: refetchDevices,
  } = trpc.supplier.listGpuInventory.useQuery({ supplierId: supplier.id }, { retry: 1 })

  const pagination = useListPagination(devices)

  return (
    <div className="space-y-8">
      {/* <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-foreground">机房与设备</h2>
          <p className="text-sm text-muted-foreground">
            管理数据中心、配套费用及 GPU 聚合库存
          </p>
        </div>
        <div className="flex gap-2">
          <SupplierDatacenterImportTrigger
            supplier={supplier}
            onSuccess={() =>
              void utils.supplier.listDataCenters.invalidate({ supplierId: supplier.id })
            }
          />
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            新增机房
          </Button>
        </div>
      </div> */}

      <section className="space-y-4">
        <div>
          <h3 className="text-base font-medium text-foreground">机房概览</h3>
          <p className="text-sm text-muted-foreground">各数据中心的运行状态与配套费用</p>
        </div>

        {isLoadingDataCenters ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            加载机房列表…
          </div>
        ) : isDataCentersError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex flex-wrap items-center gap-3">
              <span>{getErrorMessage(dataCentersError)}</span>
              <Button variant="outline" size="sm" onClick={() => void refetchDataCenters()}>
                重试
              </Button>
            </AlertDescription>
          </Alert>
        ) : dataCenters.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              暂无机房数据，可通过「导入机房」批量新增
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {dataCenters.map((dc) => {
              const dcDevices = devices.filter((d) => d.dataCenterId === dc.id)
              const dcOnlineDevices = dcDevices.reduce((sum, d) => sum + d.onlineQuantity, 0)
              const dcTotalDevices = dcDevices.reduce((sum, d) => sum + d.quantity, 0)
              const onlineRate =
                dcTotalDevices > 0 ? (dcOnlineDevices / dcTotalDevices) * 100 : 0

              return (
                <Card key={dc.id} className="bg-card border-border">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/supplier/datacenters/${dc.id}`}
                            className="text-base font-semibold text-foreground hover:text-primary hover:underline"
                          >
                            {dc.name}
                          </Link>
                          <Badge variant="outline" className={dcStatusColors[dc.status]}>
                            {statusNames[dc.status]}
                          </Badge>
                        </div>
                        <CardDescription className="mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {dc.address || dc.location || '—'}
                        </CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/supplier/datacenters/${dc.id}`}>查看详情</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled>编辑机房</DropdownMenuItem>
                          <DropdownMenuItem disabled>管理设备</DropdownMenuItem>
                          <DropdownMenuItem disabled>调整费用</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">机房编码:</span>
                      <code className="rounded bg-muted px-2 py-0.5 text-foreground">{dc.code}</code>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-border pt-3">
                      <div>
                        <p className="text-sm text-muted-foreground">设备在线率</p>
                        <div className="mt-1 flex items-center gap-2">
                          <Progress value={onlineRate} className="h-2 flex-1" />
                          <span className="text-sm font-medium text-foreground">
                            {dcOnlineDevices}/{dcTotalDevices}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">卡型种类</p>
                        <p className="mt-1 font-medium text-foreground">{dcDevices.length} 种</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-border pt-3">
                      <div className="rounded-lg bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground">网络费用 (月)</p>
                        <p className="text-lg font-semibold text-foreground">
                          ¥{dc.networkFee.toLocaleString()}
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground">管控节点费用 (月)</p>
                        <p className="text-lg font-semibold text-foreground">
                          ¥{dc.managementNodeFee.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-base font-medium text-foreground">聚合库存</h3>
          <p className="text-sm text-muted-foreground">各机房 GPU 设备汇总与成本配置</p>
        </div>

        {isLoadingDevices ? (
          <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            加载聚合库存...
          </div>
        ) : isDevicesError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex flex-wrap items-center gap-3">
              <span>{getErrorMessage(devicesError)}</span>
              <Button variant="outline" size="sm" onClick={() => void refetchDevices()}>
                重试
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <Card className="overflow-x-auto border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">机房</TableHead>
                  <TableHead className="text-muted-foreground">卡型</TableHead>
                  <TableHead className="text-muted-foreground">数量</TableHead>
                  <TableHead className="text-muted-foreground">在线</TableHead>
                  <TableHead className="text-muted-foreground">在线率</TableHead>
                  <TableHead className="text-muted-foreground">成本</TableHead>
                  <TableHead className="text-muted-foreground">状态</TableHead>
                  <TableHead className="text-muted-foreground">内部测试</TableHead>
                  <TableHead className="text-muted-foreground">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.totalItems === 0 ? (
                  <TableRow className="border-border">
                    <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                      {devices.length === 0
                        ? '暂无聚合库存，请通过「运维数据导入」入库设备后自动汇总'
                        : '暂无匹配的设备记录'}
                    </TableCell>
                  </TableRow>
                ) : (
                  pagination.items.map((device) => {
                    const onlineRate =
                      device.quantity > 0 ? (device.onlineQuantity / device.quantity) * 100 : 0
                    const cost = device.cardTimeCostPerHour ?? device.revenueShareCostPerHour ?? 0
                    return (
                      <TableRow key={device.id} className="border-border">
                        <TableCell className="font-medium text-foreground">
                          {device.dataCenterName}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Cpu className="h-4 w-4 text-muted-foreground" />
                            <span className="text-foreground">{device.cardTypeName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-foreground">{device.quantity}</TableCell>
                        <TableCell className="text-foreground">{device.onlineQuantity}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={onlineRate} className="h-2 w-16" />
                            <span className="text-sm text-foreground">{onlineRate.toFixed(0)}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {cost > 0 ? `¥${cost.toFixed(0)}/小时` : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={dcStatusColors[device.status]}>
                            {statusNames[device.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {device.isInternalTest ? (
                            <Badge
                              variant="outline"
                              className="border-purple-500/30 bg-purple-500/10 text-purple-400"
                            >
                              测试中
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/supplier/inventory/${device.id}`}>
                              详情
                              <ChevronRight className="h-3 w-3" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
            {pagination.totalItems > 0 && (
              <ListPagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                totalItems={pagination.totalItems}
                pageSize={pagination.pageSize}
                onPageChange={pagination.setPage}
              />
            )}
          </Card>
        )}
      </section>
    </div>
  )
}
