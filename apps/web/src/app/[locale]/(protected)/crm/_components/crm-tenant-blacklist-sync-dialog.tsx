"use client"

import * as React from "react"
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
import { Slider } from "@workspace/ui/components/slider"
import { computeSuggestedEndDate } from "@/lib/crm/tenant-blacklist-utils"
import { trpc } from "@/lib/trpc/client"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

type CrmTenantBlacklistSyncDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CrmTenantBlacklistSyncDialog({
  open,
  onOpenChange,
  onSuccess,
}: CrmTenantBlacklistSyncDialogProps) {
  const utils = trpc.useUtils()
  const { data: defaults, isLoading: defaultsLoading } =
    trpc.crm.tenantBlacklist.getSyncDefaults.useQuery(undefined, { enabled: open })

  const [lastPullStartDate, setLastPullStartDate] = React.useState("")
  const [safetyDays, setSafetyDays] = React.useState(2)
  const [fullSync, setFullSync] = React.useState(false)

  React.useEffect(() => {
    if (!open || !defaults) return
    setLastPullStartDate(defaults.lastPullStartDate ?? "")
    setSafetyDays(defaults.defaultSafetyDays)
    setFullSync(false)
  }, [open, defaults])

  const suggestedEndDate = React.useMemo(
    () => computeSuggestedEndDate(safetyDays),
    [safetyDays],
  )

  const sync = trpc.crm.tenantBlacklist.sync.useMutation({
    onSuccess: (result) => {
      toast.success(
        `已同步 ${result.upsertedCount} 条（平台窗口内 ${result.fetchedCount} 条），游标结束日 ${result.endDate}`,
      )
      void utils.crm.tenantBlacklist.list.invalidate()
      void utils.crm.tenantBlacklist.getSyncDefaults.invalidate()
      onOpenChange(false)
      onSuccess?.()
    },
    onError: (e) => toast.error(e.message),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullSync && !lastPullStartDate.trim()) {
      toast.error("请填写上次拉取更新至日期，或勾选从最早数据全量拉取")
      return
    }
    sync.mutate({
      lastPullStartDate: fullSync ? undefined : lastPullStartDate.trim(),
      safetyDays,
      fullSync,
    })
  }

  const lastJobSummary =
    defaults?.lastJobFinishedAt && defaults.lastJobStatus
      ? `${new Date(defaults.lastJobFinishedAt).toLocaleString("zh-CN", { hour12: false })} · ${defaults.lastJobStatus === "success" ? "成功" : defaults.lastJobStatus}${
          defaults.lastJobUpsertedCount != null ? ` · 写入 ${defaults.lastJobUpsertedCount} 条` : ""
        }`
      : "暂无历史任务"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>同步平台黑名单</DialogTitle>
            <DialogDescription>
              从算算力平台增量拉取 TenantBlack 记录并写入本地库。时间将按东八区自然日转换为平台 UTC ISO 格式。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {defaultsLoading ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                加载同步参数…
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="lastPullStartDate">
                    上次拉取更新至 {!fullSync && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    id="lastPullStartDate"
                    type="date"
                    value={lastPullStartDate}
                    onChange={(e) => setLastPullStartDate(e.target.value)}
                    disabled={fullSync || sync.isPending}
                    required={!fullSync}
                  />
                  <p className="text-muted-foreground text-xs">
                    对应平台 start_time（当日 00:00 东八区 → UTC ISO）
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>滑动窗口（天）</Label>
                    <span className="text-sm font-medium tabular-nums">{safetyDays} 天</span>
                  </div>
                  <Slider
                    min={0}
                    max={14}
                    step={1}
                    value={[safetyDays]}
                    onValueChange={(v) => setSafetyDays(v[0] ?? 2)}
                    disabled={sync.isPending}
                  />
                  <p className="text-muted-foreground text-xs">
                    结束至（预览）：<span className="font-medium text-foreground">{suggestedEndDate}</span>
                    （东八区自然日，含当日）
                  </p>
                </div>

                <div className="flex items-start gap-2">
                  <Checkbox
                    id="fullSync"
                    checked={fullSync}
                    onCheckedChange={(v) => setFullSync(v === true)}
                    disabled={sync.isPending}
                  />
                  <div className="grid gap-1 leading-none">
                    <Label htmlFor="fullSync" className="cursor-pointer font-normal">
                      从最早数据全量拉取（首次初始化）
                    </Label>
                    <p className="text-muted-foreground text-xs">
                      不传起始日期（start_time 为空），仍受结束日与滑动窗口约束；数据量大时耗时较长。
                    </p>
                  </div>
                </div>

                <p className="text-muted-foreground border-t pt-3 text-xs">
                  上次任务：{lastJobSummary}
                </p>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={sync.isPending}
            >
              取消
            </Button>
            <Button type="submit" disabled={defaultsLoading || sync.isPending}>
              {sync.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  同步中…
                </>
              ) : (
                "开始同步"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
