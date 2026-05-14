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
import { LocaleLink } from "@/lib/i18n/navigation"
import { useTenantName } from "@/lib/crm/crm-lookups"
import { useCrmMockStore } from "@/lib/stores/crm-mock-store"
import { IconPlus } from "@tabler/icons-react"
import { CrmDeleteDialog } from "./crm-delete-dialog"
import { Input } from "@workspace/ui/components/input"

function TenantCell({ id }: { id: string }) {
  const name = useTenantName(id)
  return <span>{name}</span>
}

export function CrmContractsListClient() {
  const rows = useCrmMockStore((s) => s.contractSnapshots)
  const removeContract = useCrmMockStore((s) => s.removeContract)
  const [del, setDel] = React.useState<{ id: string; label: string } | null>(null)

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>合同摘要</CardTitle>
            <CardDescription>全局列表；可按租户进入详情辐射导航</CardDescription>
          </div>
          <Button asChild className="gap-2">
            <LocaleLink href="/crm/contracts/new">
              <IconPlus className="size-4" />
              新建合同摘要
            </LocaleLink>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="筛选：合同编号 / 签约日 / 金额摘要"
            className="max-w-md"
          />
          <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>租户</TableHead>
                <TableHead>合同编号</TableHead>
                <TableHead>签约日</TableHead>
                <TableHead>金额摘要</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <TenantCell id={r.tenant_id} />
                      <Button variant="link" className="h-auto p-0 text-xs" asChild>
                        <LocaleLink href={`/crm/tenants/${r.tenant_id}`}>租户详情</LocaleLink>
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>{r.contract_no ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">{r.signed_on ?? "—"}</TableCell>
                  <TableCell>{r.amount_summary ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <LocaleLink href={`/crm/contracts/${encodeURIComponent(r.id)}`}>
                          详情
                        </LocaleLink>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <LocaleLink href={`/crm/contracts/${encodeURIComponent(r.id)}/edit`}>
                          编辑
                        </LocaleLink>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        type="button"
                        onClick={() =>
                          setDel({ id: r.id, label: r.contract_no ?? r.id })
                        }
                      >
                        删除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      <CrmDeleteDialog
        open={del != null}
        onOpenChange={(o) => {
          if (!o) setDel(null)
        }}
        title="确认删除合同摘要？"
        description={del ? `合同：${del.label}` : ""}
        onConfirm={() => {
          if (del) removeContract(del.id)
        }}
      />
    </div>
  )
}
