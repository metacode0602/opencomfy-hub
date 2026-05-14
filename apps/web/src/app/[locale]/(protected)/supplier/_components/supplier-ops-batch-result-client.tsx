"use client"

import * as React from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { LocaleLink, useLocaleRouter } from "@/lib/i18n/navigation"
import { useSupplierLabel } from "@/lib/supplier/supplier-domain-lookups"
import {
  accessMethodLabel,
  idcOptionLabel,
  OPS_KIND_UI,
} from "@/lib/supplier-ops/ui-meta"
import { useSupplierOpsBatchMockStore } from "@/lib/stores/supplier-ops-batch-mock-store"
import type { SupplierOpsBatchKind } from "@/lib/types/supplier-ops-batch"

export function SupplierOpsBatchResultClient({
  kind,
  batchId,
}: {
  kind: SupplierOpsBatchKind
  batchId: string
}) {
  const router = useLocaleRouter()
  const ui = OPS_KIND_UI[kind]
  const row = useSupplierOpsBatchMockStore((s) => s.batches.find((b) => b.id === batchId && b.kind === kind))
  const supplierName = useSupplierLabel(row?.supplier_id ?? "")

  if (!row) {
    return (
      <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>未找到导入结果</CardTitle>
            <CardDescription>链接可能过期或批次已删除。</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="outline" onClick={() => router.push(ui.basePath)}>
              返回列表
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>解析成功</CardTitle>
            <CardDescription>
              本次共解析 {row.rows.length} 行。以下为 mock 明文展示，仅用于本地联调；生产环境请走密钥托管与脱敏。
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <LocaleLink href={ui.basePath}>返回列表</LocaleLink>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <LocaleLink href={`${ui.basePath}/${encodeURIComponent(row.id)}`}>批次详情</LocaleLink>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <div className="text-muted-foreground text-xs">供应商</div>
              <div className="text-sm font-medium">{supplierName}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">机房</div>
              <div className="text-sm">{idcOptionLabel(row.idc_code)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">接入方式</div>
              <div className="text-sm">{accessMethodLabel(row.access_method)}</div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-muted-foreground text-xs">文件</div>
              <div className="text-sm break-all">{row.file_name}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">批次 ID</div>
              <div className="font-mono text-xs break-all">{row.id}</div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>公网 IP</TableHead>
                  <TableHead>内网 IP</TableHead>
                  <TableHead>root 账号</TableHead>
                  <TableHead>密码（明文 mock）</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {row.rows.map((r, i) => (
                  <TableRow key={`${r.public_ip}-${i}`}>
                    <TableCell className="tabular-nums text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">{r.public_ip}</TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">{r.private_ip}</TableCell>
                    <TableCell className="font-mono text-xs">{r.root_account}</TableCell>
                    <TableCell className="font-mono text-xs">{r.root_password}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
