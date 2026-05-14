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
import { useBatchCode, useContractNo, useSupplierLabel } from "@/lib/supplier/supplier-domain-lookups"
import { useSupplierDomainMockStore } from "@/lib/stores/supplier-domain-mock-store"
import { IconPlus } from "@tabler/icons-react"
import { CrmDeleteDialog } from "../../crm/_components/crm-delete-dialog"

function SupplierCell({ supplierId }: { supplierId: string }) {
  const label = useSupplierLabel(supplierId)
  return <span className="font-medium">{label}</span>
}

function ContractCell({ contractId }: { contractId: string | null }) {
  const no = useContractNo(contractId ?? "")
  return <span className="text-sm">{contractId ? no : "—"}</span>
}

function BatchCell({ batchId }: { batchId: string }) {
  const code = useBatchCode(batchId)
  return <span className="font-mono text-xs">{code}</span>
}

export function SupplierDevicesGlobalListClient() {
  const rows = useSupplierDomainMockStore((s) => s.devices)
  const removeDevice = useSupplierDomainMockStore((s) => s.removeDevice)
  const [kw, setKw] = React.useState("")
  const [del, setDel] = React.useState<{ id: string; label: string } | null>(null)

  const filtered = React.useMemo(() => {
    const q = kw.trim().toLowerCase()
    if (!q) return rows
    const st = useSupplierDomainMockStore.getState()
    return rows.filter((r) => {
      const sup = st.suppliers.find((s) => s.id === r.supplier_id)
      const con = r.contract_id ? st.contracts.find((c) => c.id === r.contract_id) : undefined
      const batch = st.onboardingBatches.find((b) => b.id === r.onboarding_batch_id)
      const blob = [
        sup?.code,
        sup?.name,
        sup?.short_name,
        con?.contract_no,
        batch?.batch_code,
        r.asset_no,
        r.sn,
        r.lifecycle_status,
        r.onboarding_substage,
        r.idc_region,
        r.idc_code,
        r.card_type,
        r.gpu_count,
        r.external_ip,
        r.internal_ip,
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
            <CardTitle>设备</CardTitle>
            <CardDescription>
              对应逻辑表 device（物理设备）：归属供应商、可选合同、接入批次、资产与序列号、生命周期与接入子阶段、机房、卡型与 GPU 数、内外网 IP；新建请在各供应商的「物理设备」关系中操作
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
            placeholder="筛选：供应商 / 资产号 / SN / 合同 / 批次 / 状态 / 机房 / 卡型 / IP"
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            className="max-w-md"
          />
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>供应商</TableHead>
                  <TableHead>资产号</TableHead>
                  <TableHead>序列号 SN</TableHead>
                  <TableHead>合同编号</TableHead>
                  <TableHead>接入批次</TableHead>
                  <TableHead>生命周期</TableHead>
                  <TableHead>接入子阶段</TableHead>
                  <TableHead>机房地域</TableHead>
                  <TableHead>机房编码</TableHead>
                  <TableHead>GPU 数</TableHead>
                  <TableHead>卡型</TableHead>
                  <TableHead>外网 IP</TableHead>
                  <TableHead>内网 IP</TableHead>
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
                    <TableCell className="font-mono text-xs">{r.asset_no}</TableCell>
                    <TableCell className="font-mono text-xs">{r.sn}</TableCell>
                    <TableCell>
                      <ContractCell contractId={r.contract_id} />
                    </TableCell>
                    <TableCell>
                      <BatchCell batchId={r.onboarding_batch_id} />
                    </TableCell>
                    <TableCell>{r.lifecycle_status}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{r.onboarding_substage}</TableCell>
                    <TableCell>{r.idc_region}</TableCell>
                    <TableCell className="font-mono text-xs">{r.idc_code}</TableCell>
                    <TableCell className="tabular-nums">{r.gpu_count}</TableCell>
                    <TableCell>{r.card_type}</TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">{r.external_ip}</TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">{r.internal_ip}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <LocaleLink
                            href={`/supplier/${encodeURIComponent(r.supplier_id)}/relations/devices/${encodeURIComponent(r.id)}`}
                          >
                            详情
                          </LocaleLink>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <LocaleLink
                            href={`/supplier/${encodeURIComponent(r.supplier_id)}/relations/devices/${encodeURIComponent(r.id)}/edit`}
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
                              label: `${r.asset_no} / ${r.sn}`,
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
        title="确认删除设备？"
        description={
          del
            ? `设备：${del.label}；将级联删除关联计算节点、任务、故障等 mock 数据。`
            : ""
        }
        onConfirm={() => {
          if (del) removeDevice(del.id)
        }}
      />
    </div>
  )
}
