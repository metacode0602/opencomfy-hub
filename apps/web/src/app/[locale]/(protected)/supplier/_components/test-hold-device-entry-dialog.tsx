'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { trpc } from '@/lib/trpc/client'
import { invalidateGlobalDashboard } from '@/lib/dashboard/invalidate-global-dashboard'

type DraftRow = {
  key: string
  internalIp: string
  externalIp: string
  port: string
  rootAccount: string
  rootPassword: string
  error?: string
}

function emptyRow(): DraftRow {
  return {
    key: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    internalIp: '',
    externalIp: '',
    port: '22',
    rootAccount: 'root',
    rootPassword: '',
  }
}

export function TestHoldDeviceEntryDialog({
  holdId,
  open,
  onOpenChange,
}: {
  holdId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const utils = trpc.useUtils()
  const [rows, setRows] = useState<DraftRow[]>([emptyRow()])

  const linkMutation = trpc.supplier.internalTestHold.linkDevices.useMutation({
    onSuccess: (result) => {
      toast.success(`已录入 ${result.linkedCount} 台设备`)
      void utils.supplier.internalTestHold.getById.invalidate({ holdId })
      void utils.supplier.internalTestHold.list.invalidate()
      invalidateGlobalDashboard(utils)
      onOpenChange(false)
    },
    onError: (error) => toast.error(error.message),
  })

  useEffect(() => {
    if (open) setRows([emptyRow()])
  }, [open])

  const updateRow = (key: string, patch: Partial<DraftRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch, error: undefined } : r)))
  }

  const addRow = () => setRows((prev) => [...prev, emptyRow()])

  const removeRow = (key: string) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)))
  }

  const isBlankRow = (row: DraftRow) =>
    !row.internalIp.trim() &&
    !row.externalIp.trim() &&
    !row.port.trim() &&
    !row.rootAccount.trim() &&
    !row.rootPassword.trim()

  const submit = () => {
    const devices: Array<{
      internalIp?: string
      externalIp?: string
      port?: string
      rootAccount: string
      rootPassword: string
    }> = []

    for (const row of rows) {
      if (isBlankRow(row)) continue
      if (!row.rootAccount.trim() || !row.rootPassword.trim()) {
        toast.error('请为每一行填写 root 账号与密码')
        return
      }
      devices.push({
        internalIp: row.internalIp.trim() || undefined,
        externalIp: row.externalIp.trim() || undefined,
        port: row.port.trim() || undefined,
        rootAccount: row.rootAccount.trim(),
        rootPassword: row.rootPassword,
      })
    }

    if (devices.length === 0) {
      toast.error('请至少填写一行有效的设备信息')
      return
    }

    linkMutation.mutate({ holdId, devices })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>录入设备</DialogTitle>
          <DialogDescription>
            按内网/外网 IP 匹配供应商机房下的物理机；支持一次添加多行。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {rows.map((row, idx) => (
            <div
              key={row.key}
              className={`space-y-3 rounded-lg border p-4 ${row.error ? 'border-destructive/50 bg-destructive/5' : 'border-border'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">设备 {idx + 1}</span>
                {rows.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(row.key)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">内网 IP</Label>
                  <Input
                    className="font-mono text-sm"
                    placeholder="10.20.30.40"
                    value={row.internalIp}
                    onChange={(e) => updateRow(row.key, { internalIp: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">外网 IP</Label>
                  <Input
                    className="font-mono text-sm"
                    placeholder="203.0.113.10"
                    value={row.externalIp}
                    onChange={(e) => updateRow(row.key, { externalIp: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">端口</Label>
                  <Input
                    className="font-mono text-sm"
                    placeholder="22"
                    value={row.port}
                    onChange={(e) => updateRow(row.key, { port: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">root 账号</Label>
                  <Input
                    value={row.rootAccount}
                    onChange={(e) => updateRow(row.key, { rootAccount: e.target.value })}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs">root 密码</Label>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={row.rootPassword}
                    onChange={(e) => updateRow(row.key, { rootPassword: e.target.value })}
                  />
                </div>
              </div>
              {row.error && <p className="text-xs text-destructive">{row.error}</p>}
            </div>
          ))}

          <Button type="button" variant="outline" className="w-full gap-2" onClick={addRow}>
            <Plus className="h-4 w-4" />
            添加一行
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={linkMutation.isPending}>
            取消
          </Button>
          <Button onClick={submit} disabled={linkMutation.isPending}>
            {linkMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            确认录入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
