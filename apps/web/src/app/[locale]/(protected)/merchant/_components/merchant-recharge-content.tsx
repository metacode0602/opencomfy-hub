'use client'

import { useMemo, useState } from 'react'
import { ExternalLink, History, Loader2, Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc/client'
import type { MerchantRechargeAuditLog, MerchantRechargeRecord } from '@/lib/types/merchant'
import { MerchantDetailNav } from './merchant-detail-nav'
import {
  MerchantRechargeDialog,
  type MerchantRechargeFormInput,
} from './merchant-recharge-dialog'
import { isImageAttachment } from './merchant-recharge-voucher-upload'
import {
  formatMoney,
  merchantRechargeSourceLabels,
  merchantRechargeStatusLabels,
  RECHARGE_STATUS_BADGE,
} from './merchant-utils'
import { Badge } from '@workspace/ui/components/badge'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import {
  Dialog,
  DialogContent,
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

export function MerchantRechargeContent({ merchantId }: { merchantId: string }) {
  const utils = trpc.useUtils()
  const merchantQuery = trpc.merchant.getById.useQuery({ id: merchantId })
  const recordsQuery = trpc.merchant.recharge.list.useQuery({ merchantId })
  const auditQuery = trpc.merchant.recharge.auditList.useQuery({ merchantId, limit: 20 })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create')
  const [editingRecord, setEditingRecord] = useState<MerchantRechargeRecord | undefined>()
  const [auditOpen, setAuditOpen] = useState(false)
  const [auditRecord, setAuditRecord] = useState<MerchantRechargeRecord | undefined>()
  const [voucherOpen, setVoucherOpen] = useState(false)
  const [voucherRecord, setVoucherRecord] = useState<MerchantRechargeRecord | undefined>()

  const createMutation = trpc.merchant.recharge.create.useMutation({
    onSuccess: async () => {
      toast.success('充值记录已添加')
      await utils.merchant.recharge.list.invalidate({ merchantId })
      await utils.merchant.recharge.auditList.invalidate({ merchantId })
      await utils.merchant.activity.list.invalidate({ merchantId })
    },
    onError: (err) => toast.error(err.message || '创建失败'),
  })

  const updateMutation = trpc.merchant.recharge.update.useMutation({
    onSuccess: async () => {
      toast.success('充值记录已更新')
      await utils.merchant.recharge.list.invalidate({ merchantId })
      await utils.merchant.recharge.auditList.invalidate({ merchantId })
      await utils.merchant.activity.list.invalidate({ merchantId })
    },
    onError: (err) => toast.error(err.message || '更新失败'),
  })

  const recordAuditQuery = trpc.merchant.recharge.auditList.useQuery(
    { rechargeId: auditRecord?.id ?? '' },
    { enabled: auditOpen && Boolean(auditRecord?.id) },
  )

  const records = recordsQuery.data ?? []
  const auditLogs = auditQuery.data ?? []

  const stats = useMemo(() => {
    const completed = records.filter((r) => r.status === 'completed')
    return {
      total: records.length,
      completedAmount: completed.reduce((s, r) => s + r.amount, 0),
      pendingCount: records.filter((r) => r.status === 'pending').length,
    }
  }, [records])

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

  const openCreate = () => {
    setDialogMode('create')
    setEditingRecord(undefined)
    setDialogOpen(true)
  }

  const openEdit = (record: MerchantRechargeRecord) => {
    if (record.source === 'platform_sync') {
      toast.info('平台同步记录仅可修改备注与状态')
    }
    setDialogMode('edit')
    setEditingRecord(record)
    setDialogOpen(true)
  }

  const handleSubmit = async (input: MerchantRechargeFormInput) => {
    if (dialogMode === 'create') {
      await createMutation.mutateAsync({
        merchantId,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        status: input.status,
        transactionId: input.transactionId,
        rechargeDate: input.rechargeDate,
        remark: input.remark,
        files: input.files,
      })
    } else if (editingRecord) {
      await updateMutation.mutateAsync({
        rechargeId: editingRecord.id,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        status: input.status,
        transactionId: input.transactionId,
        rechargeDate: input.rechargeDate,
        remark: input.remark,
        keepAttachmentIds: input.keepAttachmentIds,
        files: input.files,
      })
    }
  }

  const recordAuditLogs = recordAuditQuery.data ?? []

  return (
    <div className="space-y-6">
      <MerchantDetailNav merchant={merchant} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          维护商户充值记录，支持手工录入与修改；所有操作写入审计日志。
        </p>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="size-4" />
          新增充值
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">记录总数</p>
            <p className="text-xl font-semibold tabular-nums mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">已完成充值</p>
            <p className="text-xl font-semibold tabular-nums mt-1">
              ¥{formatMoney(stats.completedAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">待支付</p>
            <p className="text-xl font-semibold tabular-nums mt-1">{stats.pendingCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">充值记录</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>充值日期</TableHead>
                <TableHead className="text-right">金额</TableHead>
                <TableHead>支付方式</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>来源</TableHead>
                <TableHead>凭证</TableHead>
                <TableHead>流水号</TableHead>
                <TableHead>操作人</TableHead>
                <TableHead className="w-[120px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {recordsQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                    加载中…
                  </TableCell>
                </TableRow>
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                    暂无充值记录
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{record.rechargeDate}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      ¥{formatMoney(record.amount)}
                    </TableCell>
                    <TableCell>{record.paymentMethod}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={RECHARGE_STATUS_BADGE[record.status]}>
                        {merchantRechargeStatusLabels[record.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {merchantRechargeSourceLabels[record.source]}
                    </TableCell>
                    <TableCell>
                      {record.attachments.length > 0 ? (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          onClick={() => {
                            setVoucherRecord(record)
                            setVoucherOpen(true)
                          }}
                        >
                          {record.attachments.length} 个文件
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {record.transactionId ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {record.updatedBy ?? record.createdBy ?? '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => openEdit(record)}
                          title="编辑"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => {
                            setAuditRecord(record)
                            setAuditOpen(true)
                          }}
                          title="审计记录"
                        >
                          <History className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {auditLogs.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">最近操作审计</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {auditLogs.slice(0, 5).map((log) => (
              <AuditLogItem key={log.id} log={log} />
            ))}
          </CardContent>
        </Card>
      ) : null}

      <MerchantRechargeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        record={editingRecord}
        onSubmit={handleSubmit}
      />

      <Dialog open={voucherOpen} onOpenChange={setVoucherOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>充值凭证</DialogTitle>
          </DialogHeader>
          {voucherRecord ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {voucherRecord.rechargeDate} · ¥{formatMoney(voucherRecord.amount)} · 共{' '}
                {voucherRecord.attachments.length} 个文件
              </p>
              <div className="grid gap-3">
                {voucherRecord.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="rounded-lg border border-border overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
                      <span className="truncate text-sm font-medium">{att.name}</span>
                      <Button variant="ghost" size="sm" className="shrink-0 gap-1 h-7" asChild>
                        <a href={att.dataUrl} download={att.name} target="_blank" rel="noreferrer">
                          <ExternalLink className="size-3.5" />
                          下载
                        </a>
                      </Button>
                    </div>
                    {isImageAttachment(att.mimeType) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={att.dataUrl}
                        alt={att.name}
                        className="max-h-64 w-full object-contain bg-muted/20"
                      />
                    ) : (
                      <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
                        PDF 文件，请点击下载查看
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>充值记录审计</DialogTitle>
          </DialogHeader>
          {auditRecord ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {auditRecord.rechargeDate} · ¥{formatMoney(auditRecord.amount)} ·{' '}
                {auditRecord.transactionId ?? '无流水号'}
              </p>
              {recordAuditQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">加载中…</p>
              ) : recordAuditLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无审计记录</p>
              ) : (
                <ul className="space-y-3">
                  {recordAuditLogs.map((log) => (
                    <li key={log.id} className="rounded-md border border-border p-3">
                      <AuditLogItem log={log} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AuditLogItem({ log }: { log: MerchantRechargeAuditLog }) {
  return (
    <div className="text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-[10px]">
          {log.action === 'create' ? '创建' : '修改'}
        </Badge>
        <span className="font-medium">{log.operatorName}</span>
        <span className="text-xs text-muted-foreground">
          {new Date(log.occurredAt).toLocaleString('zh-CN')}
        </span>
      </div>
      {log.remark ? <p className="mt-1 text-muted-foreground">{log.remark}</p> : null}
      {log.changes ? (
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {Object.entries(log.changes).map(([field, { from, to }]) => (
            <li key={field}>
              <span className="font-mono">{field}</span>：{String(from)} → {String(to)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
