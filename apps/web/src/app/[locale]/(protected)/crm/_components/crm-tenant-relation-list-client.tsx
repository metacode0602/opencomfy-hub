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
import { useStaffName, useTenantName } from "@/lib/crm/crm-lookups"
import { useCrmMockStore } from "@/lib/stores/crm-mock-store"
import type { TenantRelationKey } from "@/lib/types/crm"
import { IconPlus } from "@tabler/icons-react"
import { CrmDeleteDialog } from "./crm-delete-dialog"

const relationTitles: Record<TenantRelationKey, string> = {
  assignments: "客户经理分配",
  vouchers: "测试券发放",
  milestones: "生命周期里程碑",
  evidences: "里程碑佐证",
  contracts: "合同摘要（本租户）",
  recharges: "充值订单",
  "usage-daily": "用量日汇总",
  conversion: "转正记录",
  activities: "客户动态",
  documents: "过程文档",
  tasks: "跟进任务",
  comments: "客户动态评论",
}

export function CrmTenantRelationListClient({
  tenantId,
  relation,
}: {
  tenantId: string
  relation: TenantRelationKey
}) {
  const tenantLabel = useTenantName(tenantId)
  const assignments = useCrmMockStore((s) => s.accountManagerAssignments)
  const vouchers = useCrmMockStore((s) => s.testVoucherIssues)
  const milestones = useCrmMockStore((s) => s.lifecycleMilestones)
  const evidence = useCrmMockStore((s) => s.milestoneEvidence)
  const contracts = useCrmMockStore((s) => s.contractSnapshots)
  const recharges = useCrmMockStore((s) => s.rechargeOrders)
  const usage = useCrmMockStore((s) => s.consumptionUsageDaily)
  const conversions = useCrmMockStore((s) => s.conversionRecords)
  const activities = useCrmMockStore((s) => s.accountActivities)
  const documents = useCrmMockStore((s) => s.engagementDocuments)
  const tasks = useCrmMockStore((s) => s.followUpTasks)
  const comments = useCrmMockStore((s) => s.engagementComments)
  const [del, setDel] = React.useState<{ id: string; label: string } | null>(null)

  const base = `/crm/tenants/${tenantId}/relations/${relation}`

  const removeRow = React.useCallback(() => {
    if (!del) return
    const rid = del.id
    const store = useCrmMockStore.getState()
    switch (relation) {
      case "assignments":
        store.removeAssignment(rid)
        break
      case "vouchers":
        store.removeVoucher(rid)
        break
      case "milestones":
        store.removeMilestone(rid)
        break
      case "evidences":
        store.removeEvidence(rid)
        break
      case "contracts":
        store.removeContract(rid)
        break
      case "recharges":
        store.removeRecharge(rid)
        break
      case "usage-daily":
        store.removeUsageDaily(rid)
        break
      case "conversion":
        store.removeConversion(rid)
        break
      case "documents":
        store.removeDocument(rid)
        break
      case "tasks":
        store.removeTask(rid)
        break
      case "comments":
        store.removeComment(rid)
        break
      default:
        break
    }
    setDel(null)
  }, [del, relation])

  const readOnly = relation === "activities"
  const msIds = React.useMemo(
    () => milestones.filter((m) => m.tenant_id === tenantId).map((m) => m.id),
    [milestones, tenantId],
  )

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-background p-4 md:p-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>{relationTitles[relation]}</CardTitle>
            <CardDescription>
              租户：{tenantLabel}（{tenantId}）
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <LocaleLink href={`/crm/tenants/${tenantId}`}>返回租户详情</LocaleLink>
            </Button>
            {!readOnly && (
              <Button className="gap-2" size="sm" asChild>
                <LocaleLink href={`${base}/new`}>
                  <IconPlus className="size-4" />
                  新建
                </LocaleLink>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto rounded-md border">
          {relation === "assignments" && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>内部员工</TableHead>
                  <TableHead>角色类型</TableHead>
                  <TableHead>责任开始</TableHead>
                  <TableHead>责任结束</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments
                  .filter((r) => r.tenant_id === tenantId)
                  .map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <StaffCell id={r.user_staff_id} />
                      </TableCell>
                      <TableCell>{r.role_type}</TableCell>
                      <TableCell className="tabular-nums text-xs">
                        {r.effective_from}
                      </TableCell>
                      <TableCell className="tabular-nums text-xs">
                        {r.effective_to ?? "当前有效"}
                      </TableCell>
                      <TableCell className="text-right">
                        <RowOps
                          base={base}
                          id={r.id}
                          deleteLabel={r.role_type}
                          onRequestDelete={setDel}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}

          {relation === "vouchers" && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>发放状态</TableHead>
                  <TableHead>发放时间</TableHead>
                  <TableHead>操作人</TableHead>
                  <TableHead>券实例 ID</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vouchers
                  .filter((r) => r.tenant_id === tenantId)
                  .map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.issue_status}</TableCell>
                      <TableCell className="tabular-nums text-xs">
                        {r.issued_at}
                      </TableCell>
                      <TableCell>
                        <StaffCell id={r.operator_id} />
                      </TableCell>
                      <TableCell>{r.coupon_id ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <RowOps
                          base={base}
                          id={r.id}
                          deleteLabel={`${r.issue_status} ${r.issued_at}`}
                          onRequestDelete={setDel}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}

          {relation === "milestones" && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>里程碑类型</TableHead>
                  <TableHead>业务日期</TableHead>
                  <TableHead>填写人</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {milestones
                  .filter((r) => r.tenant_id === tenantId)
                  .map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.milestone_type}</TableCell>
                      <TableCell className="tabular-nums">{r.milestone_date}</TableCell>
                      <TableCell>
                        <StaffCell id={r.filled_by} />
                      </TableCell>
                      <TableCell className="text-right">
                        <RowOps
                          base={base}
                          id={r.id}
                          deleteLabel={`${r.milestone_type} ${r.milestone_date}`}
                          onRequestDelete={setDel}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}

          {relation === "evidences" && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>里程碑</TableHead>
                  <TableHead>文件名</TableHead>
                  <TableHead>上传人</TableHead>
                  <TableHead>上传时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evidence
                  .filter((e) => msIds.includes(e.lifecycle_milestone_id))
                  .map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="max-w-[180px] truncate text-xs">
                        {r.lifecycle_milestone_id}
                      </TableCell>
                      <TableCell>{r.file_name}</TableCell>
                      <TableCell>
                        <StaffCell id={r.uploaded_by} />
                      </TableCell>
                      <TableCell className="tabular-nums text-xs">
                        {r.uploaded_at}
                      </TableCell>
                      <TableCell className="text-right">
                        <RowOps
                          base={base}
                          id={r.id}
                          deleteLabel={r.file_name}
                          onRequestDelete={setDel}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}

          {relation === "contracts" && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>合同编号</TableHead>
                  <TableHead>签约日</TableHead>
                  <TableHead>金额摘要</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts
                  .filter((r) => r.tenant_id === tenantId)
                  .map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.contract_no ?? "—"}</TableCell>
                      <TableCell className="tabular-nums">
                        {r.signed_on ?? "—"}
                      </TableCell>
                      <TableCell>{r.amount_summary ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <RowOps
                          base={base}
                          id={r.id}
                          deleteLabel={r.contract_no ?? r.id}
                          onRequestDelete={setDel}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}

          {relation === "recharges" && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>金额</TableHead>
                  <TableHead>币种</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>支付类型</TableHead>
                  <TableHead>到账时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recharges
                  .filter((r) => r.tenant_id === tenantId)
                  .map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="tabular-nums">{r.amount}</TableCell>
                      <TableCell>{r.currency}</TableCell>
                      <TableCell>{r.status}</TableCell>
                      <TableCell>{r.type}</TableCell>
                      <TableCell className="tabular-nums text-xs">
                        {r.paid_at ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <RowOps
                          base={base}
                          id={r.id}
                          deleteLabel={`${r.amount} ${r.currency}`}
                          onRequestDelete={setDel}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}

          {relation === "usage-daily" && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用量日期</TableHead>
                  <TableHead>产品线</TableHead>
                  <TableHead>计价单位</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>卡时(秒)</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage
                  .filter((r) => r.tenant_id === tenantId)
                  .map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="tabular-nums">{r.usage_date}</TableCell>
                      <TableCell>{r.product_line ?? "—"}</TableCell>
                      <TableCell>{r.unit ?? "—"}</TableCell>
                      <TableCell>{r.amount ?? "—"}</TableCell>
                      <TableCell>{r.gpu_seconds ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <RowOps
                          base={base}
                          id={r.id}
                          deleteLabel={r.usage_date}
                          onRequestDelete={setDel}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}

          {relation === "conversion" && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>转正日</TableHead>
                  <TableHead>主触发原因</TableHead>
                  <TableHead>重算时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversions
                  .filter((r) => r.tenant_id === tenantId)
                  .map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="tabular-nums">{r.conversion_date}</TableCell>
                      <TableCell>{r.trigger_type}</TableCell>
                      <TableCell className="tabular-nums text-xs">
                        {r.computed_at}
                      </TableCell>
                      <TableCell className="text-right">
                        <RowOps
                          base={base}
                          id={r.id}
                          deleteLabel={r.conversion_date}
                          onRequestDelete={setDel}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}

          {relation === "activities" && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>发生时间</TableHead>
                  <TableHead>标题</TableHead>
                  <TableHead>关联域</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities
                  .filter((r) => r.tenant_id === tenantId)
                  .map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="tabular-nums text-xs">
                        {r.occurred_at}
                      </TableCell>
                      <TableCell>{r.title_snapshot ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        {r.ref_domain ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild>
                          <LocaleLink href={`${base}/${encodeURIComponent(r.id)}`}>
                            详情
                          </LocaleLink>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}

          {relation === "documents" && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>标题</TableHead>
                  <TableHead>版本</TableHead>
                  <TableHead>上传人</TableHead>
                  <TableHead>可见性</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents
                  .filter((r) => r.tenant_id === tenantId)
                  .map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.title}</TableCell>
                      <TableCell>{r.version_no}</TableCell>
                      <TableCell>
                        <StaffCell id={r.uploaded_by} />
                      </TableCell>
                      <TableCell>{r.visibility}</TableCell>
                      <TableCell className="text-right">
                        <RowOps
                          base={base}
                          id={r.id}
                          deleteLabel={r.title}
                          onRequestDelete={setDel}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}

          {relation === "tasks" && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>标题</TableHead>
                  <TableHead>负责人</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>截止日</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks
                  .filter((r) => r.tenant_id === tenantId)
                  .map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.title}</TableCell>
                      <TableCell>
                        <StaffCell id={r.assignee_id} />
                      </TableCell>
                      <TableCell>{r.status}</TableCell>
                      <TableCell className="tabular-nums">{r.due_on ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <RowOps
                          base={base}
                          id={r.id}
                          deleteLabel={r.title}
                          onRequestDelete={setDel}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}

          {relation === "comments" && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>所属动态 ID</TableHead>
                  <TableHead>作者</TableHead>
                  <TableHead>正文摘要</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comments
                  .filter((r) => r.tenant_id === tenantId)
                  .map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="max-w-[140px] truncate text-xs">
                        {r.account_activity_id}
                      </TableCell>
                      <TableCell>
                        <StaffCell id={r.author_id} />
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate">
                        {r.body}
                      </TableCell>
                      <TableCell className="tabular-nums text-xs">
                        {r.created_at}
                      </TableCell>
                      <TableCell className="text-right">
                        <RowOps
                          base={base}
                          id={r.id}
                          deleteLabel={r.body.slice(0, 40)}
                          onRequestDelete={setDel}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CrmDeleteDialog
        open={del != null}
        onOpenChange={(o) => {
          if (!o) setDel(null)
        }}
        title="确认删除该记录？"
        description={del ? `摘要：${del.label}` : ""}
        onConfirm={removeRow}
      />
    </div>
  )
}

function StaffCell({ id }: { id: string | null }) {
  const name = useStaffName(id)
  return <span>{name}</span>
}

function RowOps({
  base,
  id,
  deleteLabel,
  onRequestDelete,
}: {
  base: string
  id: string
  deleteLabel: string
  onRequestDelete: (p: { id: string; label: string }) => void
}) {
  const enc = encodeURIComponent(id)
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="outline" size="sm" asChild>
        <LocaleLink href={`${base}/${enc}`}>详情</LocaleLink>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <LocaleLink href={`${base}/${enc}/edit`}>编辑</LocaleLink>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        type="button"
        onClick={() => onRequestDelete({ id, label: deleteLabel })}
      >
        删除
      </Button>
    </div>
  )
}
