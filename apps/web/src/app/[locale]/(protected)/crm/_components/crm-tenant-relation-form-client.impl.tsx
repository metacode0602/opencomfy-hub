"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
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
import { useCrmMockStore } from "@/lib/stores/crm-mock-store"
import type {
  AccountManagerAssignment,
  ConsumptionUsageDaily,
  ContractSnapshot,
  ConversionRecord,
  EngagementComment,
  EngagementDocument,
  FollowUpTask,
  LifecycleMilestone,
  MilestoneEvidence,
  RechargeOrder,
  TenantRelationKey,
  TestVoucherIssue,
} from "@/lib/types/crm"

function nowIso() {
  return new Date().toISOString()
}

export function CrmTenantRelationFormClient({
  tenantId,
  relation,
  recordId,
  mode,
}: {
  tenantId: string
  relation: TenantRelationKey
  recordId?: string
  mode: "create" | "edit"
}) {
  const router = useLocaleRouter()
  const searchParams = useSearchParams()
  const milestonePref = searchParams.get("milestoneId") ?? ""

  const userStaff = useCrmMockStore((s) => s.userStaff)
  const milestones = useCrmMockStore((s) => s.lifecycleMilestones)
  const activities = useCrmMockStore((s) => s.accountActivities)
  const s = useCrmMockStore()

  const base = `/crm/tenants/${tenantId}/relations/${relation}`
  const id = recordId ? decodeURIComponent(recordId) : ""

  if (relation === "activities") {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">客户动态为只读投影，不支持新建或编辑。</p>
        <Button className="mt-4" asChild variant="outline">
          <LocaleLink href={base}>返回列表</LocaleLink>
        </Button>
      </div>
    )
  }

  const msOptions = milestones.filter((m) => m.tenant_id === tenantId)
  const actOptions = activities.filter((a) => a.tenant_id === tenantId)

  const onDone = () => {
    router.push(base)
  }

  if (relation === "assignments") {
    const existing = mode === "edit" ? s.accountManagerAssignments.find((x) => x.id === id) : undefined
    const [user_staff_id, setStaff] = React.useState(existing?.user_staff_id ?? userStaff[0]?.id ?? "")
    const [role_type, setRole] = React.useState(existing?.role_type ?? "客户经理")
    const [effective_from, setFrom] = React.useState(
      existing?.effective_from ? existing.effective_from.slice(0, 16) : nowIso().slice(0, 16),
    )
    const [effective_to, setTo] = React.useState(existing?.effective_to?.slice(0, 16) ?? "")

    const submit = (e: React.FormEvent) => {
      e.preventDefault()
      const row: AccountManagerAssignment = {
        id: existing?.id ?? s.createGenericId("am"),
        tenant_id: tenantId,
        user_staff_id,
        role_type,
        effective_from: new Date(effective_from).toISOString(),
        effective_to: effective_to ? new Date(effective_to).toISOString() : null,
        created_at: existing?.created_at ?? nowIso(),
      }
      s.upsertAssignment(row)
      onDone()
    }

    return (
      <FormShell title={mode === "edit" ? "编辑分配" : "新建分配"} onSubmit={submit} base={base}>
        <Field label="内部员工">
          <select
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            value={user_staff_id}
            onChange={(e) => setStaff(e.target.value)}
          >
            {userStaff.map((u) => (
              <option key={u.id} value={u.id}>
                {u.display_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="角色类型">
          <Input value={role_type} onChange={(e) => setRole(e.target.value)} required />
        </Field>
        <Field label="责任开始">
          <Input
            type="datetime-local"
            value={effective_from}
            onChange={(e) => setFrom(e.target.value)}
            required
          />
        </Field>
        <Field label="责任结束（空=当前有效）">
          <Input type="datetime-local" value={effective_to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </FormShell>
    )
  }

  if (relation === "vouchers") {
    const existing = mode === "edit" ? s.testVoucherIssues.find((x) => x.id === id) : undefined
    const [operator_id, setOp] = React.useState(existing?.operator_id ?? userStaff[0]?.id ?? "")
    const [issued_at, setIssued] = React.useState(
      existing?.issued_at ? existing.issued_at.slice(0, 16) : nowIso().slice(0, 16),
    )
    const [issue_status, setSt] = React.useState(existing?.issue_status ?? "success")
    const [coupon_id, setCid] = React.useState(existing?.coupon_id ?? "")
    const [remark, setRm] = React.useState(existing?.remark ?? "")

    const submit = (e: React.FormEvent) => {
      e.preventDefault()
      const row: TestVoucherIssue = {
        id: existing?.id ?? s.createGenericId("tv"),
        tenant_id: tenantId,
        operator_id: operator_id || null,
        issued_at: new Date(issued_at).toISOString(),
        issue_status,
        coupon_id: coupon_id || null,
        coupon_config: null,
        remark: remark || null,
      }
      s.upsertVoucher(row)
      onDone()
    }

    return (
      <FormShell title={mode === "edit" ? "编辑测试券发放" : "新建测试券发放"} onSubmit={submit} base={base}>
        <Field label="操作人">
          <select
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            value={operator_id}
            onChange={(e) => setOp(e.target.value)}
          >
            <option value="">—</option>
            {userStaff.map((u) => (
              <option key={u.id} value={u.id}>
                {u.display_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="发放时间">
          <Input type="datetime-local" value={issued_at} onChange={(e) => setIssued(e.target.value)} required />
        </Field>
        <Field label="发放状态">
          <Input value={issue_status} onChange={(e) => setSt(e.target.value)} required />
        </Field>
        <Field label="券实例 ID">
          <Input value={coupon_id} onChange={(e) => setCid(e.target.value)} />
        </Field>
        <Field label="备注">
          <Textarea value={remark} onChange={(e) => setRm(e.target.value)} rows={2} />
        </Field>
      </FormShell>
    )
  }

  if (relation === "milestones") {
    const existing = mode === "edit" ? s.lifecycleMilestones.find((x) => x.id === id) : undefined
    const [milestone_type, setMt] = React.useState(existing?.milestone_type ?? "TEST_COMPLETE")
    const [milestone_date, setMd] = React.useState(existing?.milestone_date ?? "2026-05-13")
    const [filled_by, setFb] = React.useState(existing?.filled_by ?? userStaff[0]?.id ?? "")
    const [notes, setNotes] = React.useState(existing?.notes ?? "")

    const submit = (e: React.FormEvent) => {
      e.preventDefault()
      const row: LifecycleMilestone = {
        id: existing?.id ?? s.createGenericId("lm"),
        tenant_id: tenantId,
        milestone_type,
        milestone_date,
        filled_by: filled_by || null,
        filled_at: existing?.filled_at ?? nowIso(),
        notes: notes || null,
      }
      s.upsertMilestone(row)
      onDone()
    }

    return (
      <FormShell title={mode === "edit" ? "编辑里程碑" : "新建里程碑"} onSubmit={submit} base={base}>
        <Field label="里程碑类型">
          <Input value={milestone_type} onChange={(e) => setMt(e.target.value)} required />
        </Field>
        <Field label="业务日期">
          <Input type="date" value={milestone_date} onChange={(e) => setMd(e.target.value)} required />
        </Field>
        <Field label="填写人">
          <select
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            value={filled_by}
            onChange={(e) => setFb(e.target.value)}
          >
            <option value="">—</option>
            {userStaff.map((u) => (
              <option key={u.id} value={u.id}>
                {u.display_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="备注">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </Field>
      </FormShell>
    )
  }

  if (relation === "evidences") {
    const existing = mode === "edit" ? s.milestoneEvidence.find((x) => x.id === id) : undefined
    const [lifecycle_milestone_id, setMid] = React.useState(
      existing?.lifecycle_milestone_id ?? milestonePref ?? msOptions[0]?.id ?? "",
    )
    const [file_name, setFn] = React.useState(existing?.file_name ?? "")
    const [storage_uri, setUri] = React.useState(existing?.storage_uri ?? "")
    const [file_hash, setFh] = React.useState(existing?.file_hash ?? "")

    const submit = (e: React.FormEvent) => {
      e.preventDefault()
      if (!lifecycle_milestone_id) return
      const row: MilestoneEvidence = {
        id: existing?.id ?? s.createGenericId("me"),
        lifecycle_milestone_id,
        file_name,
        storage_uri,
        file_hash: file_hash || null,
        uploaded_by: userStaff[0]?.id ?? null,
        uploaded_at: existing?.uploaded_at ?? nowIso(),
      }
      s.upsertEvidence(row)
      onDone()
    }

    return (
      <FormShell title={mode === "edit" ? "编辑佐证" : "新建佐证"} onSubmit={submit} base={base}>
        <Field label="生命周期里程碑">
          <select
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            value={lifecycle_milestone_id}
            onChange={(e) => setMid(e.target.value)}
            required
          >
            {msOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.milestone_type} · {m.milestone_date}
              </option>
            ))}
          </select>
        </Field>
        <Field label="文件名">
          <Input value={file_name} onChange={(e) => setFn(e.target.value)} required />
        </Field>
        <Field label="存储地址">
          <Input value={storage_uri} onChange={(e) => setUri(e.target.value)} required />
        </Field>
        <Field label="文件哈希">
          <Input value={file_hash} onChange={(e) => setFh(e.target.value)} />
        </Field>
      </FormShell>
    )
  }

  if (relation === "contracts") {
    const existing = mode === "edit" ? s.contractSnapshots.find((x) => x.id === id) : undefined
    const [contract_no, setNo] = React.useState(existing?.contract_no ?? "")
    const [contract_url, setUrl] = React.useState(existing?.contract_url ?? "")
    const [signed_on, setSo] = React.useState(existing?.signed_on ?? "")
    const [amount_summary, setAmt] = React.useState(existing?.amount_summary ?? "")
    const [external_crm_id, setEx] = React.useState(existing?.external_crm_id ?? "")

    const submit = (e: React.FormEvent) => {
      e.preventDefault()
      const row: ContractSnapshot = {
        id: existing?.id ?? s.createGenericId("cs"),
        tenant_id: tenantId,
        contract_no: contract_no || null,
        contract_url: contract_url || null,
        signed_on: signed_on || null,
        amount_summary: amount_summary || null,
        external_crm_id: external_crm_id || null,
      }
      s.upsertContract(row)
      onDone()
    }

    return (
      <FormShell title={mode === "edit" ? "编辑合同摘要" : "新建合同摘要"} onSubmit={submit} base={base}>
        <Field label="合同编号">
          <Input value={contract_no} onChange={(e) => setNo(e.target.value)} />
        </Field>
        <Field label="合同链接">
          <Input value={contract_url} onChange={(e) => setUrl(e.target.value)} />
        </Field>
        <Field label="签约生效日">
          <Input type="date" value={signed_on} onChange={(e) => setSo(e.target.value)} />
        </Field>
        <Field label="金额摘要">
          <Input value={amount_summary} onChange={(e) => setAmt(e.target.value)} />
        </Field>
        <Field label="外部 CRM 合同 ID">
          <Input value={external_crm_id} onChange={(e) => setEx(e.target.value)} />
        </Field>
      </FormShell>
    )
  }

  if (relation === "recharges") {
    const existing = mode === "edit" ? s.rechargeOrders.find((x) => x.id === id) : undefined
    const [amount, setAmt] = React.useState(existing?.amount ?? "0.0000")
    const [currency, setCur] = React.useState(existing?.currency ?? "CNY")
    const [status, setSt] = React.useState(existing?.status ?? "pending")
    const [type, setTy] = React.useState(existing?.type ?? "对公转账")
    const [paid_at, setPaid] = React.useState(existing?.paid_at?.slice(0, 16) ?? "")
    const [external_trade_no, setEx] = React.useState(existing?.external_trade_no ?? "")

    const submit = (e: React.FormEvent) => {
      e.preventDefault()
      const row: RechargeOrder = {
        id: existing?.id ?? s.createGenericId("ro"),
        tenant_id: tenantId,
        amount,
        currency,
        status,
        type,
        paid_at: paid_at ? new Date(paid_at).toISOString() : null,
        external_trade_no: external_trade_no || null,
      }
      s.upsertRecharge(row)
      onDone()
    }

    return (
      <FormShell title={mode === "edit" ? "编辑充值订单" : "新建充值订单"} onSubmit={submit} base={base}>
        <Field label="金额">
          <Input value={amount} onChange={(e) => setAmt(e.target.value)} required />
        </Field>
        <Field label="币种">
          <Input value={currency} onChange={(e) => setCur(e.target.value)} required maxLength={3} />
        </Field>
        <Field label="订单状态">
          <Input value={status} onChange={(e) => setSt(e.target.value)} required />
        </Field>
        <Field label="支付类型">
          <Input value={type} onChange={(e) => setTy(e.target.value)} required />
        </Field>
        <Field label="成功到账时间">
          <Input type="datetime-local" value={paid_at} onChange={(e) => setPaid(e.target.value)} />
        </Field>
        <Field label="渠道交易单号">
          <Input value={external_trade_no} onChange={(e) => setEx(e.target.value)} />
        </Field>
      </FormShell>
    )
  }

  if (relation === "usage-daily") {
    const existing = mode === "edit" ? s.consumptionUsageDaily.find((x) => x.id === id) : undefined
    const [usage_date, setUd] = React.useState(existing?.usage_date ?? "2026-05-13")
    const [product_line, setPl] = React.useState(existing?.product_line ?? "")
    const [unit, setUnit] = React.useState(existing?.unit ?? "卡时")
    const [amount, setAmt] = React.useState(existing?.amount ?? "")
    const [gpu_seconds, setGs] = React.useState(existing?.gpu_seconds ?? "")

    const submit = (e: React.FormEvent) => {
      e.preventDefault()
      const row: ConsumptionUsageDaily = {
        id: existing?.id ?? s.createGenericId("cud"),
        tenant_id: tenantId,
        usage_date,
        product_line: product_line || null,
        unit: unit || null,
        amount: amount || null,
        gpu_seconds: gpu_seconds || null,
      }
      s.upsertUsageDaily(row)
      onDone()
    }

    return (
      <FormShell title={mode === "edit" ? "编辑用量日汇总" : "新建用量日汇总"} onSubmit={submit} base={base}>
        <Field label="用量日期">
          <Input type="date" value={usage_date} onChange={(e) => setUd(e.target.value)} required />
        </Field>
        <Field label="产品线编码">
          <Input value={product_line} onChange={(e) => setPl(e.target.value)} />
        </Field>
        <Field label="计价单位">
          <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
        </Field>
        <Field label="金额">
          <Input value={amount} onChange={(e) => setAmt(e.target.value)} />
        </Field>
        <Field label="卡时(秒)">
          <Input value={gpu_seconds} onChange={(e) => setGs(e.target.value)} />
        </Field>
      </FormShell>
    )
  }

  if (relation === "conversion") {
    const existing = mode === "edit" ? s.conversionRecords.find((x) => x.id === id) : undefined
    const [conversion_date, setCd] = React.useState(existing?.conversion_date ?? "2026-05-13")
    const [trigger_type, setTt] = React.useState(existing?.trigger_type ?? "签约")
    const [candidate_signed_on, setC1] = React.useState(existing?.candidate_signed_on ?? "")
    const [candidate_scale_met_on, setC2] = React.useState(existing?.candidate_scale_met_on ?? "")
    const [candidate_recharge_ge_threshold_at, setC3] = React.useState(
      existing?.candidate_recharge_ge_threshold_at?.slice(0, 16) ?? "",
    )

    const submit = (e: React.FormEvent) => {
      e.preventDefault()
      const row: ConversionRecord = {
        id: existing?.id ?? s.createGenericId("cr"),
        tenant_id: tenantId,
        conversion_date,
        trigger_type,
        candidate_signed_on: candidate_signed_on || null,
        candidate_scale_met_on: candidate_scale_met_on || null,
        candidate_recharge_ge_threshold_at: candidate_recharge_ge_threshold_at
          ? new Date(candidate_recharge_ge_threshold_at).toISOString()
          : null,
        computed_at: nowIso(),
      }
      s.upsertConversion(row)
      onDone()
    }

    return (
      <FormShell title={mode === "edit" ? "编辑转正记录" : "新建转正记录"} onSubmit={submit} base={base}>
        <Field label="转正日期">
          <Input type="date" value={conversion_date} onChange={(e) => setCd(e.target.value)} required />
        </Field>
        <Field label="主触发原因">
          <Input value={trigger_type} onChange={(e) => setTt(e.target.value)} required />
        </Field>
        <Field label="候选签约日">
          <Input type="date" value={candidate_signed_on} onChange={(e) => setC1(e.target.value)} />
        </Field>
        <Field label="候选规模达标日">
          <Input type="date" value={candidate_scale_met_on} onChange={(e) => setC2(e.target.value)} />
        </Field>
        <Field label="候选大额充值达标时间">
          <Input
            type="datetime-local"
            value={candidate_recharge_ge_threshold_at}
            onChange={(e) => setC3(e.target.value)}
          />
        </Field>
      </FormShell>
    )
  }

  if (relation === "documents") {
    const existing = mode === "edit" ? s.engagementDocuments.find((x) => x.id === id) : undefined
    const [title, setT] = React.useState(existing?.title ?? "")
    const [version_no, setV] = React.useState(String(existing?.version_no ?? 1))
    const [storage_uri, setUri] = React.useState(existing?.storage_uri ?? "")
    const [visibility, setVis] = React.useState(existing?.visibility ?? "internal")
    const [uploaded_by, setUb] = React.useState(existing?.uploaded_by ?? userStaff[0]?.id ?? "")

    const submit = (e: React.FormEvent) => {
      e.preventDefault()
      const row: EngagementDocument = {
        id: existing?.id ?? s.createGenericId("ed"),
        tenant_id: tenantId,
        uploaded_by,
        title,
        version_no: Number(version_no) || 1,
        storage_uri,
        visibility,
        created_at: existing?.created_at ?? nowIso(),
      }
      s.upsertDocument(row)
      onDone()
    }

    return (
      <FormShell title={mode === "edit" ? "编辑过程文档" : "新建过程文档"} onSubmit={submit} base={base}>
        <Field label="上传人">
          <select
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            value={uploaded_by}
            onChange={(e) => setUb(e.target.value)}
            required
          >
            {userStaff.map((u) => (
              <option key={u.id} value={u.id}>
                {u.display_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="标题">
          <Input value={title} onChange={(e) => setT(e.target.value)} required />
        </Field>
        <Field label="版本号">
          <Input type="number" value={version_no} onChange={(e) => setV(e.target.value)} required />
        </Field>
        <Field label="存储地址">
          <Input value={storage_uri} onChange={(e) => setUri(e.target.value)} required />
        </Field>
        <Field label="可见性">
          <Input value={visibility} onChange={(e) => setVis(e.target.value)} required />
        </Field>
      </FormShell>
    )
  }

  if (relation === "tasks") {
    const existing = mode === "edit" ? s.followUpTasks.find((x) => x.id === id) : undefined
    const [title, setT] = React.useState(existing?.title ?? "")
    const [assignee_id, setA] = React.useState(existing?.assignee_id ?? userStaff[0]?.id ?? "")
    const [status, setSt] = React.useState(existing?.status ?? "open")
    const [due_on, setDue] = React.useState(existing?.due_on ?? "")
    const [source_account_activity_id, setSrc] = React.useState(
      existing?.source_account_activity_id ?? "",
    )
    const [completion_note, setCn] = React.useState(existing?.completion_note ?? "")
    const [completed_at, setCa] = React.useState(existing?.completed_at?.slice(0, 16) ?? "")

    const submit = (e: React.FormEvent) => {
      e.preventDefault()
      const row: FollowUpTask = {
        id: existing?.id ?? s.createGenericId("fut"),
        tenant_id: tenantId,
        assignee_id: assignee_id || null,
        source_account_activity_id: source_account_activity_id || null,
        title,
        status,
        due_on: due_on || null,
        completed_at: completed_at ? new Date(completed_at).toISOString() : null,
        completion_note: completion_note || null,
      }
      s.upsertTask(row)
      onDone()
    }

    return (
      <FormShell title={mode === "edit" ? "编辑跟进任务" : "新建跟进任务"} onSubmit={submit} base={base}>
        <Field label="标题">
          <Input value={title} onChange={(e) => setT(e.target.value)} required />
        </Field>
        <Field label="负责人">
          <select
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            value={assignee_id}
            onChange={(e) => setA(e.target.value)}
          >
            <option value="">—</option>
            {userStaff.map((u) => (
              <option key={u.id} value={u.id}>
                {u.display_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="来源客户动态">
          <select
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            value={source_account_activity_id}
            onChange={(e) => setSrc(e.target.value)}
          >
            <option value="">—</option>
            {actOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title_snapshot ?? a.id}
              </option>
            ))}
          </select>
        </Field>
        <Field label="任务状态">
          <Input value={status} onChange={(e) => setSt(e.target.value)} required />
        </Field>
        <Field label="截止日期">
          <Input type="date" value={due_on} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <Field label="完成时间">
          <Input type="datetime-local" value={completed_at} onChange={(e) => setCa(e.target.value)} />
        </Field>
        <Field label="完成说明">
          <Textarea value={completion_note} onChange={(e) => setCn(e.target.value)} rows={2} />
        </Field>
      </FormShell>
    )
  }

  if (relation === "comments") {
    const existing = mode === "edit" ? s.engagementComments.find((x) => x.id === id) : undefined
    const [account_activity_id, setAid] = React.useState(
      existing?.account_activity_id ?? actOptions[0]?.id ?? "",
    )
    const [author_id, setAuth] = React.useState(existing?.author_id ?? userStaff[0]?.id ?? "")
    const [parent_comment_id, setP] = React.useState(existing?.parent_comment_id ?? "")
    const [body, setBody] = React.useState(existing?.body ?? "")

    const submit = (e: React.FormEvent) => {
      e.preventDefault()
      if (!account_activity_id) return
      const row: EngagementComment = {
        id: existing?.id ?? s.createGenericId("ec"),
        tenant_id: tenantId,
        account_activity_id,
        author_id,
        parent_comment_id: parent_comment_id || null,
        body,
        created_at: existing?.created_at ?? nowIso(),
      }
      s.upsertComment(row)
      onDone()
    }

    return (
      <FormShell title={mode === "edit" ? "编辑评论" : "新建评论"} onSubmit={submit} base={base}>
        <Field label="所属客户动态">
          <select
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            value={account_activity_id}
            onChange={(e) => setAid(e.target.value)}
            required
          >
            {actOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title_snapshot ?? a.id}
              </option>
            ))}
          </select>
        </Field>
        <Field label="作者">
          <select
            className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
            value={author_id}
            onChange={(e) => setAuth(e.target.value)}
            required
          >
            {userStaff.map((u) => (
              <option key={u.id} value={u.id}>
                {u.display_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="父评论 ID">
          <Input value={parent_comment_id} onChange={(e) => setP(e.target.value)} />
        </Field>
        <Field label="评论正文">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={4} />
        </Field>
      </FormShell>
    )
  }

  return (
    <div className="p-6">
      <p>未实现的关联类型：{relation}</p>
      <Button asChild variant="outline" className="mt-4">
        <LocaleLink href={base}>返回</LocaleLink>
      </Button>
    </div>
  )
}

function FormShell({
  title,
  children,
  onSubmit,
  base,
}: {
  title: string
  children: React.ReactNode
  onSubmit: (e: React.FormEvent) => void
  base: string
}) {
  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>mock 数据将写入本地持久化 store</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">{children}</CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" asChild>
              <LocaleLink href={base}>取消</LocaleLink>
            </Button>
            <Button type="submit">保存</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
