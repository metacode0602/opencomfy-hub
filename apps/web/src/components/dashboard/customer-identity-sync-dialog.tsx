'use client'

import * as React from 'react'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Checkbox } from '@workspace/ui/components/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import type {
  CustomerIdentitySyncMatchStatus,
  CustomerIdentitySyncPreviewItem,
} from '@/lib/types/customer-identity-sync'
import { trpc } from '@/lib/trpc/client'
import { Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

type CustomerIdentitySyncDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSynced?: () => void
}

const MATCH_STATUS_LABEL: Record<CustomerIdentitySyncMatchStatus, string> = {
  updatable: '待更新',
  already_verified: '已实名',
  no_tenant: '未匹配租户',
  not_approved: '未通过审核',
}

const MATCH_STATUS_VARIANT: Record<
  CustomerIdentitySyncMatchStatus,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  updatable: 'default',
  already_verified: 'secondary',
  no_tenant: 'destructive',
  not_approved: 'outline',
}

function formatOperatingTime(value: string | null) {
  if (!value) return '—'
  const d = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('zh-CN', { hour12: false })
}

function SyncRow({
  item,
  checked,
  onCheckedChange,
  disabled,
}: {
  item: CustomerIdentitySyncPreviewItem
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled: boolean
}) {
  const selectable = item.matchStatus === 'updatable' && !!item.customerId

  return (
    <TableRow>
      <TableCell>
        {selectable ? (
          <Checkbox
            checked={checked}
            onCheckedChange={(v) => onCheckedChange(v === true)}
            disabled={disabled}
          />
        ) : null}
      </TableCell>
      <TableCell className="font-mono text-xs">{item.platformTenantId}</TableCell>
      <TableCell>
        <div className="font-medium">{item.companyName}</div>
        <div className="text-muted-foreground text-xs">{item.companyCode}</div>
      </TableCell>
      <TableCell>
        {item.customerName ? (
          <div>
            <div>{item.customerName}</div>
            {item.currentCertCode ? (
              <div className="text-muted-foreground text-xs">本地：{item.currentCertCode}</div>
            ) : null}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-xs">{formatOperatingTime(item.operatingTime)}</TableCell>
      <TableCell>
        <Badge variant={MATCH_STATUS_VARIANT[item.matchStatus]}>
          {MATCH_STATUS_LABEL[item.matchStatus]}
        </Badge>
      </TableCell>
    </TableRow>
  )
}

export function CustomerIdentitySyncDialog({
  open,
  onOpenChange,
  onSynced,
}: CustomerIdentitySyncDialogProps) {
  const utils = trpc.useUtils()
  const [selectedCustomerIds, setSelectedCustomerIds] = React.useState<string[]>([])

  const previewQuery = trpc.crm.customers.previewIdentitySync.useQuery(undefined, {
    enabled: open,
    retry: false,
  })

  const applyMutation = trpc.crm.customers.applyIdentitySync.useMutation({
    onSuccess: (result) => {
      toast.success(`已更新 ${result.updatedCount} 个客户的实名状态`)
      void utils.crm.customers.list.invalidate()
      onOpenChange(false)
      onSynced?.()
    },
    onError: (e) => toast.error(e.message),
  })

  const updatableItems = React.useMemo(
    () =>
      (previewQuery.data?.items ?? []).filter(
        (item) => item.matchStatus === 'updatable' && item.customerId,
      ),
    [previewQuery.data?.items],
  )

  React.useEffect(() => {
    if (!open) {
      setSelectedCustomerIds([])
      return
    }
    if (!previewQuery.data) return
    setSelectedCustomerIds(
      updatableItems
        .map((item) => item.customerId)
        .filter((id): id is string => !!id),
    )
  }, [open, previewQuery.data, updatableItems])

  const allSelected =
    updatableItems.length > 0 &&
    updatableItems.every((item) => item.customerId && selectedCustomerIds.includes(item.customerId))

  const toggleAll = (checked: boolean) => {
    if (!checked) {
      setSelectedCustomerIds([])
      return
    }
    setSelectedCustomerIds(
      updatableItems
        .map((item) => item.customerId)
        .filter((id): id is string => !!id),
    )
  }

  const toggleOne = (customerId: string, checked: boolean) => {
    setSelectedCustomerIds((prev) =>
      checked ? [...new Set([...prev, customerId])] : prev.filter((id) => id !== customerId),
    )
  }

  const handleApply = () => {
    if (selectedCustomerIds.length === 0) {
      toast.error('请至少选择一条待更新的记录')
      return
    }
    applyMutation.mutate({ customerIds: selectedCustomerIds })
  }

  const summary = previewQuery.data

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            同步实名信息
          </DialogTitle>
          <DialogDescription>
            从算算力平台拉取企业认证列表，按平台租户 ID 匹配本地计费账户后更新客户实名状态。
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-2">
          {previewQuery.isLoading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在拉取平台实名列表并对比本地客户…
            </div>
          ) : previewQuery.isError ? (
            <div className="space-y-3 py-6 text-center">
              <p className="text-destructive text-sm">{previewQuery.error.message}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void previewQuery.refetch()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                重试
              </Button>
            </div>
          ) : summary ? (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground">平台记录</div>
                  <div className="text-lg font-semibold">{summary.fetchedCount}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground">待更新</div>
                  <div className="text-lg font-semibold text-primary">{summary.updatableCount}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground">已实名</div>
                  <div className="text-lg font-semibold">{summary.alreadyVerifiedCount}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground">未匹配</div>
                  <div className="text-lg font-semibold">{summary.unmatchedCount}</div>
                </div>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        {updatableItems.length > 0 ? (
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={(v) => toggleAll(v === true)}
                            disabled={applyMutation.isPending}
                          />
                        ) : null}
                      </TableHead>
                      <TableHead>平台租户</TableHead>
                      <TableHead>企业信息</TableHead>
                      <TableHead>本地客户</TableHead>
                      <TableHead>认证时间</TableHead>
                      <TableHead>对比结果</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                          平台暂无企业认证记录
                        </TableCell>
                      </TableRow>
                    ) : (
                      summary.items.map((item) => (
                        <SyncRow
                          key={`${item.auditId}-${item.platformTenantId}`}
                          item={item}
                          checked={!!item.customerId && selectedCustomerIds.includes(item.customerId)}
                          onCheckedChange={(checked) => {
                            if (!item.customerId) return
                            toggleOne(item.customerId, checked)
                          }}
                          disabled={applyMutation.isPending}
                        />
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={applyMutation.isPending}
          >
            取消
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={
              previewQuery.isLoading ||
              previewQuery.isError ||
              applyMutation.isPending ||
              selectedCustomerIds.length === 0
            }
          >
            {applyMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                更新中…
              </>
            ) : (
              `确认更新（${selectedCustomerIds.length}）`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
