'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
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
import { useSupplierDomainMockStore } from '@/lib/stores/supplier-domain-mock-store'
import { maskPassword } from '@/lib/supplier/onboarding-batch-utils'
import {
  draftToHoldDevice,
  findSupplierDeviceForHold,
  type TestHoldDeviceDraft,
} from '@/lib/supplier/test-hold-device-utils'
import type { InternalTestHold } from '@/lib/types/supplier-domain'

type DraftRow = TestHoldDeviceDraft & { key: string; error?: string }

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
  hold,
  open,
  onOpenChange,
}: {
  hold: InternalTestHold
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const devices = useSupplierDomainMockStore((s) => s.devices)
  const upsertInternalTestHold = useSupplierDomainMockStore((s) => s.upsertInternalTestHold)
  const createId = useSupplierDomainMockStore((s) => s.createId)

  const [rows, setRows] = useState<DraftRow[]>([emptyRow()])

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
    const existingIds = new Set((hold.devices ?? []).map((d) => d.device_id))
    const batchDeviceIds = new Set<string>()
    const newEntries: ReturnType<typeof draftToHoldDevice>[] = []
    const checkedRows: DraftRow[] = []
    let hasError = false

    for (const row of rows) {
      if (isBlankRow(row)) continue

      const draft: TestHoldDeviceDraft = {
        internalIp: row.internalIp,
        externalIp: row.externalIp,
        port: row.port,
        rootAccount: row.rootAccount,
        rootPassword: row.rootPassword,
      }

      if (!draft.rootAccount.trim() || !draft.rootPassword.trim()) {
        checkedRows.push({ ...row, error: '请填写 root 账号与密码' })
        hasError = true
        continue
      }

      const { device, error } = findSupplierDeviceForHold(hold, draft, devices)
      if (error || !device) {
        checkedRows.push({ ...row, error: error ?? '设备不存在' })
        hasError = true
        continue
      }

      if (existingIds.has(device.id) || batchDeviceIds.has(device.id)) {
        checkedRows.push({ ...row, error: '该设备已录入，请勿重复添加' })
        hasError = true
        continue
      }

      batchDeviceIds.add(device.id)
      const entry = draftToHoldDevice(hold, draft, device, createId)
      newEntries.push({
        ...entry,
        root_password: maskPassword(entry.root_password),
      })
      checkedRows.push({ ...row, error: undefined })
    }

    if (hasError) {
      setRows(checkedRows.length > 0 ? checkedRows : [emptyRow()])
      toast.error('部分行校验未通过，请修正后重试')
      return
    }

    if (newEntries.length === 0) {
      toast.error('请至少填写一行有效的设备信息')
      return
    }

    upsertInternalTestHold({
      ...hold,
      devices: [...(hold.devices ?? []), ...newEntries],
    })
    toast.success(`已录入 ${newEntries.length} 台设备`)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>录入设备</DialogTitle>
          <DialogDescription>
            按内网/外网 IP 匹配供应商机房下的物理机（Mock）；支持一次添加多行。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {rows.map((row, idx) => (
            <div
              key={row.key}
              className={`rounded-lg border p-4 space-y-3 ${row.error ? 'border-destructive/50 bg-destructive/5' : 'border-border'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">设备 {idx + 1}</span>
                {rows.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(row.key)}>
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
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
                <div className="space-y-1.5 col-span-2">
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
            <Plus className="w-4 h-4" />
            添加一行
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={submit}>确认录入</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
