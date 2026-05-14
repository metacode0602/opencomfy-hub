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
import { LocaleLink, useLocaleRouter } from "@/lib/i18n/navigation"
import {
  batchCodeSync,
  contractNoSync,
  deviceLabelSync,
  supplierLabelSync,
  termsVersionLabelSync,
  useSupplierLabel,
} from "@/lib/supplier/supplier-domain-lookups"
import { useSupplierDomainMockStore } from "@/lib/stores/supplier-domain-mock-store"
import type { SupplierRelationKey } from "@/lib/types/supplier-domain"
import { SUPPLIER_RELATION_TITLES } from "@/lib/types/supplier-domain"
import { CrmDeleteDialog } from "../../crm/_components/crm-delete-dialog"

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground mb-0.5 text-xs">{label}</div>
      <div className="text-sm break-all">{value}</div>
    </div>
  )
}

export function SupplierRelationDetailClient({
  supplierId,
  relation,
  recordId,
}: {
  supplierId: string
  relation: SupplierRelationKey
  recordId: string
}) {
  const router = useLocaleRouter()
  const id = decodeURIComponent(recordId)
  const supplierName = useSupplierLabel(supplierId)
  const base = `/supplier/${supplierId}/relations/${relation}`
  const s = useSupplierDomainMockStore()
  const [delOpen, setDelOpen] = React.useState(false)

  const remove = () => {
    switch (relation) {
      case "contracts":
        s.removeContract(id)
        break
      case "terms-versions":
        s.removeTermsVersion(id)
        break
      case "unit-costs":
        s.removeUnitCost(id)
        break
      case "access-sheets":
        s.removeAccessSheet(id)
        break
      case "onboarding-batches":
        s.removeOnboardingBatch(id)
        break
      case "devices":
        s.removeDevice(id)
        break
      case "compute-nodes":
        s.removeComputeNode(id)
        break
      case "onboarding-tasks":
        s.removeOnboardingTask(id)
        break
      case "fault-incidents":
        s.removeFaultIncident(id)
        break
      case "test-holds":
        s.removeInternalTestHold(id)
        break
      case "pool-bindings":
        s.removeResourcePoolBinding(id)
        break
      case "state-definitions":
        s.removeLifecycleStateDefinition(id)
        break
      case "transition-logs":
        s.removeEntityStateTransitionLog(id)
        break
      default:
        break
    }
    router.push(base)
  }

  const contract = s.contracts.find((c) => c.id === id)
  const terms = s.termsVersions.find((t) => t.id === id)
  const unit = s.unitCosts.find((u) => u.id === id)
  const sheet = s.accessSheets.find((a) => a.id === id)
  const batch = s.onboardingBatches.find((b) => b.id === id)
  const device = s.devices.find((d) => d.id === id)
  const node = s.computeNodes.find((n) => n.id === id)
  const task = s.onboardingTasks.find((t) => t.id === id)
  const fault = s.faultIncidents.find((f) => f.id === id)
  const hold = s.internalTestHolds.find((h) => h.id === id)
  const bind = s.resourcePoolBindings.find((r) => r.id === id)
  const lsd = s.lifecycleStateDefinitions.find((l) => l.id === id)
  const log = s.entityStateTransitionLogs.find((e) => e.id === id)

  const row =
    relation === "contracts"
      ? contract
      : relation === "terms-versions"
        ? terms
        : relation === "unit-costs"
          ? unit
          : relation === "access-sheets"
            ? sheet
            : relation === "onboarding-batches"
              ? batch
              : relation === "devices"
                ? device
                : relation === "compute-nodes"
                  ? node
                  : relation === "onboarding-tasks"
                    ? task
                    : relation === "fault-incidents"
                      ? fault
                      : relation === "test-holds"
                        ? hold
                        : relation === "pool-bindings"
                          ? bind
                          : relation === "state-definitions"
                            ? lsd
                            : log

  if (!row) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">未找到记录。</p>
        <Button className="mt-4" variant="outline" asChild>
          <LocaleLink href={base}>返回列表</LocaleLink>
        </Button>
      </div>
    )
  }

  const title =
    relation === "contracts"
      ? (row as typeof contract)!.contract_no
      : relation === "devices"
        ? (row as typeof device)!.asset_no
        : relation === "onboarding-batches"
          ? (row as typeof batch)!.batch_code
          : id

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{SUPPLIER_RELATION_TITLES[relation]}</h1>
            <p className="text-muted-foreground text-sm">
              {supplierName} · {String(title)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <LocaleLink href={base}>返回列表</LocaleLink>
            </Button>
            <Button variant="outline" asChild>
              <LocaleLink href={`${base}/${encodeURIComponent(id)}/edit`}>编辑</LocaleLink>
            </Button>
            <Button variant="destructive" type="button" onClick={() => setDelOpen(true)}>
              删除
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>详情</CardTitle>
            <CardDescription>字段中文说明（mock）</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            {relation === "contracts" && contract && (
              <>
                <Row label="主键" value={contract.id} />
                <Row label="供应商" value={supplierLabelSync(contract.supplier_id)} />
                <Row label="合同编号" value={contract.contract_no} />
                <Row label="合同链接" value={contract.contract_url || "—"} />
                <Row label="状态" value={contract.status} />
                <Row label="生效起" value={contract.effective_from} />
                <Row label="生效止" value={contract.effective_to} />
                <div className="sm:col-span-2 flex flex-wrap gap-2 pt-2">
                  <Button variant="outline" size="sm" asChild>
                    <LocaleLink href={`/supplier/${supplierId}/relations/access-sheets`}>接入条件单</LocaleLink>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <LocaleLink href={`/supplier/${supplierId}/relations/onboarding-batches`}>接入批次</LocaleLink>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <LocaleLink href={`/supplier/${supplierId}/relations/terms-versions`}>合作条款版本</LocaleLink>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <LocaleLink href={`/supplier/${supplierId}/relations/devices`}>物理设备</LocaleLink>
                  </Button>
                </div>
              </>
            )}
            {relation === "terms-versions" && terms && (
              <>
                <Row label="主键" value={terms.id} />
                <Row label="供应商（直挂）" value={terms.supplier_id ? supplierLabelSync(terms.supplier_id) : "—"} />
                <Row label="商务合同" value={terms.contract_id ? contractNoSync(terms.contract_id) : "—"} />
                <Row label="合作模式" value={terms.deal_mode} />
                <Row label="生效起" value={terms.effective_from} />
                <Row label="生效止" value={terms.effective_to ?? "—"} />
                <div className="sm:col-span-2">
                  <div className="text-muted-foreground mb-1 text-xs">条款参数 JSON</div>
                  <pre className="bg-muted max-h-48 overflow-auto rounded-md p-3 text-xs">
                    {JSON.stringify(terms.terms_json, null, 2)}
                  </pre>
                </div>
                <div className="sm:col-span-2">
                  <Button variant="outline" size="sm" asChild>
                    <LocaleLink href={`/supplier/${supplierId}/relations/unit-costs`}>条款单价/分成档</LocaleLink>
                  </Button>
                </div>
              </>
            )}
            {relation === "unit-costs" && unit && (
              <>
                <Row label="主键" value={unit.id} />
                <Row label="合作条款版本" value={termsVersionLabelSync(unit.supplier_terms_version_id)} />
                <Row label="供应商" value={supplierLabelSync(unit.supplier_id)} />
                <Row label="机房编码" value={unit.idc_code} />
                <Row label="卡型" value={unit.card_type} />
                <Row label="卡时单价" value={unit.unit_cost ?? "—"} />
                <Row label="分成比例" value={unit.percent ?? "—"} />
                <div className="sm:col-span-2">
                  <div className="text-muted-foreground mb-1 text-xs">阶梯表 JSON</div>
                  <pre className="bg-muted max-h-40 overflow-auto rounded-md p-3 text-xs">
                    {unit.tier_json ? JSON.stringify(unit.tier_json, null, 2) : "—"}
                  </pre>
                </div>
              </>
            )}
            {relation === "access-sheets" && sheet && (
              <>
                <Row label="主键" value={sheet.id} />
                <Row label="商务合同" value={contractNoSync(sheet.contract_id)} />
                <Row label="版本号" value={String(sheet.version_no)} />
                <Row label="当前版本" value={sheet.is_current ? "是" : "否"} />
                <div className="sm:col-span-2">
                  <div className="text-muted-foreground mb-1 text-xs">接入条件 JSON</div>
                  <pre className="bg-muted max-h-48 overflow-auto rounded-md p-3 text-xs">
                    {JSON.stringify(sheet.gpu_network_cpu_terms, null, 2)}
                  </pre>
                </div>
                <div className="sm:col-span-2">
                  <Button variant="outline" size="sm" asChild>
                    <LocaleLink href={`/supplier/${supplierId}/relations/onboarding-batches`}>接入批次</LocaleLink>
                  </Button>
                </div>
              </>
            )}
            {relation === "onboarding-batches" && batch && (
              <>
                <Row label="主键" value={batch.id} />
                <Row label="商务合同" value={contractNoSync(batch.contract_id)} />
                <Row label="接入条件单" value={batch.access_condition_sheet_id} />
                <Row label="批次编码" value={batch.batch_code} />
                <Row label="批次状态" value={batch.batch_status} />
                <Row label="计划就绪时间" value={batch.planned_ready_at ?? "—"} />
                <div className="sm:col-span-2 flex flex-wrap gap-2 pt-2">
                  <Button variant="outline" size="sm" asChild>
                    <LocaleLink href={`/supplier/${supplierId}/relations/devices`}>物理设备</LocaleLink>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <LocaleLink href={`/supplier/${supplierId}/relations/onboarding-tasks`}>接入施工任务</LocaleLink>
                  </Button>
                </div>
              </>
            )}
            {relation === "devices" && device && (
              <>
                <Row label="主键" value={device.id} />
                <Row label="供应商" value={supplierLabelSync(device.supplier_id)} />
                <Row label="商务合同" value={device.contract_id ? contractNoSync(device.contract_id) : "—"} />
                <Row label="接入批次" value={batchCodeSync(device.onboarding_batch_id)} />
                <Row label="资产号" value={device.asset_no} />
                <Row label="序列号" value={device.sn} />
                <Row label="生命周期状态" value={device.lifecycle_status} />
                <Row label="接入子阶段" value={device.onboarding_substage} />
                <Row label="机房地域" value={device.idc_region} />
                <Row label="机房编码" value={device.idc_code} />
                <Row label="GPU 卡数" value={device.gpu_count} />
                <Row label="卡型" value={device.card_type} />
                <Row label="外网 IP" value={device.external_ip} />
                <Row label="内网 IP" value={device.internal_ip} />
                <div className="sm:col-span-2 flex flex-wrap gap-2 pt-2">
                  <Button variant="outline" size="sm" asChild>
                    <LocaleLink href={`/supplier/${supplierId}/relations/compute-nodes`}>计算节点</LocaleLink>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <LocaleLink href={`/supplier/${supplierId}/relations/pool-bindings`}>资源池绑定</LocaleLink>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <LocaleLink href={`/supplier/${supplierId}/relations/fault-incidents`}>故障事件</LocaleLink>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <LocaleLink href={`/supplier/${supplierId}/relations/test-holds`}>内部测试占用</LocaleLink>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <LocaleLink href={`/supplier/${supplierId}/relations/transition-logs`}>状态变更审计</LocaleLink>
                  </Button>
                </div>
              </>
            )}
            {relation === "compute-nodes" && node && (
              <>
                <Row label="主键" value={node.id} />
                <Row label="物理设备" value={deviceLabelSync(node.device_id)} />
                <Row label="节点角色" value={node.node_role} />
                <Row label="管控 IP" value={node.mgmt_ip} />
                <Row label="集群 ID" value={node.cluster_id} />
                <Row label="生命周期状态" value={node.lifecycle_status} />
                <div className="sm:col-span-2 flex flex-wrap gap-2 pt-2">
                  <Button variant="outline" size="sm" asChild>
                    <LocaleLink href={`/supplier/${supplierId}/relations/fault-incidents`}>故障事件</LocaleLink>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <LocaleLink href={`/supplier/${supplierId}/relations/transition-logs`}>状态变更审计</LocaleLink>
                  </Button>
                </div>
              </>
            )}
            {relation === "onboarding-tasks" && task && (
              <>
                <Row label="主键" value={task.id} />
                <Row label="接入批次" value={batchCodeSync(task.onboarding_batch_id)} />
                <Row label="物理设备" value={task.device_id ? deviceLabelSync(task.device_id) : "—"} />
                <Row label="任务类型" value={task.task_type} />
                <Row label="负责人" value={task.assignee_id} />
                <Row label="任务状态" value={task.task_status} />
                <Row label="开始时间" value={task.started_at ?? "—"} />
                <Row label="结束时间" value={task.finished_at ?? "—"} />
              </>
            )}
            {relation === "fault-incidents" && fault && (
              <>
                <Row label="主键" value={fault.id} />
                <Row label="物理设备" value={fault.device_id ? deviceLabelSync(fault.device_id) : "—"} />
                <Row label="计算节点" value={fault.compute_node_id ?? "—"} />
                <Row label="严重程度" value={fault.severity} />
                <Row label="事件状态" value={fault.incident_status} />
                <Row label="闭环结果" value={fault.resolution_outcome || "—"} />
                <Row label="打开时间" value={fault.opened_at} />
                <Row label="关闭时间" value={fault.closed_at ?? "—"} />
              </>
            )}
            {relation === "test-holds" && hold && (
              <>
                <Row label="主键" value={hold.id} />
                <Row label="物理设备" value={hold.device_id ? deviceLabelSync(hold.device_id) : "—"} />
                <Row label="计算节点" value={hold.compute_node_id ?? "—"} />
                <Row label="占用粒度说明" value={hold.scope} />
                <Row label="占用开始" value={hold.hold_from} />
                <Row label="占用结束" value={hold.hold_until} />
              </>
            )}
            {relation === "pool-bindings" && bind && (
              <>
                <Row label="主键" value={bind.id} />
                <Row label="物理设备" value={deviceLabelSync(bind.device_id)} />
                <Row label="资源池 ID" value={bind.resource_pool_id ?? "—"} />
                <Row label="池编码" value={bind.pool_code ?? "—"} />
                <Row label="工作负载形态" value={bind.workload_profile} />
                <Row label="互斥池" value={bind.is_exclusive_pool ? "是" : "否"} />
              </>
            )}
            {relation === "state-definitions" && lsd && (
              <>
                <Row label="主键" value={lsd.id} />
                <Row label="领域" value={lsd.domain} />
                <Row label="状态代码" value={lsd.state_code} />
                <Row label="显示名称" value={lsd.display_name} />
                <Row label="排序" value={String(lsd.sort_order)} />
              </>
            )}
            {relation === "transition-logs" && log && (
              <>
                <Row label="主键" value={log.id} />
                <Row label="实体类型" value={log.entity_type} />
                <Row label="实体 ID" value={log.entity_id} />
                <Row label="原状态" value={log.from_state} />
                <Row label="新状态" value={log.to_state} />
                <Row label="操作人" value={log.operator_id} />
                <Row label="原因码" value={log.reason_code} />
                <Row label="发生时间" value={log.occurred_at} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <CrmDeleteDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        title="确认删除"
        description={`确定删除「${String(title)}」吗？`}
        onConfirm={remove}
      />
    </div>
  )
}
