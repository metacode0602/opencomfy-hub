'use client'

import { CopyToClipboard } from '@/components/shared/copy-to-clipboard'
import {
  formatSupplierOpsEngineerRow,
  type SupplierOpsEngineer,
} from '@/lib/types/supplier-ops-engineer'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'

export function SupplierOpsEngineersList({
  engineers,
  showDataCenter = false,
  emptyMessage,
}: {
  engineers: SupplierOpsEngineer[]
  showDataCenter?: boolean
  emptyMessage: string
}) {
  if (engineers.length === 0) {
    return (
      <p className="px-6 py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
    )
  }

  return (
    <>
      <div className="divide-y md:hidden">
        {engineers.map((engineer) => (
          <div
            key={engineer.id}
            className="flex items-start justify-between gap-3 px-4 py-3"
          >
            <div className="min-w-0 space-y-1">
              <p className="font-medium text-foreground">{engineer.name}</p>
              {showDataCenter && (
                <p className="text-sm text-muted-foreground">{engineer.dataCenterName}</p>
              )}
              <p className="text-sm text-muted-foreground break-all">{engineer.phone || '—'}</p>
              <p className="text-sm text-muted-foreground break-all">{engineer.email || '—'}</p>
              <p className="text-sm text-muted-foreground">
                {engineer.wechatId ? `微信：${engineer.wechatId}` : '—'}
              </p>
            </div>
            <CopyToClipboard
              text={formatSupplierOpsEngineerRow(engineer)}
              tooltip="复制该行联系方式"
              successMessage="已复制该行联系方式"
            />
          </div>
        ))}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <Table className={showDataCenter ? 'min-w-[820px]' : 'min-w-[720px]'}>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">姓名</TableHead>
              {showDataCenter && (
                <TableHead className="text-muted-foreground">机房</TableHead>
              )}
              <TableHead className="text-muted-foreground">手机号</TableHead>
              <TableHead className="text-muted-foreground">邮箱</TableHead>
              <TableHead className="text-muted-foreground">微信号</TableHead>
              <TableHead className="w-12 text-muted-foreground" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {engineers.map((engineer) => (
              <TableRow key={engineer.id} className="border-border">
                <TableCell className="font-medium text-foreground">{engineer.name}</TableCell>
                {showDataCenter && (
                  <TableCell className="text-foreground">{engineer.dataCenterName}</TableCell>
                )}
                <TableCell className="text-foreground">{engineer.phone || '—'}</TableCell>
                <TableCell className="break-all text-foreground">{engineer.email || '—'}</TableCell>
                <TableCell className="text-foreground">{engineer.wechatId || '—'}</TableCell>
                <TableCell>
                  <CopyToClipboard
                    text={formatSupplierOpsEngineerRow(engineer)}
                    tooltip="复制该行联系方式"
                    successMessage="已复制该行联系方式"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
