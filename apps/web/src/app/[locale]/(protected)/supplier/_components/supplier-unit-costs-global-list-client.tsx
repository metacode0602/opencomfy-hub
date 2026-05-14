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
import { Input } from "@workspace/ui/components/input"
import { LocaleLink } from "@/lib/i18n/navigation"
import { useSupplierLabel, useTermsVersionLabel } from "@/lib/supplier/supplier-domain-lookups"
import { useSupplierDomainMockStore } from "@/lib/stores/supplier-domain-mock-store"
import { IconPlus } from "@tabler/icons-react"
import { CrmDeleteDialog } from "../../crm/_components/crm-delete-dialog"

function SupplierCell({ supplierId }: { supplierId: string }) {
  const label = useSupplierLabel(supplierId)
  return <span className="font-medium">{label}</span>
}

function TermsCell({ termsId }: { termsId: string }) {
  const label = useTermsVersionLabel(termsId)
  return <span className="text-sm">{label}</span>
}

function tierSummary(tier: Record<string, unknown> | null): string {
  if (tier == null) return "—"
  const keys = Object.keys(tier)
  if (keys.length === 0) return "—"
  const s = JSON.stringify(tier)
  return s.length > 48 ? `${s.slice(0, 45)}…` : s
}

export function SupplierUnitCostsGlobalListClient() {
  const rows = useSupplierDomainMockStore((s) => s.unitCosts)
  const removeUnitCost = useSupplierDomainMockStore((s) => s.removeUnitCost)
  const [kw, setKw] = React.useState("")
  const [del, setDel] = React.useState<{ id: string; label: string } | null>(null)

  const filtered = React.useMemo(() => {
    const q = kw.trim().toLowerCase()
    if (!q) return rows
    const st = useSupplierDomainMockStore.getState()
    return rows.filter((r) => {
      const sup = st.suppliers.find((s) => s.id === r.supplier_id)
      const tv = st.termsVersions.find((t) => t.id === r.supplier_terms_version_id)
      const blob = [
        sup?.code,
        sup?.name,
        sup?.short_name,
        tv?.deal_mode,
        r.supplier_terms_version_id,
        r.idc_code,
        r.card_type,
        r.unit_cost,
        r.percent,
        tierSummary(r.tier_json),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return blob.includes(q)
    })
  }, [rows, kw])

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>卡型单价</CardTitle>
            <CardDescription>
              对应逻辑表 supplier_unit_cost：条款版本、机房编码、卡型、单价、分成比例与阶梯表；新建请在各供应商的「条款单价/分成档」关系中操作
            </CardDescription>
          </div>
          <Button asChild variant="outline" className="shrink-0 gap-2">
            <LocaleLink href="/supplier">
              <IconPlus className="size-4" />
              去供应商中心
            </LocaleLink>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="筛选：供应商 / 条款 / 机房 / 卡型 / 单价 / 比例"
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            className="max-w-md"
          />
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>供应商</TableHead>
                  <TableHead>条款版本</TableHead>
                  <TableHead>机房编码</TableHead>
                  <TableHead>卡型 / SKU</TableHead>
                  <TableHead>单价</TableHead>
                  <TableHead>分成比例</TableHead>
                  <TableHead>阶梯档</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <SupplierCell supplierId={r.supplier_id} />
                        <Button variant="link" className="h-auto p-0 text-xs" asChild>
                          <LocaleLink href={`/supplier/${encodeURIComponent(r.supplier_id)}`}>
                            供应商详情
                          </LocaleLink>
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <TermsCell termsId={r.supplier_terms_version_id} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.idc_code}</TableCell>
                    <TableCell>{r.card_type}</TableCell>
                    <TableCell className="tabular-nums">{r.unit_cost ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{r.percent != null ? `${r.percent}` : "—"}</TableCell>
                    <TableCell className="max-w-[12rem] truncate font-mono text-xs text-muted-foreground">
                      {tierSummary(r.tier_json)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <LocaleLink
                            href={`/supplier/${encodeURIComponent(r.supplier_id)}/relations/unit-costs/${encodeURIComponent(r.id)}`}
                          >
                            详情
                          </LocaleLink>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <LocaleLink
                            href={`/supplier/${encodeURIComponent(r.supplier_id)}/relations/unit-costs/${encodeURIComponent(r.id)}/edit`}
                          >
                            编辑
                          </LocaleLink>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          type="button"
                          onClick={() =>
                            setDel({
                              id: r.id,
                              label: `${r.card_type} · ${r.idc_code}`,
                            })
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
        title="确认删除卡型单价行？"
        description={del ? `记录：${del.label}` : ""}
        onConfirm={() => {
          if (del) removeUnitCost(del.id)
        }}
      />
    </div>
  )
}
