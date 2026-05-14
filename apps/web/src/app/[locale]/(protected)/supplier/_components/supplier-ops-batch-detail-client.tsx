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

function maskPwd() {
  return "••••••••"
}

export function SupplierOpsBatchDetailClient({
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
            <CardTitle>未找到批次</CardTitle>
            <CardDescription>可能已被删除或链接无效。</CardDescription>
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
            <CardTitle>{ui.title} · 详情</CardTitle>
            <CardDescription>批次 {row.id}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <LocaleLink href={ui.basePath}>返回列表</LocaleLink>
            </Button>
            <Button size="sm" asChild>
              <LocaleLink href={`${ui.basePath}/results/${encodeURIComponent(row.id)}`}>
                查看解析结果（含密码）
              </LocaleLink>
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
            <div>
              <div className="text-muted-foreground text-xs">文件名</div>
              <div className="text-sm break-all">{row.file_name}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">行数</div>
              <div className="text-sm tabular-nums">{row.rows.length}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">创建时间</div>
              <div className="text-sm tabular-nums text-muted-foreground">
                {row.created_at.replace("T", " ").slice(0, 19)}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium">主机清单（密码已掩码）</div>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>公网 IP</TableHead>
                    <TableHead>内网 IP</TableHead>
                    <TableHead>root 账号</TableHead>
                    <TableHead>密码</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {row.rows.map((r, i) => (
                    <TableRow key={`${r.public_ip}-${i}`}>
                      <TableCell className="font-mono text-xs tabular-nums">{r.public_ip}</TableCell>
                      <TableCell className="font-mono text-xs tabular-nums">{r.private_ip}</TableCell>
                      <TableCell className="font-mono text-xs">{r.root_account}</TableCell>
                      <TableCell className="font-mono text-xs">{maskPwd()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
