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
import { LocaleLink } from "@/lib/i18n/navigation"
import {
  useActivityTypeName,
  useStaffName,
  useTenantName,
} from "@/lib/crm/crm-lookups"
import { useCrmMockStore } from "@/lib/stores/crm-mock-store"
import type { TenantRelationKey } from "@/lib/types/crm"
import { CrmDeleteDialog } from "./crm-delete-dialog"
import { useLocaleRouter } from "@/lib/i18n/navigation"

export function CrmTenantRelationDetailClient({
  tenantId,
  relation,
  recordId,
}: {
  tenantId: string
  relation: TenantRelationKey
  recordId: string
}) {
  const router = useLocaleRouter()
  const id = decodeURIComponent(recordId)
  const tenantName = useTenantName(tenantId)
  const base = `/crm/tenants/${tenantId}/relations/${relation}`

  const s = useCrmMockStore()
  const [delOpen, setDelOpen] = React.useState(false)

  const readOnly = relation === "activities"

  const remove = () => {
    switch (relation) {
      case "assignments":
        s.removeAssignment(id)
        break
      case "vouchers":
        s.removeVoucher(id)
        break
      case "milestones":
        s.removeMilestone(id)
        break
      case "evidences":
        s.removeEvidence(id)
        break
      case "contracts":
        s.removeContract(id)
        break
      case "recharges":
        s.removeRecharge(id)
        break
      case "usage-daily":
        s.removeUsageDaily(id)
        break
      case "conversion":
        s.removeConversion(id)
        break
      case "documents":
        s.removeDocument(id)
        break
      case "tasks":
        s.removeTask(id)
        break
      case "comments":
        s.removeComment(id)
        break
      default:
        break
    }
    router.push(base)
  }

  const delLabel =
    relation === "assignments"
      ? s.accountManagerAssignments.find((x) => x.id === id)?.role_type
      : relation === "milestones"
        ? s.lifecycleMilestones.find((x) => x.id === id)?.milestone_type
        : relation === "documents"
          ? s.engagementDocuments.find((x) => x.id === id)?.title
          : id

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" size="sm" asChild>
            <LocaleLink href={base}>返回列表</LocaleLink>
          </Button>
          {!readOnly && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <LocaleLink href={`${base}/${encodeURIComponent(id)}/edit`}>
                  编辑
                </LocaleLink>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                type="button"
                onClick={() => setDelOpen(true)}
              >
                删除
              </Button>
            </div>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>详情 · {tenantName}</CardTitle>
            <CardDescription>记录 ID：{id}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {relation === "assignments" && (
              <AssignmentDetail id={id} tenantId={tenantId} />
            )}
            {relation === "vouchers" && <VoucherDetail id={id} />}
            {relation === "milestones" && <MilestoneDetail id={id} />}
            {relation === "evidences" && <EvidenceDetail id={id} />}
            {relation === "contracts" && <ContractDetail id={id} />}
            {relation === "recharges" && <RechargeDetail id={id} />}
            {relation === "usage-daily" && <UsageDetail id={id} />}
            {relation === "conversion" && <ConversionDetail id={id} />}
            {relation === "activities" && <ActivityDetail id={id} />}
            {relation === "documents" && <DocumentDetail id={id} />}
            {relation === "tasks" && <TaskDetail id={id} />}
            {relation === "comments" && <CommentDetail id={id} />}
          </CardContent>
        </Card>
      </div>

      <CrmDeleteDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        title="确认删除该记录？"
        description={`类型：${relation}；摘要：${delLabel ?? id}`}
        onConfirm={remove}
      />
    </div>
  )
}

function D({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b py-2 sm:grid-cols-3">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium sm:col-span-2">{value}</div>
    </div>
  )
}

function AssignmentDetail({ id, tenantId }: { id: string; tenantId: string }) {
  const r = useCrmMockStore((s) => s.accountManagerAssignments.find((x) => x.id === id))
  const staff = useStaffName(r?.user_staff_id)
  const tenant = useTenantName(tenantId)
  if (!r) return <p>未找到记录</p>
  return (
    <>
      <D label="租户" value={tenant} />
      <D label="内部员工" value={staff} />
      <D label="角色类型" value={r.role_type} />
      <D label="责任开始时间" value={r.effective_from} />
      <D label="责任结束时间" value={r.effective_to ?? "当前有效"} />
      <D label="创建时间" value={r.created_at} />
    </>
  )
}

function VoucherDetail({ id }: { id: string }) {
  const r = useCrmMockStore((s) => s.testVoucherIssues.find((x) => x.id === id))
  const op = useStaffName(r?.operator_id)
  if (!r) return <p>未找到记录</p>
  return (
    <>
      <D label="发放状态" value={r.issue_status} />
      <D label="发放时间" value={r.issued_at} />
      <D label="操作人" value={op} />
      <D label="券实例 ID" value={r.coupon_id ?? "—"} />
      <D label="备注" value={r.remark ?? "—"} />
      <div>
        <div className="text-muted-foreground mb-1">券配置 JSON</div>
        <pre className="bg-muted overflow-auto rounded-md p-3 text-xs">
          {r.coupon_config ? JSON.stringify(r.coupon_config, null, 2) : "—"}
        </pre>
      </div>
    </>
  )
}

function MilestoneDetail({ id }: { id: string }) {
  const r = useCrmMockStore((s) => s.lifecycleMilestones.find((x) => x.id === id))
  const staff = useStaffName(r?.filled_by)
  if (!r) return <p>未找到记录</p>
  return (
    <>
      <D label="里程碑类型" value={r.milestone_type} />
      <D label="业务日期" value={r.milestone_date} />
      <D label="填写人" value={staff} />
      <D label="填写时间" value={r.filled_at} />
      <D label="备注" value={r.notes ?? "—"} />
    </>
  )
}

function EvidenceDetail({ id }: { id: string }) {
  const r = useCrmMockStore((s) => s.milestoneEvidence.find((x) => x.id === id))
  const staff = useStaffName(r?.uploaded_by)
  if (!r) return <p>未找到记录</p>
  return (
    <>
      <D label="生命周期里程碑 ID" value={r.lifecycle_milestone_id} />
      <D label="文件名" value={r.file_name} />
      <D label="存储地址" value={r.storage_uri} />
      <D label="文件哈希" value={r.file_hash ?? "—"} />
      <D label="上传人" value={staff} />
      <D label="上传时间" value={r.uploaded_at} />
    </>
  )
}

function ContractDetail({ id }: { id: string }) {
  const r = useCrmMockStore((s) => s.contractSnapshots.find((x) => x.id === id))
  if (!r) return <p>未找到记录</p>
  return (
    <>
      <D label="合同编号" value={r.contract_no ?? "—"} />
      <D label="合同链接" value={r.contract_url ?? "—"} />
      <D label="签约生效日" value={r.signed_on ?? "—"} />
      <D label="金额摘要" value={r.amount_summary ?? "—"} />
      <D label="外部 CRM 合同 ID" value={r.external_crm_id ?? "—"} />
    </>
  )
}

function RechargeDetail({ id }: { id: string }) {
  const r = useCrmMockStore((s) => s.rechargeOrders.find((x) => x.id === id))
  if (!r) return <p>未找到记录</p>
  return (
    <>
      <D label="金额" value={r.amount} />
      <D label="币种" value={r.currency} />
      <D label="订单状态" value={r.status} />
      <D label="支付类型" value={r.type} />
      <D label="成功到账时间" value={r.paid_at ?? "—"} />
      <D label="渠道交易单号" value={r.external_trade_no ?? "—"} />
    </>
  )
}

function UsageDetail({ id }: { id: string }) {
  const r = useCrmMockStore((s) => s.consumptionUsageDaily.find((x) => x.id === id))
  if (!r) return <p>未找到记录</p>
  return (
    <>
      <D label="用量日期" value={r.usage_date} />
      <D label="产品线编码" value={r.product_line ?? "—"} />
      <D label="计价单位" value={r.unit ?? "—"} />
      <D label="金额" value={r.amount ?? "—"} />
      <D label="卡时(秒)" value={r.gpu_seconds ?? "—"} />
    </>
  )
}

function ConversionDetail({ id }: { id: string }) {
  const r = useCrmMockStore((s) => s.conversionRecords.find((x) => x.id === id))
  if (!r) return <p>未找到记录</p>
  return (
    <>
      <D label="转正日期" value={r.conversion_date} />
      <D label="主触发原因" value={r.trigger_type} />
      <D label="候选签约日" value={r.candidate_signed_on ?? "—"} />
      <D label="候选规模达标日" value={r.candidate_scale_met_on ?? "—"} />
      <D label="候选大额充值达标时间" value={r.candidate_recharge_ge_threshold_at ?? "—"} />
      <D label="重算时间" value={r.computed_at} />
    </>
  )
}

function ActivityDetail({ id }: { id: string }) {
  const r = useCrmMockStore((s) => s.accountActivities.find((x) => x.id === id))
  const typeName = useActivityTypeName(r?.activity_type_id)
  const actor = useStaffName(r?.actor_user_id)
  if (!r) return <p>未找到记录</p>
  return (
    <>
      <D label="动态类型" value={typeName} />
      <D label="业务发生时间" value={r.occurred_at} />
      <D label="关联业务域" value={r.ref_domain ?? "—"} />
      <D label="关联记录 ID" value={r.ref_id ?? "—"} />
      <D label="内部操作者" value={actor} />
      <D label="标题快照" value={r.title_snapshot ?? "—"} />
      <D label="可见性" value={r.visibility ?? "—"} />
      <div>
        <div className="text-muted-foreground mb-1">摘要快照</div>
        <p className="text-sm">{r.summary_snapshot ?? "—"}</p>
      </div>
      <div>
        <div className="text-muted-foreground mb-1">扩展数据</div>
        <pre className="bg-muted max-h-64 overflow-auto rounded-md p-3 text-xs">
          {r.payload ? JSON.stringify(r.payload, null, 2) : "—"}
        </pre>
      </div>
      <p className="text-muted-foreground text-xs">
        客户动态为只读投影，不提供编辑与删除。
      </p>
    </>
  )
}

function DocumentDetail({ id }: { id: string }) {
  const r = useCrmMockStore((s) => s.engagementDocuments.find((x) => x.id === id))
  const u = useStaffName(r?.uploaded_by)
  if (!r) return <p>未找到记录</p>
  return (
    <>
      <D label="标题" value={r.title} />
      <D label="版本号" value={String(r.version_no)} />
      <D label="上传人" value={u} />
      <D label="存储地址" value={r.storage_uri} />
      <D label="可见性" value={r.visibility} />
      <D label="创建时间" value={r.created_at} />
    </>
  )
}

function TaskDetail({ id }: { id: string }) {
  const r = useCrmMockStore((s) => s.followUpTasks.find((x) => x.id === id))
  const a = useStaffName(r?.assignee_id)
  if (!r) return <p>未找到记录</p>
  return (
    <>
      <D label="标题" value={r.title} />
      <D label="负责人" value={a} />
      <D label="来源客户动态 ID" value={r.source_account_activity_id ?? "—"} />
      <D label="任务状态" value={r.status} />
      <D label="截止日期" value={r.due_on ?? "—"} />
      <D label="完成时间" value={r.completed_at ?? "—"} />
      <D label="完成说明" value={r.completion_note ?? "—"} />
    </>
  )
}

function CommentDetail({ id }: { id: string }) {
  const r = useCrmMockStore((s) => s.engagementComments.find((x) => x.id === id))
  const author = useStaffName(r?.author_id)
  if (!r) return <p>未找到记录</p>
  return (
    <>
      <D label="所属客户动态 ID" value={r.account_activity_id} />
      <D label="作者" value={author} />
      <D label="父评论 ID" value={r.parent_comment_id ?? "—"} />
      <D label="创建时间" value={r.created_at} />
      <div>
        <div className="text-muted-foreground mb-1">评论正文</div>
        <p className="text-sm whitespace-pre-wrap">{r.body}</p>
      </div>
    </>
  )
}
