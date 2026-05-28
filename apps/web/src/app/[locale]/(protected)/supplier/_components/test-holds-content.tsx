'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, FlaskConical, Loader2, MoreHorizontal, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import {
  INTERNAL_TEST_HOLD_DEPARTMENT_LABELS,
  INTERNAL_TEST_HOLD_SETTLEMENT_LABELS,
} from '@/lib/types/supplier-domain'
import type { InternalTestHoldListItem } from '@/lib/types/internal-test-hold-api'
import { trpc } from '@/lib/trpc/client'
import { invalidateGlobalDashboard } from '@/lib/dashboard/invalidate-global-dashboard'
import { TestHoldDeviceEntryDialog } from './test-hold-device-entry-dialog'
import { TestHoldCreateDialog } from './test-hold-create-dialog'

function formatDt(value: Date | string | null) {
  if (!value) return '—'
  const d = value instanceof Date ? value : new Date(value)
  return d.toLocaleString('zh-CN')
}

function isActive(hold: InternalTestHoldListItem) {
  const now = Date.now()
  const from = new Date(hold.holdFrom).getTime()
  const until = hold.holdUntil ? new Date(hold.holdUntil).getTime() : null
  if (now < from) return false
  if (until != null && now > until) return false
  return true
}

export function TestHoldsContent() {
  const utils = trpc.useUtils()
  const [search, setSearch] = useState('')
  const [activeOnly, setActiveOnly] = useState<'all' | 'yes' | 'no'>('all')
  const [createOpen, setCreateOpen] = useState(false)

  const { data, isLoading, isError } = trpc.supplier.internalTestHold.list.useQuery({
    search: search.trim() || undefined,
    activeOnly,
  })

  const endMutation = trpc.supplier.internalTestHold.end.useMutation({
    onSuccess: () => {
      toast.success('已结束占用')
      void utils.supplier.internalTestHold.list.invalidate()
      invalidateGlobalDashboard(utils)
    },
    onError: (error) => toast.error(error.message),
  })

  const holds = data?.items ?? []

  const activeCount = useMemo(() => holds.filter(isActive).length, [holds])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">内部占用</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            内部测试 GPU 占用台账，影响可售量计算
          </p>
        </div>
        <Button className="gap-2" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          登记占用
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="flex gap-3 p-4">
            <FlaskConical className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-2xl font-semibold">{activeCount}</p>
              <p className="text-xs text-muted-foreground">进行中占用</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-semibold">{holds.length}</p>
            <p className="text-xs text-muted-foreground">历史记录总数</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-3 p-4">
          <div className="relative min-w-[200px] max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="搜索工单号、使用者、卡型、部门..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={activeOnly} onValueChange={(v) => setActiveOnly(v as 'all' | 'yes' | 'no')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="yes">进行中</SelectItem>
              <SelectItem value="no">已结束</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            加载占用台账...
          </div>
        ) : isError ? (
          <div className="py-16 text-center text-sm text-destructive">加载失败，请稍后重试</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>供应商</TableHead>
                <TableHead>机房</TableHead>
                <TableHead>飞书工单</TableHead>
                <TableHead>使用者</TableHead>
                <TableHead>使用部门</TableHead>
                <TableHead>卡型</TableHead>
                <TableHead>台数</TableHead>
                <TableHead>结算方式</TableHead>
                <TableHead>时段</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {holds.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="py-12 text-center text-muted-foreground">
                    暂无内部占用记录，点击右上角「登记占用」创建
                  </TableCell>
                </TableRow>
              ) : (
                holds.map((h) => (
                  <HoldRow
                    key={h.id}
                    hold={h}
                    onEnd={() => endMutation.mutate({ holdId: h.id })}
                    ending={endMutation.isPending}
                  />
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <TestHoldCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}

function HoldRow({
  hold,
  onEnd,
  ending,
}: {
  hold: InternalTestHoldListItem
  onEnd: () => void
  ending: boolean
}) {
  const active = isActive(hold)
  const [deviceDialogOpen, setDeviceDialogOpen] = useState(false)

  return (
    <TableRow>
      <TableCell>
        <Link
          href={`/supplier/suppliers/${hold.supplierId}`}
          className="text-sm text-primary hover:underline"
        >
          {hold.supplierShortName ?? hold.supplierName}
        </Link>
      </TableCell>
      <TableCell className="text-sm">{hold.dataCenterName}</TableCell>
      <TableCell className="text-sm">
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{hold.workOrderNo}</code>
      </TableCell>
      <TableCell>{hold.userName}</TableCell>
      <TableCell>{INTERNAL_TEST_HOLD_DEPARTMENT_LABELS[hold.department]}</TableCell>
      <TableCell className="font-mono text-xs">{hold.cardTypeName}</TableCell>
      <TableCell>{hold.unitCount}</TableCell>
      <TableCell>{INTERNAL_TEST_HOLD_SETTLEMENT_LABELS[hold.settlementMode]}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDt(hold.holdFrom)} — {formatDt(hold.holdUntil)}
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={active ? 'border-purple-500/30 bg-purple-500/20 text-purple-400' : ''}
        >
          {active ? '进行中' : '已结束'}
        </Badge>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/supplier/test-holds/${hold.id}`}>
                详情 <ChevronRight className="ml-1 h-3 w-3" />
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                setDeviceDialogOpen(true)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              录入设备
              {hold.deviceCount > 0 && (
                <span className="ml-auto text-xs text-muted-foreground">{hold.deviceCount} 台</span>
              )}
            </DropdownMenuItem>
            {active && (
              <DropdownMenuItem disabled={ending} onClick={onEnd}>
                结束占用
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <TestHoldDeviceEntryDialog
          holdId={hold.id}
          open={deviceDialogOpen}
          onOpenChange={setDeviceDialogOpen}
        />
      </TableCell>
    </TableRow>
  )
}
