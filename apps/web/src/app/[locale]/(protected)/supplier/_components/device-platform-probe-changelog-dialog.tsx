'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { formatProbeDateTime, type DeviceProbeChangeLog } from '@/lib/supplier/device-platform-probe-utils'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  sn: string
  changeLogs: DeviceProbeChangeLog[]
}

export function DevicePlatformProbeChangelogDialog({
  open,
  onOpenChange,
  sn,
  changeLogs,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>设备变更记录</DialogTitle>
          <DialogDescription>
            {sn} · 来源于 <code className="text-xs">supplier_device_change_log</code>
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-auto -mx-1 px-1">
          {changeLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">暂无变更记录</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">操作时间</TableHead>
                  <TableHead className="whitespace-nowrap">变更动作</TableHead>
                  <TableHead className="min-w-[140px]">变更内容</TableHead>
                  <TableHead className="min-w-[120px]">详细说明</TableHead>
                  <TableHead className="whitespace-nowrap">内网 IP</TableHead>
                  <TableHead className="whitespace-nowrap">工单</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changeLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatProbeDateTime(log.occurredAt)}
                    </TableCell>
                    <TableCell className="text-sm">{log.changeAction}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.changeContent ?? '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.description ?? '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.internalIp ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{log.ticketNo ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
