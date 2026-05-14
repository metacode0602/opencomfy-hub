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
import {
  useBatchCode,
  useContractNo,
  useDeviceLabel,
  useSupplierLabel,
  useTermsVersionLabel,
} from "@/lib/supplier/supplier-domain-lookups"
import { supplierRelationScope } from "@/lib/supplier/supplier-relation-scope"
import { useSupplierDomainMockStore } from "@/lib/stores/supplier-domain-mock-store"
import type { SupplierRelationKey } from "@/lib/types/supplier-domain"
import { SUPPLIER_RELATION_TITLES } from "@/lib/types/supplier-domain"
import { IconPlus } from "@tabler/icons-react"
import { CrmDeleteDialog } from "../../crm/_components/crm-delete-dialog"

export function SupplierRelationListClient({
  supplierId,
  relation,
}: {
  supplierId: string
  relation: SupplierRelationKey
}) {
  const supplierLabel = useSupplierLabel(supplierId)
  const contracts = useSupplierDomainMockStore((s) => s.contracts)
  const termsVersions = useSupplierDomainMockStore((s) => s.termsVersions)
  const unitCosts = useSupplierDomainMockStore((s) => s.unitCosts)
  const accessSheets = useSupplierDomainMockStore((s) => s.accessSheets)
  const onboardingBatches = useSupplierDomainMockStore((s) => s.onboardingBatches)
  const devices = useSupplierDomainMockStore((s) => s.devices)
  const computeNodes = useSupplierDomainMockStore((s) => s.computeNodes)
  const onboardingTasks = useSupplierDomainMockStore((s) => s.onboardingTasks)
  const faultIncidents = useSupplierDomainMockStore((s) => s.faultIncidents)
  const internalTestHolds = useSupplierDomainMockStore((s) => s.internalTestHolds)
  const resourcePoolBindings = useSupplierDomainMockStore((s) => s.resourcePoolBindings)
  const lifecycleStateDefinitions = useSupplierDomainMockStore((s) => s.lifecycleStateDefinitions)
  const entityStateTransitionLogs = useSupplierDomainMockStore((s) => s.entityStateTransitionLogs)

  const scope = React.useMemo(
    () => supplierRelationScope(useSupplierDomainMockStore.getState(), supplierId),
    [
      supplierId,
      contracts,
      devices,
      computeNodes,
      termsVersions,
      onboardingBatches,
    ],
  )

  const base = `/supplier/${supplierId}/relations/${relation}`
  const [del, setDel] = React.useState<{ id: string; label: string } | null>(null)

  const removeRow = React.useCallback(() => {
    if (!del) return
    const id = del.id
    const st = useSupplierDomainMockStore.getState()
    switch (relation) {
      case "contracts":
        st.removeContract(id)
        break
      case "terms-versions":
        st.removeTermsVersion(id)
        break
      case "unit-costs":
        st.removeUnitCost(id)
        break
      case "access-sheets":
        st.removeAccessSheet(id)
        break
      case "onboarding-batches":
        st.removeOnboardingBatch(id)
        break
      case "devices":
        st.removeDevice(id)
        break
      case "compute-nodes":
        st.removeComputeNode(id)
        break
      case "onboarding-tasks":
        st.removeOnboardingTask(id)
        break
      case "fault-incidents":
        st.removeFaultIncident(id)
        break
      case "test-holds":
        st.removeInternalTestHold(id)
        break
      case "pool-bindings":
        st.removeResourcePoolBinding(id)
        break
      case "state-definitions":
        st.removeLifecycleStateDefinition(id)
        break
      case "transition-logs":
        st.removeEntityStateTransitionLog(id)
        break
      default:
        break
    }
    setDel(null)
  }, [del, relation])

  const filteredContracts = contracts.filter((c) => c.supplier_id === supplierId)
  const filteredTerms = termsVersions.filter(
    (t) => t.supplier_id === supplierId || (t.contract_id != null && scope.contractIds.has(t.contract_id)),
  )
  const filteredUnitCosts = unitCosts.filter((u) => u.supplier_id === supplierId)
  const filteredSheets = accessSheets.filter((a) => scope.contractIds.has(a.contract_id))
  const filteredBatches = onboardingBatches.filter((b) => scope.contractIds.has(b.contract_id))
  const filteredDevices = devices.filter((d) => d.supplier_id === supplierId)
  const filteredNodes = computeNodes.filter((n) => scope.deviceIds.has(n.device_id))
  const filteredTasks = onboardingTasks.filter(
    (t) =>
      scope.deviceIds.has(t.device_id ?? "") ||
      onboardingBatches.some(
        (b) => b.id === t.onboarding_batch_id && scope.contractIds.has(b.contract_id),
      ),
  )
  const filteredFaults = faultIncidents.filter(
    (f) =>
      (f.device_id != null && scope.deviceIds.has(f.device_id)) ||
      (f.compute_node_id != null && scope.nodeIds.has(f.compute_node_id)),
  )
  const filteredHolds = internalTestHolds.filter(
    (h) =>
      (h.device_id != null && scope.deviceIds.has(h.device_id)) ||
      (h.compute_node_id != null && scope.nodeIds.has(h.compute_node_id)),
  )
  const filteredBindings = resourcePoolBindings.filter((r) => scope.deviceIds.has(r.device_id))
  const filteredLogs = entityStateTransitionLogs.filter(
    (e) =>
      (e.entity_type === "device" && scope.deviceIds.has(e.entity_id)) ||
      (e.entity_type === "compute_node" && scope.nodeIds.has(e.entity_id)),
  )

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>{SUPPLIER_RELATION_TITLES[relation]}</CardTitle>
            <CardDescription>
              供应商：{supplierLabel}（{supplierId}）
              {relation === "state-definitions" ? " · 全局字典，本页展示全部条目" : null}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <LocaleLink href={`/supplier/${supplierId}`}>返回供应商详情</LocaleLink>
            </Button>
            <Button className="gap-2" size="sm" asChild>
              <LocaleLink href={`${base}/new`}>
                <IconPlus className="size-4" />
                新建
              </LocaleLink>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto rounded-md border">
          {relation === "contracts" && (
            <ContractsTable
              rows={filteredContracts}
              base={base}
              onDelete={(id, label) => setDel({ id, label })}
            />
          )}
          {relation === "terms-versions" && (
            <TermsTable rows={filteredTerms} base={base} supplierId={supplierId} onDelete={setDel} />
          )}
          {relation === "unit-costs" && (
            <UnitCostsTable rows={filteredUnitCosts} base={base} onDelete={setDel} />
          )}
          {relation === "access-sheets" && (
            <SheetsTable rows={filteredSheets} base={base} onDelete={setDel} />
          )}
          {relation === "onboarding-batches" && (
            <BatchesTable rows={filteredBatches} base={base} onDelete={setDel} />
          )}
          {relation === "devices" && (
            <DevicesTable rows={filteredDevices} base={base} onDelete={setDel} />
          )}
          {relation === "compute-nodes" && (
            <NodesTable rows={filteredNodes} base={base} onDelete={setDel} />
          )}
          {relation === "onboarding-tasks" && (
            <TasksTable rows={filteredTasks} base={base} onDelete={setDel} />
          )}
          {relation === "fault-incidents" && (
            <FaultsTable rows={filteredFaults} base={base} onDelete={setDel} />
          )}
          {relation === "test-holds" && (
            <HoldsTable rows={filteredHolds} base={base} onDelete={setDel} />
          )}
          {relation === "pool-bindings" && (
            <BindingsTable rows={filteredBindings} base={base} onDelete={setDel} />
          )}
          {relation === "state-definitions" && (
            <StateDefsTable rows={lifecycleStateDefinitions} base={base} onDelete={setDel} />
          )}
          {relation === "transition-logs" && (
            <LogsTable rows={filteredLogs} base={base} onDelete={setDel} />
          )}
        </CardContent>
      </Card>

      <CrmDeleteDialog
        open={del != null}
        onOpenChange={(o) => !o && setDel(null)}
        title="确认删除"
        description={del ? `确定删除「${del.label}」吗？此操作在 mock 中不可恢复。` : ""}
        onConfirm={removeRow}
      />
    </div>
  )
}

function ContractsTable({
  rows,
  base,
  onDelete,
}: {
  rows: { id: string; contract_no: string; status: string; effective_from: string; effective_to: string }[]
  base: string
  onDelete: (id: string, label: string) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>合同编号</TableHead>
          <TableHead>状态</TableHead>
          <TableHead>生效起</TableHead>
          <TableHead>生效止</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="font-mono text-xs">{r.contract_no}</TableCell>
            <TableCell>{r.status}</TableCell>
            <TableCell>{r.effective_from}</TableCell>
            <TableCell>{r.effective_to}</TableCell>
            <TableCell className="text-right">
              <RowActions base={base} id={r.id} label={r.contract_no} onDelete={onDelete} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function TermsTable({
  rows,
  base,
  supplierId,
  onDelete,
}: {
  rows: {
    id: string
    supplier_id: string | null
    contract_id: string | null
    deal_mode: string
    effective_from: string
    effective_to: string | null
  }[]
  base: string
  supplierId: string
  onDelete: (v: { id: string; label: string }) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>归属</TableHead>
          <TableHead>合作模式</TableHead>
          <TableHead>生效起</TableHead>
          <TableHead>生效止</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              <TermsAnchor row={r} supplierId={supplierId} />
            </TableCell>
            <TableCell>{r.deal_mode}</TableCell>
            <TableCell className="text-xs">{r.effective_from}</TableCell>
            <TableCell className="text-xs">{r.effective_to ?? "—"}</TableCell>
            <TableCell className="text-right">
              <RowActions base={base} id={r.id} label={r.deal_mode} onDelete={(id, l) => onDelete({ id, label: l })} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function TermsAnchor({
  row,
  supplierId,
}: {
  row: { supplier_id: string | null; contract_id: string | null; id: string }
  supplierId: string
}) {
  const contractNo = useContractNo(row.contract_id ?? "")
  if (row.supplier_id === supplierId) {
    return <span>本供应商直挂</span>
  }
  if (row.contract_id) {
    return <span className="text-sm">合同 {contractNo}</span>
  }
  return <span>—</span>
}

function UnitCostsTable({
  rows,
  base,
  onDelete,
}: {
  rows: {
    id: string
    supplier_terms_version_id: string
    idc_code: string
    card_type: string
    unit_cost: string | null
    percent: string | null
  }[]
  base: string
  onDelete: (v: { id: string; label: string }) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>条款版本</TableHead>
          <TableHead>机房编码</TableHead>
          <TableHead>卡型</TableHead>
          <TableHead>卡时单价</TableHead>
          <TableHead>分成比例</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <UnitCostRow key={r.id} r={r} base={base} onDelete={onDelete} />
        ))}
      </TableBody>
    </Table>
  )
}

function UnitCostRow({
  r,
  base,
  onDelete,
}: {
  r: {
    id: string
    supplier_terms_version_id: string
    idc_code: string
    card_type: string
    unit_cost: string | null
    percent: string | null
  }
  base: string
  onDelete: (v: { id: string; label: string }) => void
}) {
  const tv = useTermsVersionLabel(r.supplier_terms_version_id)
  return (
    <TableRow>
      <TableCell className="text-sm">{tv}</TableCell>
      <TableCell>{r.idc_code}</TableCell>
      <TableCell>{r.card_type}</TableCell>
      <TableCell>{r.unit_cost ?? "—"}</TableCell>
      <TableCell>{r.percent ?? "—"}</TableCell>
      <TableCell className="text-right">
        <RowActions
          base={base}
          id={r.id}
          label={`${r.card_type}@${r.idc_code}`}
          onDelete={(id, l) => onDelete({ id, label: l })}
        />
      </TableCell>
    </TableRow>
  )
}

function SheetsTable({
  rows,
  base,
  onDelete,
}: {
  rows: { id: string; contract_id: string; version_no: number; is_current: boolean }[]
  base: string
  onDelete: (v: { id: string; label: string }) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>商务合同</TableHead>
          <TableHead>版本号</TableHead>
          <TableHead>当前版本</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <SheetRow key={r.id} r={r} base={base} onDelete={onDelete} />
        ))}
      </TableBody>
    </Table>
  )
}

function SheetRow({
  r,
  base,
  onDelete,
}: {
  r: { id: string; contract_id: string; version_no: number; is_current: boolean }
  base: string
  onDelete: (v: { id: string; label: string }) => void
}) {
  const cn = useContractNo(r.contract_id)
  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{cn}</TableCell>
      <TableCell>{r.version_no}</TableCell>
      <TableCell>{r.is_current ? "是" : "否"}</TableCell>
      <TableCell className="text-right">
        <RowActions
          base={base}
          id={r.id}
          label={`v${r.version_no}·${cn}`}
          onDelete={(id, l) => onDelete({ id, label: l })}
        />
      </TableCell>
    </TableRow>
  )
}

function BatchesTable({
  rows,
  base,
  onDelete,
}: {
  rows: {
    id: string
    batch_code: string
    batch_status: string
    planned_ready_at: string | null
    contract_id: string
  }[]
  base: string
  onDelete: (v: { id: string; label: string }) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>批次编码</TableHead>
          <TableHead>商务合同</TableHead>
          <TableHead>批次状态</TableHead>
          <TableHead>计划就绪</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <BatchRow key={r.id} r={r} base={base} onDelete={onDelete} />
        ))}
      </TableBody>
    </Table>
  )
}

function BatchRow({
  r,
  base,
  onDelete,
}: {
  r: {
    id: string
    batch_code: string
    batch_status: string
    planned_ready_at: string | null
    contract_id: string
  }
  base: string
  onDelete: (v: { id: string; label: string }) => void
}) {
  const cn = useContractNo(r.contract_id)
  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{r.batch_code}</TableCell>
      <TableCell className="text-xs">{cn}</TableCell>
      <TableCell>{r.batch_status}</TableCell>
      <TableCell className="text-xs">{r.planned_ready_at ?? "—"}</TableCell>
      <TableCell className="text-right">
        <RowActions base={base} id={r.id} label={r.batch_code} onDelete={(id, l) => onDelete({ id, label: l })} />
      </TableCell>
    </TableRow>
  )
}

function DevicesTable({
  rows,
  base,
  onDelete,
}: {
  rows: {
    id: string
    asset_no: string
    sn: string
    lifecycle_status: string
    card_type: string
    gpu_count: string
  }[]
  base: string
  onDelete: (v: { id: string; label: string }) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>资产号</TableHead>
          <TableHead>序列号</TableHead>
          <TableHead>生命周期</TableHead>
          <TableHead>卡型</TableHead>
          <TableHead>GPU 数</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="font-mono text-xs">{r.asset_no}</TableCell>
            <TableCell className="font-mono text-xs">{r.sn}</TableCell>
            <TableCell>{r.lifecycle_status}</TableCell>
            <TableCell>{r.card_type}</TableCell>
            <TableCell>{r.gpu_count}</TableCell>
            <TableCell className="text-right">
              <RowActions
                base={base}
                id={r.id}
                label={r.asset_no}
                onDelete={(id, l) => onDelete({ id, label: l })}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function NodesTable({
  rows,
  base,
  onDelete,
}: {
  rows: { id: string; device_id: string; node_role: string; mgmt_ip: string; cluster_id: string }[]
  base: string
  onDelete: (v: { id: string; label: string }) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>所属设备</TableHead>
          <TableHead>节点角色</TableHead>
          <TableHead>管控 IP</TableHead>
          <TableHead>集群</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <NodeRow key={r.id} r={r} base={base} onDelete={onDelete} />
        ))}
      </TableBody>
    </Table>
  )
}

function NodeRow({
  r,
  base,
  onDelete,
}: {
  r: { id: string; device_id: string; node_role: string; mgmt_ip: string; cluster_id: string }
  base: string
  onDelete: (v: { id: string; label: string }) => void
}) {
  const dev = useDeviceLabel(r.device_id)
  return (
    <TableRow>
      <TableCell className="text-sm">{dev}</TableCell>
      <TableCell>{r.node_role}</TableCell>
      <TableCell className="font-mono text-xs">{r.mgmt_ip}</TableCell>
      <TableCell className="font-mono text-xs">{r.cluster_id}</TableCell>
      <TableCell className="text-right">
        <RowActions base={base} id={r.id} label={r.mgmt_ip} onDelete={(id, l) => onDelete({ id, label: l })} />
      </TableCell>
    </TableRow>
  )
}

function TasksTable({
  rows,
  base,
  onDelete,
}: {
  rows: {
    id: string
    onboarding_batch_id: string
    device_id: string | null
    task_type: string
    task_status: string
  }[]
  base: string
  onDelete: (v: { id: string; label: string }) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>接入批次</TableHead>
          <TableHead>物理设备</TableHead>
          <TableHead>任务类型</TableHead>
          <TableHead>状态</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TaskRow key={r.id} r={r} base={base} onDelete={onDelete} />
        ))}
      </TableBody>
    </Table>
  )
}

function TaskRow({
  r,
  base,
  onDelete,
}: {
  r: {
    id: string
    onboarding_batch_id: string
    device_id: string | null
    task_type: string
    task_status: string
  }
  base: string
  onDelete: (v: { id: string; label: string }) => void
}) {
  const bc = useBatchCode(r.onboarding_batch_id)
  const devLab = useDeviceLabel(r.device_id ?? "")
  const dev = r.device_id ? devLab : "—"
  return (
    <TableRow>
      <TableCell className="text-xs">{bc}</TableCell>
      <TableCell className="text-xs">{dev}</TableCell>
      <TableCell>{r.task_type}</TableCell>
      <TableCell>{r.task_status}</TableCell>
      <TableCell className="text-right">
        <RowActions base={base} id={r.id} label={r.task_type} onDelete={(id, l) => onDelete({ id, label: l })} />
      </TableCell>
    </TableRow>
  )
}

function FaultsTable({
  rows,
  base,
  onDelete,
}: {
  rows: {
    id: string
    device_id: string | null
    compute_node_id: string | null
    severity: string
    incident_status: string
    opened_at: string
  }[]
  base: string
  onDelete: (v: { id: string; label: string }) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>设备/节点</TableHead>
          <TableHead>严重度</TableHead>
          <TableHead>状态</TableHead>
          <TableHead>打开时间</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <FaultRow key={r.id} r={r} base={base} onDelete={onDelete} />
        ))}
      </TableBody>
    </Table>
  )
}

function FaultRow({
  r,
  base,
  onDelete,
}: {
  r: {
    id: string
    device_id: string | null
    compute_node_id: string | null
    severity: string
    incident_status: string
    opened_at: string
  }
  base: string
  onDelete: (v: { id: string; label: string }) => void
}) {
  const devLab = useDeviceLabel(r.device_id ?? "")
  const who = r.device_id
    ? devLab
    : r.compute_node_id
      ? `节点 ${r.compute_node_id.slice(0, 8)}…`
      : "—"
  return (
    <TableRow>
      <TableCell className="text-sm">{who}</TableCell>
      <TableCell>{r.severity}</TableCell>
      <TableCell>{r.incident_status}</TableCell>
      <TableCell className="text-xs">{r.opened_at}</TableCell>
      <TableCell className="text-right">
        <RowActions base={base} id={r.id} label={r.id} onDelete={(id, l) => onDelete({ id, label: l })} />
      </TableCell>
    </TableRow>
  )
}

function HoldsTable({
  rows,
  base,
  onDelete,
}: {
  rows: { id: string; device_id: string | null; compute_node_id: string | null; scope: string }[]
  base: string
  onDelete: (v: { id: string; label: string }) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>设备/节点</TableHead>
          <TableHead>占用粒度</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <HoldRow key={r.id} r={r} base={base} onDelete={onDelete} />
        ))}
      </TableBody>
    </Table>
  )
}

function HoldRow({
  r,
  base,
  onDelete,
}: {
  r: { id: string; device_id: string | null; compute_node_id: string | null; scope: string }
  base: string
  onDelete: (v: { id: string; label: string }) => void
}) {
  const devLab = useDeviceLabel(r.device_id ?? "")
  const who = r.device_id
    ? devLab
    : r.compute_node_id
      ? `节点 ${r.compute_node_id.slice(0, 8)}…`
      : "—"
  return (
    <TableRow>
      <TableCell className="text-sm">{who}</TableCell>
      <TableCell>{r.scope}</TableCell>
      <TableCell className="text-right">
        <RowActions base={base} id={r.id} label={r.scope} onDelete={(id, l) => onDelete({ id, label: l })} />
      </TableCell>
    </TableRow>
  )
}

function BindingsTable({
  rows,
  base,
  onDelete,
}: {
  rows: { id: string; device_id: string; workload_profile: string; is_exclusive_pool: boolean }[]
  base: string
  onDelete: (v: { id: string; label: string }) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>物理设备</TableHead>
          <TableHead>工作负载形态</TableHead>
          <TableHead>互斥池</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <BindingRow key={r.id} r={r} base={base} onDelete={onDelete} />
        ))}
      </TableBody>
    </Table>
  )
}

function BindingRow({
  r,
  base,
  onDelete,
}: {
  r: { id: string; device_id: string; workload_profile: string; is_exclusive_pool: boolean }
  base: string
  onDelete: (v: { id: string; label: string }) => void
}) {
  const dev = useDeviceLabel(r.device_id)
  return (
    <TableRow>
      <TableCell className="text-sm">{dev}</TableCell>
      <TableCell>{r.workload_profile}</TableCell>
      <TableCell>{r.is_exclusive_pool ? "是" : "否"}</TableCell>
      <TableCell className="text-right">
        <RowActions
          base={base}
          id={r.id}
          label={r.workload_profile}
          onDelete={(id, l) => onDelete({ id, label: l })}
        />
      </TableCell>
    </TableRow>
  )
}

function StateDefsTable({
  rows,
  base,
  onDelete,
}: {
  rows: { id: string; domain: string; state_code: string; display_name: string; sort_order: number }[]
  base: string
  onDelete: (v: { id: string; label: string }) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>领域</TableHead>
          <TableHead>状态代码</TableHead>
          <TableHead>显示名称</TableHead>
          <TableHead>排序</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>{r.domain}</TableCell>
            <TableCell className="font-mono text-xs">{r.state_code}</TableCell>
            <TableCell>{r.display_name}</TableCell>
            <TableCell>{r.sort_order}</TableCell>
            <TableCell className="text-right">
              <RowActions
                base={base}
                id={r.id}
                label={r.display_name}
                onDelete={(id, l) => onDelete({ id, label: l })}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function LogsTable({
  rows,
  base,
  onDelete,
}: {
  rows: {
    id: string
    entity_type: string
    entity_id: string
    from_state: string
    to_state: string
    occurred_at: string
  }[]
  base: string
  onDelete: (v: { id: string; label: string }) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>实体类型</TableHead>
          <TableHead>实体</TableHead>
          <TableHead>状态迁移</TableHead>
          <TableHead>发生时间</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <LogRow key={r.id} r={r} base={base} onDelete={onDelete} />
        ))}
      </TableBody>
    </Table>
  )
}

function LogRow({
  r,
  base,
  onDelete,
}: {
  r: {
    id: string
    entity_type: string
    entity_id: string
    from_state: string
    to_state: string
    occurred_at: string
  }
  base: string
  onDelete: (v: { id: string; label: string }) => void
}) {
  const devLab = useDeviceLabel(r.entity_type === "device" ? r.entity_id : "")
  const entityLabel =
    r.entity_type === "device" ? devLab : `节点 ${r.entity_id.slice(0, 8)}…`
  return (
    <TableRow>
      <TableCell>{r.entity_type}</TableCell>
      <TableCell className="max-w-[200px] truncate text-xs">{entityLabel}</TableCell>
      <TableCell className="text-xs">
        {r.from_state} → {r.to_state}
      </TableCell>
      <TableCell className="text-xs">{r.occurred_at}</TableCell>
      <TableCell className="text-right">
        <RowActions base={base} id={r.id} label={r.id} onDelete={(id, l) => onDelete({ id, label: l })} />
      </TableCell>
    </TableRow>
  )
}

function RowActions({
  base,
  id,
  label,
  onDelete,
}: {
  base: string
  id: string
  label: string
  onDelete: (id: string, label: string) => void
}) {
  const encoded = encodeURIComponent(id)
  return (
    <>
      <Button variant="link" className="h-auto p-0" asChild>
        <LocaleLink href={`${base}/${encoded}`}>详情</LocaleLink>
      </Button>
      <span className="text-muted-foreground mx-2">|</span>
      <Button variant="link" className="h-auto p-0" asChild>
        <LocaleLink href={`${base}/${encoded}/edit`}>编辑</LocaleLink>
      </Button>
      <span className="text-muted-foreground mx-2">|</span>
      <Button variant="link" className="text-destructive h-auto p-0" type="button" onClick={() => onDelete(id, label)}>
        删除
      </Button>
    </>
  )
}
