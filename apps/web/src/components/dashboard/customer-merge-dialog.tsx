"use client"

import * as React from "react"
import { IconLoader2 } from "@tabler/icons-react"
import { toast } from "sonner"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import type { CustomerMergePreview } from "@/lib/types/customer-merge"
import { trpc } from "@/lib/trpc/client"

export type CustomerMergeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetCustomer: { id: string; name: string }
  onMerged?: () => void
}

export function CustomerMergeDialog({
  open,
  onOpenChange,
  targetCustomer,
  onMerged,
}: CustomerMergeDialogProps) {
  const [search, setSearch] = React.useState("")
  const [selectedSourceIds, setSelectedSourceIds] = React.useState<string[]>([])
  const [defaultTenantId, setDefaultTenantId] = React.useState<string>("")
  const [preview, setPreview] = React.useState<CustomerMergePreview | null>(null)

  const utils = trpc.useUtils()
  const { data: customers = [], isLoading: customersLoading } = trpc.crm.customers.list.useQuery(
    { status: "active" },
    { enabled: open },
  )

  const previewQuery = trpc.crm.customers.previewMerge.useQuery(
    {
      targetCustomerId: targetCustomer.id,
      sourceCustomerIds: selectedSourceIds,
    },
    { enabled: false },
  )

  const mergeMutation = trpc.crm.customers.merge.useMutation({
    onSuccess: (result) => {
      toast.success(
        `已合并 ${result.archivedSourceCustomerIds.length} 个客户，迁移 ${result.movedTenantCount} 个租户、${result.movedProjectCount} 个项目`,
      )
      void utils.crm.customers.list.invalidate()
      void utils.crm.customers.getById.invalidate({ id: targetCustomer.id })
      onMerged?.()
      onOpenChange(false)
    },
    onError: (e) => toast.error(e.message),
  })

  React.useEffect(() => {
    if (!open) {
      setSearch("")
      setSelectedSourceIds([])
      setDefaultTenantId("")
      setPreview(null)
    }
  }, [open])

  React.useEffect(() => {
    setPreview(null)
  }, [selectedSourceIds, targetCustomer.id])

  const candidates = customers.filter(
    (row) => row.id !== targetCustomer.id && row.status === "active",
  )

  const filteredCandidates = candidates.filter((row) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      row.name.toLowerCase().includes(q) ||
      row.contactPerson.toLowerCase().includes(q) ||
      (row.certCode?.toLowerCase().includes(q) ?? false)
    )
  })

  const toggleSource = (id: string, checked: boolean) => {
    setSelectedSourceIds((prev) =>
      checked ? [...prev, id] : prev.filter((value) => value !== id),
    )
  }

  const runPreview = async () => {
    if (selectedSourceIds.length === 0) {
      toast.error("请至少选择一个源客户")
      return
    }
    try {
      const result = await previewQuery.refetch()
      if (result.data) {
        setPreview(result.data)
        setDefaultTenantId(result.data.defaultTenant.recommendedId)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "预览失败")
    }
  }

  const handleMerge = () => {
    if (!preview || preview.blocked) return
    mergeMutation.mutate({
      targetCustomerId: targetCustomer.id,
      sourceCustomerIds: selectedSourceIds,
      defaultTenantId: defaultTenantId || preview.defaultTenant.recommendedId,
    })
  }

  const previewLoading = previewQuery.isFetching

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>合并客户</DialogTitle>
          <DialogDescription>
            将其它冗余客户下的租户、项目及关联数据合并到目标客户「{targetCustomer.name}
            」。源客户合并后将归档为未激活。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">目标客户：</span>
            <span className="font-medium">{targetCustomer.name}</span>
          </div>

          <div className="space-y-2">
            <Label>选择源客户（可多选）</Label>
            <Input
              placeholder="搜索客户名称、联系人、信用代码…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-2">
              {customersLoading ? (
                <p className="text-muted-foreground p-2 text-sm">加载中…</p>
              ) : filteredCandidates.length === 0 ? (
                <p className="text-muted-foreground p-2 text-sm">没有可合并的活跃客户</p>
              ) : (
                filteredCandidates.map((row) => (
                  <label
                    key={row.id}
                    className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-md px-2 py-1.5"
                  >
                    <Checkbox
                      checked={selectedSourceIds.includes(row.id)}
                      onCheckedChange={(checked) => toggleSource(row.id, checked === true)}
                    />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="font-medium">{row.name}</span>
                      <span className="text-muted-foreground block text-xs">
                        {row.projectCount} 个项目 · {row.contactPerson}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>
            <p className="text-muted-foreground text-xs">已选 {selectedSourceIds.length} 个源客户</p>
          </div>

          <Button
            type="button"
            variant="secondary"
            disabled={selectedSourceIds.length === 0 || previewLoading}
            onClick={() => void runPreview()}
          >
            {previewLoading ? (
              <>
                <IconLoader2 className="mr-2 size-4 animate-spin" />
                预览中…
              </>
            ) : (
              "预览影响范围"
            )}
          </Button>

          {preview ? (
            <div className="space-y-3 rounded-md border p-3 text-sm">
              {preview.blocked ? (
                <p className="text-destructive">{preview.blockReason}</p>
              ) : (
                <>
                  <p>
                    将迁移 <strong>{preview.impacts.tenantsToMove}</strong> 个租户、
                    <strong>{preview.impacts.projectsToMove}</strong> 个项目，并同步更新关联计费/经营数据。
                  </p>
                  {preview.backfillFields.length > 0 ? (
                    <p className="text-muted-foreground">
                      目标客户空字段将从源客户回填：{preview.backfillFields.join("、")}
                    </p>
                  ) : null}
                  {preview.warnings.length > 0 ? (
                    <ul className="text-amber-700 dark:text-amber-400 list-disc space-y-1 pl-5">
                      {preview.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  ) : null}
                  {preview.defaultTenant.candidates.length > 0 ? (
                    <div className="space-y-1.5">
                      <Label className="text-xs">合并后默认计费账户</Label>
                      <Select value={defaultTenantId} onValueChange={setDefaultTenantId}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="选择默认租户" />
                        </SelectTrigger>
                        <SelectContent>
                          {preview.defaultTenant.candidates.map((tenant) => (
                            <SelectItem key={tenant.id} value={tenant.id}>
                              {tenant.name}（{tenant.fromCustomerName}）
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  <details className="text-muted-foreground">
                    <summary className="cursor-pointer">各表影响行数</summary>
                    <ul className="mt-2 space-y-0.5 pl-4">
                      {Object.entries(preview.impacts.rowsByTable).map(([table, total]) => (
                        <li key={table}>
                          {table}: {total}
                        </li>
                      ))}
                    </ul>
                  </details>
                </>
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type="button"
            disabled={
              !preview ||
              preview.blocked ||
              mergeMutation.isPending ||
              preview.defaultTenant.candidates.length === 0
            }
            onClick={handleMerge}
          >
            {mergeMutation.isPending ? (
              <>
                <IconLoader2 className="mr-2 size-4 animate-spin" />
                合并中…
              </>
            ) : (
              "确认合并"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
