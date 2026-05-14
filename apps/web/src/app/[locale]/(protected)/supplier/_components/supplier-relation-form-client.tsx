"use client"

import * as React from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { LocaleLink, useLocaleRouter } from "@/lib/i18n/navigation"
import { contractIdsForSupplier } from "@/lib/stores/supplier-domain-mock-store"
import { useSupplierDomainMockStore } from "@/lib/stores/supplier-domain-mock-store"
import type {
  AccessConditionSheet,
  ComputeNode,
  OnboardingBatch,
  OnboardingTask,
  SupplierContract,
  SupplierDevice,
  SupplierRelationKey,
  SupplierTermsVersion,
  SupplierUnitCost,
} from "@/lib/types/supplier-domain"
import { SUPPLIER_RELATION_TITLES } from "@/lib/types/supplier-domain"

function safeJson(text: string, fallback: Record<string, unknown>) {
  try {
    const v = JSON.parse(text || "{}") as unknown
    return typeof v === "object" && v != null && !Array.isArray(v) ? (v as Record<string, unknown>) : fallback
  } catch {
    return fallback
  }
}

export function SupplierRelationFormClient({
  supplierId,
  relation,
  recordId,
  mode,
}: {
  supplierId: string
  relation: SupplierRelationKey
  recordId?: string
  mode: "create" | "edit"
}) {
  const router = useLocaleRouter()
  const id = recordId ? decodeURIComponent(recordId) : ""
  const base = `/supplier/${supplierId}/relations/${relation}`
  const snap = useSupplierDomainMockStore()
  const createId = snap.createId

  const cids = React.useMemo(() => contractIdsForSupplier(snap, supplierId), [snap, supplierId])
  const myContracts = snap.contracts.filter((c) => c.supplier_id === supplierId)
  const myTerms = snap.termsVersions.filter(
    (t) => t.supplier_id === supplierId || (t.contract_id != null && cids.has(t.contract_id)),
  )
  const mySheets = snap.accessSheets.filter((s) => cids.has(s.contract_id))
  const myBatches = snap.onboardingBatches.filter((b) => cids.has(b.contract_id))
  const myDevices = snap.devices.filter((d) => d.supplier_id === supplierId)
  const myNodes = snap.computeNodes.filter((n) => myDevices.some((d) => d.id === n.device_id))

  if (mode === "edit" && recordId) {
    const exists =
      (relation === "contracts" && snap.contracts.some((x) => x.id === id)) ||
      (relation === "terms-versions" && snap.termsVersions.some((x) => x.id === id)) ||
      (relation === "unit-costs" && snap.unitCosts.some((x) => x.id === id)) ||
      (relation === "access-sheets" && snap.accessSheets.some((x) => x.id === id)) ||
      (relation === "onboarding-batches" && snap.onboardingBatches.some((x) => x.id === id)) ||
      (relation === "devices" && snap.devices.some((x) => x.id === id)) ||
      (relation === "compute-nodes" && snap.computeNodes.some((x) => x.id === id)) ||
      (relation === "onboarding-tasks" && snap.onboardingTasks.some((x) => x.id === id)) ||
      (relation === "fault-incidents" && snap.faultIncidents.some((x) => x.id === id)) ||
      (relation === "test-holds" && snap.internalTestHolds.some((x) => x.id === id)) ||
      (relation === "pool-bindings" && snap.resourcePoolBindings.some((x) => x.id === id)) ||
      (relation === "state-definitions" && snap.lifecycleStateDefinitions.some((x) => x.id === id)) ||
      (relation === "transition-logs" && snap.entityStateTransitionLogs.some((x) => x.id === id))
    if (!exists) {
      return (
        <div className="p-6">
          <p className="text-muted-foreground">未找到记录。</p>
          <Button className="mt-4" variant="outline" asChild>
            <LocaleLink href={base}>返回</LocaleLink>
          </Button>
        </div>
      )
    }
  }

  const commonCancel = (
    <Button variant="outline" type="button" asChild>
      <LocaleLink href={mode === "edit" && recordId ? `${base}/${encodeURIComponent(id)}` : base}>取消</LocaleLink>
    </Button>
  )

  if (relation === "contracts") {
    return (
      <ContractForm
        mode={mode}
        id={id}
        supplierId={supplierId}
        createId={createId}
        commonCancel={commonCancel}
        onDone={() => router.push(base)}
      />
    )
  }
  if (relation === "terms-versions") {
    return (
      <TermsForm
        mode={mode}
        id={id}
        supplierId={supplierId}
        base={base}
        myContracts={myContracts}
        createId={createId}
        commonCancel={commonCancel}
        onDone={() => router.push(base)}
      />
    )
  }
  if (relation === "unit-costs") {
    return (
      <UnitCostForm
        mode={mode}
        id={id}
        supplierId={supplierId}
        base={base}
        myTerms={myTerms}
        createId={createId}
        commonCancel={commonCancel}
        onDone={() => router.push(base)}
      />
    )
  }
  if (relation === "access-sheets") {
    return (
      <SheetForm
        mode={mode}
        id={id}
        base={base}
        myContracts={myContracts}
        createId={createId}
        commonCancel={commonCancel}
        onDone={() => router.push(base)}
      />
    )
  }
  if (relation === "onboarding-batches") {
    return (
      <BatchForm
        mode={mode}
        id={id}
        base={base}
        myContracts={myContracts}
        mySheets={mySheets}
        createId={createId}
        commonCancel={commonCancel}
        onDone={() => router.push(base)}
      />
    )
  }
  if (relation === "devices") {
    return (
      <DeviceForm
        mode={mode}
        id={id}
        supplierId={supplierId}
        base={base}
        myContracts={myContracts}
        myBatches={myBatches}
        createId={createId}
        commonCancel={commonCancel}
        onDone={() => router.push(base)}
      />
    )
  }
  if (relation === "compute-nodes") {
    return (
      <NodeForm
        mode={mode}
        id={id}
        base={base}
        myDevices={myDevices}
        createId={createId}
        commonCancel={commonCancel}
        onDone={() => router.push(base)}
      />
    )
  }
  if (relation === "onboarding-tasks") {
    return (
      <TaskForm
        mode={mode}
        id={id}
        base={base}
        myBatches={myBatches}
        myDevices={myDevices}
        createId={createId}
        commonCancel={commonCancel}
        onDone={() => router.push(base)}
      />
    )
  }
  if (relation === "fault-incidents") {
    return (
      <FaultForm
        mode={mode}
        id={id}
        base={base}
        myDevices={myDevices}
        myNodes={myNodes}
        createId={createId}
        commonCancel={commonCancel}
        onDone={() => router.push(base)}
      />
    )
  }
  if (relation === "test-holds") {
    return (
      <HoldForm
        mode={mode}
        id={id}
        base={base}
        myDevices={myDevices}
        myNodes={myNodes}
        createId={createId}
        commonCancel={commonCancel}
        onDone={() => router.push(base)}
      />
    )
  }
  if (relation === "pool-bindings") {
    return (
      <BindForm
        mode={mode}
        id={id}
        base={base}
        myDevices={myDevices}
        createId={createId}
        commonCancel={commonCancel}
        onDone={() => router.push(base)}
      />
    )
  }
  if (relation === "state-definitions") {
    return (
      <StateForm
        mode={mode}
        id={id}
        base={base}
        createId={createId}
        commonCancel={commonCancel}
        onDone={() => router.push(base)}
      />
    )
  }
  return (
    <LogForm
      mode={mode}
      id={id}
      base={base}
      createId={createId}
      commonCancel={commonCancel}
      onDone={() => router.push(base)}
    />
  )
}

function ContractForm({
  mode,
  id,
  supplierId,
  createId,
  commonCancel,
  onDone,
}: {
  mode: "create" | "edit"
  id: string
  supplierId: string
  createId: (p: string) => string
  commonCancel: React.ReactNode
  onDone: () => void
}) {
  const upsert = useSupplierDomainMockStore((s) => s.upsertContract)
  const existing = useSupplierDomainMockStore((s) => s.contracts.find((c) => c.id === id))
  const [contract_no, setNo] = React.useState("")
  const [contract_url, setUrl] = React.useState("")
  const [status, setStatus] = React.useState("草稿")
  const [effective_from, setFrom] = React.useState("")
  const [effective_to, setTo] = React.useState("")

  React.useEffect(() => {
    if (mode === "edit" && existing) {
      setNo(existing.contract_no)
      setUrl(existing.contract_url)
      setStatus(existing.status)
      setFrom(existing.effective_from)
      setTo(existing.effective_to)
    }
  }, [mode, existing])

  const save = () => {
    const rid = mode === "edit" ? id : createId("con")
    upsert({
      id: rid,
      supplier_id: supplierId,
      contract_no,
      contract_url,
      status,
      effective_from,
      effective_to: effective_to,
    })
    onDone()
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>{mode === "create" ? "新建" : "编辑"}商务合同</CardTitle>
          <CardDescription>{SUPPLIER_RELATION_TITLES["contracts"]}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label>合同编号</Label>
            <Input value={contract_no} onChange={(e) => setNo(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>合同链接</Label>
            <Input value={contract_url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>状态</Label>
            <Input value={status} onChange={(e) => setStatus(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>生效起</Label>
            <Input type="date" value={effective_from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>生效止</Label>
            <Input type="date" value={effective_to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button type="button" onClick={save}>
            保存
          </Button>
          {commonCancel}
        </CardFooter>
      </Card>
    </div>
  )
}

function TermsForm({
  mode,
  id,
  supplierId,
  base,
  myContracts,
  createId,
  commonCancel,
  onDone,
}: {
  mode: "create" | "edit"
  id: string
  supplierId: string
  base: string
  myContracts: SupplierContract[]
  createId: (p: string) => string
  commonCancel: React.ReactNode
  onDone: () => void
}) {
  const all = useSupplierDomainMockStore((s) => s.termsVersions)
  const existing = all.find((t) => t.id === id)
  const upsert = useSupplierDomainMockStore((s) => s.upsertTermsVersion)
  const [anchor, setAnchor] = React.useState<"supplier" | "contract">("supplier")
  const [contract_id, setContractId] = React.useState("")
  const [deal_mode, setDeal] = React.useState("卡时计价")
  const [termsJson, setTermsJson] = React.useState("{}")
  const [effective_from, setFrom] = React.useState(new Date().toISOString())
  const [effective_to, setTo] = React.useState("")

  React.useEffect(() => {
    if (mode === "edit" && existing) {
      setDeal(existing.deal_mode)
      setTermsJson(JSON.stringify(existing.terms_json, null, 2))
      setFrom(existing.effective_from)
      setTo(existing.effective_to ?? "")
      if (existing.contract_id) {
        setAnchor("contract")
        setContractId(existing.contract_id)
      } else {
        setAnchor("supplier")
        setContractId("")
      }
    }
  }, [mode, existing])

  const save = () => {
    if (anchor === "contract" && !contract_id) {
      alert("请选择商务合同")
      return
    }
    const rid = mode === "edit" ? id : createId("tv")
    const row: SupplierTermsVersion = {
      id: rid,
      supplier_id: anchor === "supplier" ? supplierId : null,
      contract_id: anchor === "contract" ? contract_id : null,
      deal_mode,
      terms_json: safeJson(termsJson, {}),
      effective_from,
      effective_to: effective_to || null,
    }
    upsert(row)
    onDone()
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>{mode === "create" ? "新建" : "编辑"}合作条款版本</CardTitle>
          <CardDescription>归属二选一：直挂供应商 或 商务合同</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label>归属</Label>
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={anchor}
              onChange={(e) => setAnchor(e.target.value as "supplier" | "contract")}
              disabled={mode === "edit"}
            >
              <option value="supplier">直挂本供应商</option>
              <option value="contract">挂商务合同</option>
            </select>
          </div>
          {anchor === "contract" && (
            <div className="grid gap-2">
              <Label>商务合同</Label>
              <select
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                value={contract_id}
                onChange={(e) => setContractId(e.target.value)}
                disabled={mode === "edit"}
              >
                <option value="">请选择</option>
                {myContracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.contract_no}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid gap-2">
            <Label>合作模式</Label>
            <Input value={deal_mode} onChange={(e) => setDeal(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>条款参数 JSON</Label>
            <Textarea rows={6} value={termsJson} onChange={(e) => setTermsJson(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>生效起（ISO）</Label>
            <Input value={effective_from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>生效止（ISO，可空）</Label>
            <Input value={effective_to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button type="button" onClick={save}>
            保存
          </Button>
          {commonCancel}
        </CardFooter>
      </Card>
    </div>
  )
}

function UnitCostForm({
  mode,
  id,
  supplierId,
  base,
  myTerms,
  createId,
  commonCancel,
  onDone,
}: {
  mode: "create" | "edit"
  id: string
  supplierId: string
  base: string
  myTerms: SupplierTermsVersion[]
  createId: (p: string) => string
  commonCancel: React.ReactNode
  onDone: () => void
}) {
  const upsert = useSupplierDomainMockStore((s) => s.upsertUnitCost)
  const existing = useSupplierDomainMockStore((s) => s.unitCosts.find((u) => u.id === id))
  const [supplier_terms_version_id, setTv] = React.useState(myTerms[0]?.id ?? "")
  const [idc_code, setIdc] = React.useState("")
  const [card_type, setCard] = React.useState("")
  const [unit_cost, setUnit] = React.useState("")
  const [percent, setPct] = React.useState("")
  const [tierJson, setTier] = React.useState("")

  React.useEffect(() => {
    if (mode === "edit" && existing) {
      setTv(existing.supplier_terms_version_id)
      setIdc(existing.idc_code)
      setCard(existing.card_type)
      setUnit(existing.unit_cost ?? "")
      setPct(existing.percent ?? "")
      setTier(existing.tier_json ? JSON.stringify(existing.tier_json, null, 2) : "")
    }
  }, [mode, existing])

  const save = () => {
    const rid = mode === "edit" ? id : createId("uc")
    upsert({
      id: rid,
      supplier_terms_version_id,
      supplier_id: supplierId,
      idc_code,
      card_type,
      unit_cost: unit_cost || null,
      percent: percent || null,
      tier_json: tierJson ? safeJson(tierJson, {}) : null,
    })
    onDone()
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>{mode === "create" ? "新建" : "编辑"}条款单价/分成档</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label>合作条款版本</Label>
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={supplier_terms_version_id}
              onChange={(e) => setTv(e.target.value)}
            >
              {myTerms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.deal_mode} ({t.id.slice(0, 8)}…)
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label>机房编码</Label>
            <Input value={idc_code} onChange={(e) => setIdc(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>卡型</Label>
            <Input value={card_type} onChange={(e) => setCard(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>卡时单价</Label>
            <Input value={unit_cost} onChange={(e) => setUnit(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>分成比例</Label>
            <Input value={percent} onChange={(e) => setPct(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>阶梯表 JSON（可空）</Label>
            <Textarea rows={4} value={tierJson} onChange={(e) => setTier(e.target.value)} />
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button type="button" onClick={save}>
            保存
          </Button>
          {commonCancel}
        </CardFooter>
      </Card>
    </div>
  )
}

function SheetForm({
  mode,
  id,
  base,
  myContracts,
  createId,
  commonCancel,
  onDone,
}: {
  mode: "create" | "edit"
  id: string
  base: string
  myContracts: SupplierContract[]
  createId: (p: string) => string
  commonCancel: React.ReactNode
  onDone: () => void
}) {
  const upsert = useSupplierDomainMockStore((s) => s.upsertAccessSheet)
  const existing = useSupplierDomainMockStore((s) => s.accessSheets.find((x) => x.id === id))
  const [contract_id, setCid] = React.useState(myContracts[0]?.id ?? "")
  const [version_no, setVer] = React.useState(1)
  const [is_current, setCur] = React.useState(false)
  const [json, setJson] = React.useState("{}")

  React.useEffect(() => {
    if (mode === "edit" && existing) {
      setCid(existing.contract_id)
      setVer(existing.version_no)
      setCur(existing.is_current)
      setJson(JSON.stringify(existing.gpu_network_cpu_terms, null, 2))
    }
  }, [mode, existing])

  const save = () => {
    const rid = mode === "edit" ? id : createId("acs")
    upsert({
      id: rid,
      contract_id,
      version_no: Number(version_no),
      is_current,
      gpu_network_cpu_terms: safeJson(json, {}),
    })
    onDone()
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>{mode === "create" ? "新建" : "编辑"}接入条件单</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label>商务合同</Label>
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={contract_id}
              onChange={(e) => setCid(e.target.value)}
              disabled={mode === "edit"}
            >
              {myContracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.contract_no}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label>版本号</Label>
            <Input type="number" value={version_no} onChange={(e) => setVer(Number(e.target.value))} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="cur" checked={is_current} onChange={(e) => setCur(e.target.checked)} />
            <Label htmlFor="cur">当前版本</Label>
          </div>
          <div className="grid gap-2">
            <Label>条件 JSON</Label>
            <Textarea rows={6} value={json} onChange={(e) => setJson(e.target.value)} />
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button type="button" onClick={save}>
            保存
          </Button>
          {commonCancel}
        </CardFooter>
      </Card>
    </div>
  )
}

function BatchForm({
  mode,
  id,
  base,
  myContracts,
  mySheets,
  createId,
  commonCancel,
  onDone,
}: {
  mode: "create" | "edit"
  id: string
  base: string
  myContracts: SupplierContract[]
  mySheets: AccessConditionSheet[]
  createId: (p: string) => string
  commonCancel: React.ReactNode
  onDone: () => void
}) {
  const upsert = useSupplierDomainMockStore((s) => s.upsertOnboardingBatch)
  const existing = useSupplierDomainMockStore((s) => s.onboardingBatches.find((x) => x.id === id))
  const [contract_id, setCid] = React.useState(myContracts[0]?.id ?? "")
  const sheetsForContract = mySheets.filter((s) => s.contract_id === contract_id)
  const [access_condition_sheet_id, setSheet] = React.useState(sheetsForContract[0]?.id ?? "")
  React.useEffect(() => {
    if (mode === "edit") return
    const first = mySheets.filter((s) => s.contract_id === contract_id)[0]?.id ?? ""
    setSheet(first)
  }, [contract_id, mySheets, mode])
  const [batch_code, setCode] = React.useState("")
  const [batch_status, setSt] = React.useState("规划中")
  const [planned, setPlanned] = React.useState("")

  React.useEffect(() => {
    if (mode === "edit" && existing) {
      setCid(existing.contract_id)
      setSheet(existing.access_condition_sheet_id)
      setCode(existing.batch_code)
      setSt(existing.batch_status)
      setPlanned(existing.planned_ready_at ?? "")
    }
  }, [mode, existing])

  const save = () => {
    const rid = mode === "edit" ? id : createId("ob")
    upsert({
      id: rid,
      contract_id,
      access_condition_sheet_id,
      batch_code,
      batch_status,
      planned_ready_at: planned || null,
    })
    onDone()
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>{mode === "create" ? "新建" : "编辑"}接入批次</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label>商务合同</Label>
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={contract_id}
              onChange={(e) => setCid(e.target.value)}
              disabled={mode === "edit"}
            >
              {myContracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.contract_no}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label>接入条件单</Label>
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={access_condition_sheet_id}
              onChange={(e) => setSheet(e.target.value)}
            >
              {sheetsForContract.map((s) => (
                <option key={s.id} value={s.id}>
                  v{s.version_no}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label>批次编码</Label>
            <Input value={batch_code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>批次状态</Label>
            <Input value={batch_status} onChange={(e) => setSt(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>计划就绪（ISO，可空）</Label>
            <Input value={planned} onChange={(e) => setPlanned(e.target.value)} />
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button type="button" onClick={save}>
            保存
          </Button>
          {commonCancel}
        </CardFooter>
      </Card>
    </div>
  )
}

function DeviceForm({
  mode,
  id,
  supplierId,
  base,
  myContracts,
  myBatches,
  createId,
  commonCancel,
  onDone,
}: {
  mode: "create" | "edit"
  id: string
  supplierId: string
  base: string
  myContracts: SupplierContract[]
  myBatches: OnboardingBatch[]
  createId: (p: string) => string
  commonCancel: React.ReactNode
  onDone: () => void
}) {
  const upsert = useSupplierDomainMockStore((s) => s.upsertDevice)
  const existing = useSupplierDomainMockStore((s) => s.devices.find((x) => x.id === id))
  const [contract_id, setCid] = React.useState<string | null>(myContracts[0]?.id ?? null)
  const [onboarding_batch_id, setBid] = React.useState(myBatches[0]?.id ?? "")
  const [asset_no, setAsset] = React.useState("")
  const [sn, setSn] = React.useState("")
  const [lifecycle_status, setLs] = React.useState("规划中")
  const [onboarding_substage, setSub] = React.useState("")
  const [idc_region, setReg] = React.useState("")
  const [idc_code, setCode] = React.useState("")
  const [gpu_count, setGpu] = React.useState("0")
  const [card_type, setCt] = React.useState("")
  const [external_ip, setEip] = React.useState("")
  const [internal_ip, setIip] = React.useState("")

  React.useEffect(() => {
    if (mode === "edit" && existing) {
      setCid(existing.contract_id)
      setBid(existing.onboarding_batch_id)
      setAsset(existing.asset_no)
      setSn(existing.sn)
      setLs(existing.lifecycle_status)
      setSub(existing.onboarding_substage)
      setReg(existing.idc_region)
      setCode(existing.idc_code)
      setGpu(existing.gpu_count)
      setCt(existing.card_type)
      setEip(existing.external_ip)
      setIip(existing.internal_ip)
    }
  }, [mode, existing])

  const save = () => {
    const rid = mode === "edit" ? id : createId("dev")
    upsert({
      id: rid,
      supplier_id: supplierId,
      contract_id,
      onboarding_batch_id,
      asset_no,
      sn,
      lifecycle_status,
      onboarding_substage,
      idc_region,
      idc_code,
      gpu_count,
      card_type,
      external_ip,
      internal_ip,
    })
    onDone()
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>{mode === "create" ? "新建" : "编辑"}物理设备</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label>接入批次</Label>
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={onboarding_batch_id}
              onChange={(e) => setBid(e.target.value)}
            >
              {myBatches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batch_code}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>商务合同（可空）</Label>
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={contract_id ?? ""}
              onChange={(e) => setCid(e.target.value || null)}
            >
              <option value="">（无）</option>
              {myContracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.contract_no}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label>资产号</Label>
            <Input value={asset_no} onChange={(e) => setAsset(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>序列号</Label>
            <Input value={sn} onChange={(e) => setSn(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>生命周期状态</Label>
            <Input value={lifecycle_status} onChange={(e) => setLs(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>接入子阶段</Label>
            <Input value={onboarding_substage} onChange={(e) => setSub(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>机房地域</Label>
            <Input value={idc_region} onChange={(e) => setReg(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>机房编码</Label>
            <Input value={idc_code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>GPU 卡数</Label>
            <Input value={gpu_count} onChange={(e) => setGpu(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>卡型</Label>
            <Input value={card_type} onChange={(e) => setCt(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>外网 IP</Label>
            <Input value={external_ip} onChange={(e) => setEip(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>内网 IP</Label>
            <Input value={internal_ip} onChange={(e) => setIip(e.target.value)} />
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button type="button" onClick={save}>
            保存
          </Button>
          {commonCancel}
        </CardFooter>
      </Card>
    </div>
  )
}

function NodeForm({
  mode,
  id,
  base,
  myDevices,
  createId,
  commonCancel,
  onDone,
}: {
  mode: "create" | "edit"
  id: string
  base: string
  myDevices: SupplierDevice[]
  createId: (p: string) => string
  commonCancel: React.ReactNode
  onDone: () => void
}) {
  const upsert = useSupplierDomainMockStore((s) => s.upsertComputeNode)
  const existing = useSupplierDomainMockStore((s) => s.computeNodes.find((x) => x.id === id))
  const [device_id, setDid] = React.useState(myDevices[0]?.id ?? "")
  const [node_role, setRole] = React.useState("Worker")
  const [mgmt_ip, setIp] = React.useState("")
  const [cluster_id, setCl] = React.useState("")
  const [lifecycle_status, setLs] = React.useState("接入中")

  React.useEffect(() => {
    if (mode === "edit" && existing) {
      setDid(existing.device_id)
      setRole(existing.node_role)
      setIp(existing.mgmt_ip)
      setCl(existing.cluster_id)
      setLs(existing.lifecycle_status)
    }
  }, [mode, existing])

  const save = () => {
    const rid = mode === "edit" ? id : createId("nd")
    upsert({ id: rid, device_id, node_role, mgmt_ip, cluster_id, lifecycle_status })
    onDone()
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>{mode === "create" ? "新建" : "编辑"}计算节点</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label>物理设备</Label>
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={device_id}
              onChange={(e) => setDid(e.target.value)}
              disabled={mode === "edit"}
            >
              {myDevices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.asset_no}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label>节点角色</Label>
            <Input value={node_role} onChange={(e) => setRole(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>管控 IP</Label>
            <Input value={mgmt_ip} onChange={(e) => setIp(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>集群 ID</Label>
            <Input value={cluster_id} onChange={(e) => setCl(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>生命周期状态</Label>
            <Input value={lifecycle_status} onChange={(e) => setLs(e.target.value)} />
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button type="button" onClick={save}>
            保存
          </Button>
          {commonCancel}
        </CardFooter>
      </Card>
    </div>
  )
}

function TaskForm({
  mode,
  id,
  base,
  myBatches,
  myDevices,
  createId,
  commonCancel,
  onDone,
}: {
  mode: "create" | "edit"
  id: string
  base: string
  myBatches: OnboardingBatch[]
  myDevices: SupplierDevice[]
  createId: (p: string) => string
  commonCancel: React.ReactNode
  onDone: () => void
}) {
  const upsert = useSupplierDomainMockStore((s) => s.upsertOnboardingTask)
  const existing = useSupplierDomainMockStore((s) => s.onboardingTasks.find((x) => x.id === id))
  const [onboarding_batch_id, setBid] = React.useState(myBatches[0]?.id ?? "")
  const [device_id, setDid] = React.useState<string>("")
  const [task_type, setT] = React.useState("")
  const [assignee_id, setA] = React.useState("staff-mock-01")
  const [task_status, setS] = React.useState("待开始")
  const [started_at, setSt] = React.useState("")
  const [finished_at, setFi] = React.useState("")

  React.useEffect(() => {
    if (mode === "edit" && existing) {
      setBid(existing.onboarding_batch_id)
      setDid(existing.device_id ?? "")
      setT(existing.task_type)
      setA(existing.assignee_id)
      setS(existing.task_status)
      setSt(existing.started_at ?? "")
      setFi(existing.finished_at ?? "")
    }
  }, [mode, existing])

  const save = () => {
    const rid = mode === "edit" ? id : createId("ot")
    upsert({
      id: rid,
      onboarding_batch_id,
      device_id: device_id || null,
      task_type,
      assignee_id,
      task_status,
      started_at: started_at || null,
      finished_at: finished_at || null,
    })
    onDone()
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>{mode === "create" ? "新建" : "编辑"}接入施工任务</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label>接入批次</Label>
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={onboarding_batch_id}
              onChange={(e) => setBid(e.target.value)}
            >
              {myBatches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.batch_code}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label>物理设备（可空）</Label>
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={device_id}
              onChange={(e) => setDid(e.target.value)}
            >
              <option value="">（无）</option>
              {myDevices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.asset_no}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label>任务类型</Label>
            <Input value={task_type} onChange={(e) => setT(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>负责人 ID</Label>
            <Input value={assignee_id} onChange={(e) => setA(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>任务状态</Label>
            <Input value={task_status} onChange={(e) => setS(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>开始时间 ISO</Label>
            <Input value={started_at} onChange={(e) => setSt(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>结束时间 ISO</Label>
            <Input value={finished_at} onChange={(e) => setFi(e.target.value)} />
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button type="button" onClick={save}>
            保存
          </Button>
          {commonCancel}
        </CardFooter>
      </Card>
    </div>
  )
}

function FaultForm({
  mode,
  id,
  base,
  myDevices,
  myNodes,
  createId,
  commonCancel,
  onDone,
}: {
  mode: "create" | "edit"
  id: string
  base: string
  myDevices: SupplierDevice[]
  myNodes: ComputeNode[]
  createId: (p: string) => string
  commonCancel: React.ReactNode
  onDone: () => void
}) {
  const upsert = useSupplierDomainMockStore((s) => s.upsertFaultIncident)
  const existing = useSupplierDomainMockStore((s) => s.faultIncidents.find((x) => x.id === id))
  const [device_id, setDid] = React.useState<string>("")
  const [compute_node_id, setNid] = React.useState<string>("")
  const [severity, setSev] = React.useState("P3")
  const [incident_status, setSt] = React.useState("打开")
  const [resolution_outcome, setRes] = React.useState("")
  const [opened_at, setOp] = React.useState(new Date().toISOString())
  const [closed_at, setCl] = React.useState("")

  React.useEffect(() => {
    if (mode === "edit" && existing) {
      setDid(existing.device_id ?? "")
      setNid(existing.compute_node_id ?? "")
      setSev(existing.severity)
      setSt(existing.incident_status)
      setRes(existing.resolution_outcome)
      setOp(existing.opened_at)
      setCl(existing.closed_at ?? "")
    }
  }, [mode, existing])

  const save = () => {
    if (!device_id && !compute_node_id) {
      alert("请至少选择物理设备或计算节点之一")
      return
    }
    const rid = mode === "edit" ? id : createId("fi")
    upsert({
      id: rid,
      device_id: device_id || null,
      compute_node_id: compute_node_id || null,
      severity,
      incident_status,
      resolution_outcome,
      opened_at,
      closed_at: closed_at || null,
    })
    onDone()
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>{mode === "create" ? "新建" : "编辑"}故障事件</CardTitle>
          <CardDescription>设备与节点至少填其一</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label>物理设备</Label>
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={device_id}
              onChange={(e) => setDid(e.target.value)}
            >
              <option value="">（无）</option>
              {myDevices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.asset_no}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label>计算节点</Label>
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={compute_node_id}
              onChange={(e) => setNid(e.target.value)}
            >
              <option value="">（无）</option>
              {myNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.mgmt_ip}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label>严重程度</Label>
            <Input value={severity} onChange={(e) => setSev(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>事件状态</Label>
            <Input value={incident_status} onChange={(e) => setSt(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>闭环结果</Label>
            <Input value={resolution_outcome} onChange={(e) => setRes(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>打开时间</Label>
            <Input value={opened_at} onChange={(e) => setOp(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>关闭时间（可空）</Label>
            <Input value={closed_at} onChange={(e) => setCl(e.target.value)} />
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button type="button" onClick={save}>
            保存
          </Button>
          {commonCancel}
        </CardFooter>
      </Card>
    </div>
  )
}

function HoldForm({
  mode,
  id,
  base,
  myDevices,
  myNodes,
  createId,
  commonCancel,
  onDone,
}: {
  mode: "create" | "edit"
  id: string
  base: string
  myDevices: SupplierDevice[]
  myNodes: ComputeNode[]
  createId: (p: string) => string
  commonCancel: React.ReactNode
  onDone: () => void
}) {
  const upsert = useSupplierDomainMockStore((s) => s.upsertInternalTestHold)
  const existing = useSupplierDomainMockStore((s) => s.internalTestHolds.find((x) => x.id === id))
  const [device_id, setDid] = React.useState<string>("")
  const [compute_node_id, setNid] = React.useState<string>("")
  const [scope, setSc] = React.useState("")
  const [hold_from, setFrom] = React.useState(new Date().toISOString())
  const [hold_until, setUntil] = React.useState("")

  React.useEffect(() => {
    if (mode === "edit" && existing) {
      setDid(existing.device_id ?? "")
      setNid(existing.compute_node_id ?? "")
      setSc(existing.scope)
      setFrom(existing.hold_from)
      setUntil(existing.hold_until)
    }
  }, [mode, existing])

  const save = () => {
    const rid = mode === "edit" ? id : createId("ith")
    upsert({
      id: rid,
      device_id: device_id || null,
      compute_node_id: compute_node_id || null,
      scope,
      hold_from,
      hold_until,
    })
    onDone()
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>{mode === "create" ? "新建" : "编辑"}内部测试占用</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label>物理设备</Label>
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={device_id}
              onChange={(e) => setDid(e.target.value)}
            >
              <option value="">（无）</option>
              {myDevices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.asset_no}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label>计算节点</Label>
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={compute_node_id}
              onChange={(e) => setNid(e.target.value)}
            >
              <option value="">（无）</option>
              {myNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.mgmt_ip}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label>占用粒度说明</Label>
            <Input value={scope} onChange={(e) => setSc(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>占用开始</Label>
            <Input value={hold_from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>占用结束</Label>
            <Input value={hold_until} onChange={(e) => setUntil(e.target.value)} />
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button type="button" onClick={save}>
            保存
          </Button>
          {commonCancel}
        </CardFooter>
      </Card>
    </div>
  )
}

function BindForm({
  mode,
  id,
  base,
  myDevices,
  createId,
  commonCancel,
  onDone,
}: {
  mode: "create" | "edit"
  id: string
  base: string
  myDevices: SupplierDevice[]
  createId: (p: string) => string
  commonCancel: React.ReactNode
  onDone: () => void
}) {
  const upsert = useSupplierDomainMockStore((s) => s.upsertResourcePoolBinding)
  const existing = useSupplierDomainMockStore((s) => s.resourcePoolBindings.find((x) => x.id === id))
  const [device_id, setDid] = React.useState(myDevices[0]?.id ?? "")
  const [resource_pool_id, setPid] = React.useState("")
  const [pool_code, setPc] = React.useState("")
  const [workload_profile, setWp] = React.useState("JOB")
  const [is_exclusive_pool, setEx] = React.useState(false)

  React.useEffect(() => {
    if (mode === "edit" && existing) {
      setDid(existing.device_id)
      setPid(existing.resource_pool_id ?? "")
      setPc(existing.pool_code ?? "")
      setWp(existing.workload_profile)
      setEx(existing.is_exclusive_pool)
    }
  }, [mode, existing])

  const save = () => {
    const rid = mode === "edit" ? id : createId("rpb")
    upsert({
      id: rid,
      device_id,
      resource_pool_id: resource_pool_id || null,
      pool_code: pool_code || null,
      workload_profile,
      is_exclusive_pool: is_exclusive_pool,
    })
    onDone()
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>{mode === "create" ? "新建" : "编辑"}资源池绑定</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label>物理设备</Label>
            <select
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={device_id}
              onChange={(e) => setDid(e.target.value)}
              disabled={mode === "edit"}
            >
              {myDevices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.asset_no}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label>资源池 ID</Label>
            <Input value={resource_pool_id} onChange={(e) => setPid(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>池编码</Label>
            <Input value={pool_code} onChange={(e) => setPc(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>工作负载形态</Label>
            <Input value={workload_profile} onChange={(e) => setWp(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="ex" checked={is_exclusive_pool} onChange={(e) => setEx(e.target.checked)} />
            <Label htmlFor="ex">互斥池</Label>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button type="button" onClick={save}>
            保存
          </Button>
          {commonCancel}
        </CardFooter>
      </Card>
    </div>
  )
}

function StateForm({
  mode,
  id,
  base,
  createId,
  commonCancel,
  onDone,
}: {
  mode: "create" | "edit"
  id: string
  base: string
  createId: (p: string) => string
  commonCancel: React.ReactNode
  onDone: () => void
}) {
  const upsert = useSupplierDomainMockStore((s) => s.upsertLifecycleStateDefinition)
  const existing = useSupplierDomainMockStore((s) => s.lifecycleStateDefinitions.find((x) => x.id === id))
  const [domain, setDom] = React.useState("device")
  const [state_code, setCode] = React.useState("")
  const [display_name, setName] = React.useState("")
  const [sort_order, setSo] = React.useState(0)

  React.useEffect(() => {
    if (mode === "edit" && existing) {
      setDom(existing.domain)
      setCode(existing.state_code)
      setName(existing.display_name)
      setSo(existing.sort_order)
    }
  }, [mode, existing])

  const save = () => {
    const rid = mode === "edit" ? id : createId("lsd")
    upsert({ id: rid, domain, state_code, display_name, sort_order: Number(sort_order) })
    onDone()
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>{mode === "create" ? "新建" : "编辑"}生命周期状态字典</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label>领域</Label>
            <Input value={domain} onChange={(e) => setDom(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>状态代码</Label>
            <Input value={state_code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>显示名称</Label>
            <Input value={display_name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>排序</Label>
            <Input type="number" value={sort_order} onChange={(e) => setSo(Number(e.target.value))} />
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button type="button" onClick={save}>
            保存
          </Button>
          {commonCancel}
        </CardFooter>
      </Card>
    </div>
  )
}

function LogForm({
  mode,
  id,
  base,
  createId,
  commonCancel,
  onDone,
}: {
  mode: "create" | "edit"
  id: string
  base: string
  createId: (p: string) => string
  commonCancel: React.ReactNode
  onDone: () => void
}) {
  const upsert = useSupplierDomainMockStore((s) => s.upsertEntityStateTransitionLog)
  const existing = useSupplierDomainMockStore((s) => s.entityStateTransitionLogs.find((x) => x.id === id))
  const [entity_type, setEt] = React.useState("device")
  const [entity_id, setEid] = React.useState("")
  const [from_state, setFrom] = React.useState("")
  const [to_state, setTo] = React.useState("")
  const [operator_id, setOp] = React.useState("staff-mock-01")
  const [reason_code, setR] = React.useState("")
  const [occurred_at, setOc] = React.useState(new Date().toISOString())

  React.useEffect(() => {
    if (mode === "edit" && existing) {
      setEt(existing.entity_type)
      setEid(existing.entity_id)
      setFrom(existing.from_state)
      setTo(existing.to_state)
      setOp(existing.operator_id)
      setR(existing.reason_code)
      setOc(existing.occurred_at)
    }
  }, [mode, existing])

  const save = () => {
    const rid = mode === "edit" ? id : createId("esl")
    upsert({
      id: rid,
      entity_type,
      entity_id,
      from_state,
      to_state,
      operator_id,
      reason_code,
      occurred_at,
    })
    onDone()
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>{mode === "create" ? "新建" : "编辑"}状态变更审计</CardTitle>
          <CardDescription>运维补录场景（mock）</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label>实体类型</Label>
            <Input value={entity_type} onChange={(e) => setEt(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>实体 ID</Label>
            <Input value={entity_id} onChange={(e) => setEid(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>原状态</Label>
            <Input value={from_state} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>新状态</Label>
            <Input value={to_state} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>操作人</Label>
            <Input value={operator_id} onChange={(e) => setOp(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>原因码</Label>
            <Input value={reason_code} onChange={(e) => setR(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>发生时间</Label>
            <Input value={occurred_at} onChange={(e) => setOc(e.target.value)} />
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button type="button" onClick={save}>
            保存
          </Button>
          {commonCancel}
        </CardFooter>
      </Card>
    </div>
  )
}
