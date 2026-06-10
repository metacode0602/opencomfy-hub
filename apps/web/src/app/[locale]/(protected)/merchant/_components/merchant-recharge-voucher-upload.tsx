'use client'

import { useRef } from 'react'
import { FileText, ImageIcon, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import type { MerchantRechargeAttachment } from '@/lib/types/merchant'
import { Button } from '@workspace/ui/components/button'
import { Label } from '@workspace/ui/components/label'

export const RECHARGE_VOUCHER_MAX_FILES = 5
export const RECHARGE_VOUCHER_MAX_BYTES = 20 * 1024 * 1024

const ACCEPTED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
])

const ACCEPT_ATTR = 'image/*,application/pdf,.pdf'

export type PendingVoucherFile = {
  id: string
  file: File
}

function isAcceptedVoucherFile(file: File): boolean {
  if (ACCEPTED_MIME_TYPES.has(file.type)) return true
  const lower = file.name.toLowerCase()
  return (
    lower.endsWith('.pdf') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.webp')
  )
}

export function formatVoucherFileSize(size: number) {
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(2)} MB`
}

export async function fileToDataUrl(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  const base64 = btoa(binary)
  const mimeType = file.type || 'application/octet-stream'
  return `data:${mimeType};base64,${base64}`
}

export function isImageAttachment(mimeType: string) {
  return mimeType.startsWith('image/')
}

export function VoucherFileIcon({ mimeType }: { mimeType: string }) {
  if (isImageAttachment(mimeType)) {
    return <ImageIcon className="size-4 shrink-0 text-muted-foreground" />
  }
  return <FileText className="size-4 shrink-0 text-muted-foreground" />
}

export type MerchantRechargeVoucherUploadProps = {
  existing: MerchantRechargeAttachment[]
  pending: PendingVoucherFile[]
  onExistingChange: (attachments: MerchantRechargeAttachment[]) => void
  onPendingChange: (files: PendingVoucherFile[]) => void
  required?: boolean
}

export function MerchantRechargeVoucherUpload({
  existing,
  pending,
  onExistingChange,
  onPendingChange,
  required = false,
}: MerchantRechargeVoucherUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const totalCount = existing.length + pending.length

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return

    const next: PendingVoucherFile[] = []
    for (const file of Array.from(files)) {
      if (!isAcceptedVoucherFile(file)) {
        toast.error(`「${file.name}」格式不支持，仅支持图片与 PDF`)
        continue
      }
      if (file.size > RECHARGE_VOUCHER_MAX_BYTES) {
        toast.error(`「${file.name}」超过 20MB 限制`)
        continue
      }
      if (totalCount + next.length >= RECHARGE_VOUCHER_MAX_FILES) {
        toast.error(`最多上传 ${RECHARGE_VOUCHER_MAX_FILES} 个凭证文件`)
        break
      }
      next.push({ id: crypto.randomUUID(), file })
    }

    if (next.length > 0) {
      onPendingChange([...pending, ...next])
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label>
          充值凭证
          {required ? <span className="text-destructive ml-0.5">*</span> : null}
        </Label>
        <span className="text-xs text-muted-foreground">
          {totalCount}/{RECHARGE_VOUCHER_MAX_FILES} · 图片 / PDF
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={(event) => {
          addFiles(event.target.files)
          event.target.value = ''
        }}
      />

      {existing.length > 0 || pending.length > 0 ? (
        <div className="space-y-2">
          {existing.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-2.5"
            >
              <VoucherFileIcon mimeType={item.mimeType} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{item.name}</p>
                <p className="text-xs text-muted-foreground">{formatVoucherFileSize(item.size)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                onClick={() => onExistingChange(existing.filter((a) => a.id !== item.id))}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
          {pending.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-2.5"
            >
              <VoucherFileIcon mimeType={item.file.type || 'application/octet-stream'} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{item.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatVoucherFileSize(item.file.size)} · 待上传
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                onClick={() => onPendingChange(pending.filter((f) => f.id !== item.id))}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground rounded-md border border-dashed border-border p-3 text-center">
          请上传银行回单、转账截图或 PDF 凭证
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2 w-fit"
        disabled={totalCount >= RECHARGE_VOUCHER_MAX_FILES}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="size-3.5" />
        选择文件
      </Button>
    </div>
  )
}
