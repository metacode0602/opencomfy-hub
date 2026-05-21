'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Eye, Loader2, Search } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import { trpc } from '@/lib/trpc/client'
import { DEVICE_RETIRE_IMPORT_STATUS_LABELS } from '@/lib/types/device-retire'

const importStatusColor: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  parsed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  committed: 'bg-green-500/20 text-green-400 border-green-500/30',
  parse_failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  committing: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
}

function formatDt(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function OfflineTasksContent() {
  const [search, setSearch] = useState('')
  const [importFilter, setImportFilter] = useState('all')
  const [supplierFilter, setSupplierFilter] = useState('all')

  const { data: suppliers = [] } = trpc.supplier.list.useQuery()
  const { data, isLoading, isError } = trpc.supplier.deviceRetire.listBatches.useQuery({
    supplierId: supplierFilter === 'all' ? undefined : supplierFilter,
    importStatus: importFilter === 'all' ? undefined : importFilter,
    search: search.trim() || undefined,
  })

  const items = data?.items ?? []

  const stats = useMemo(
    () => ({
      total: items.length,
      committed: items.filter((b) => b.importStatus === 'committed').length,
      retiredDevices: items.reduce((sum, b) => sum + b.retiredDeviceCount, 0),
      errors: items.reduce((sum, b) => sum + b.parsedErrorCount, 0),
    }),
    [items],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">设备下架</h1>
        <p className="text-sm text-muted-foreground mt-1">
          查看各供应商机房的设备下架批次，点击批次号进入详情查看设备清单与状态。
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">批次总数</p>
            <p className="text-2xl font-semibold mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">已下架批次</p>
            <p className="text-2xl font-semibold mt-1">{stats.committed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">累计下架设备</p>
            <p className="text-2xl font-semibold mt-1">{stats.retiredDevices}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">累计错误行</p>
            <p className="text-2xl font-semibold mt-1">{stats.errors}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="搜索批次号、供应商、机房..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="供应商" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部供应商</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={importFilter} onValueChange={setImportFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="导入状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="committed">已下架</SelectItem>
              <SelectItem value="committing">下架中</SelectItem>
              <SelectItem value="parsed">待确认</SelectItem>
              <SelectItem value="parse_failed">解析失败</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        {isLoading ? (
          <CardContent className="py-16 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            加载批次列表...
          </CardContent>
        ) : isError ? (
          <CardContent className="py-16 text-center text-destructive text-sm">
            加载失败，请稍后重试
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>批次号</TableHead>
                <TableHead>供应商 / 机房</TableHead>
                <TableHead>下架原因</TableHead>
                <TableHead>期望完成</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>下架设备</TableHead>
                <TableHead>提交时间</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                    暂无下架批次。可在供应商详情页发起设备下架。
                  </TableCell>
                </TableRow>
              ) : (
                items.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/supplier/offline-tasks/${b.id}`}
                        className="text-primary hover:underline"
                      >
                        {b.batchCode}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div>{b.supplierShortName ?? b.supplierName}</div>
                      <div className="text-xs text-muted-foreground">
                        {b.idcCode} · {b.dataCenterName}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{b.retireReasonLabel ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {b.expectedCompletionDate ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={importStatusColor[b.importStatus] ?? ''}>
                        {DEVICE_RETIRE_IMPORT_STATUS_LABELS[b.importStatus] ?? b.importStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {b.retiredDeviceCount}
                      {b.parsedRowCount > 0 ? ` / ${b.parsedRowCount}` : ''}
                      {b.parsedErrorCount > 0 && (
                        <span className="text-xs text-destructive ml-1">
                          ({b.parsedErrorCount} 错误)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDt(b.committedAt ?? b.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/supplier/offline-tasks/${b.id}`}>
                          <Eye className="w-4 h-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  )
}
