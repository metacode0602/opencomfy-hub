"use client"

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
import { LocaleLink } from "@/lib/i18n/navigation"
import { useTenantName } from "@/lib/crm/crm-lookups"
import { useCrmMockStore } from "@/lib/stores/crm-mock-store"

function TenantCell({ id }: { id: string }) {
  const n = useTenantName(id)
  return <span>{n}</span>
}

export function CrmTimelineListClient() {
  const rows = useCrmMockStore((s) => s.accountActivities)

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>时间线</CardTitle>
          <CardDescription>客户动态只读投影（全局列表）</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>租户</TableHead>
                <TableHead>发生时间</TableHead>
                <TableHead>标题</TableHead>
                <TableHead>关联域</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...rows]
                .sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1))
                .map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <TenantCell id={r.tenant_id} />
                    </TableCell>
                    <TableCell className="tabular-nums text-xs">{r.occurred_at}</TableCell>
                    <TableCell>{r.title_snapshot ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.ref_domain ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <LocaleLink href={`/crm/timeline/${encodeURIComponent(r.id)}`}>
                          详情
                        </LocaleLink>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
