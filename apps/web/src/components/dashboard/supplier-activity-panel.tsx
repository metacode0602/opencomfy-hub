'use client'

import { useRef, useState } from 'react'
import {
  Activity,
  Download,
  FileText,
  Loader2,
  MessageSquare,
  Send,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Textarea } from '@workspace/ui/components/textarea'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc/client'
import { useUser } from '@/components/features/auth/hooks/use-user'

const typeLabels: Record<string, string> = {
  comment: '评论',
  file: '附件',
  batch_started: '批次',
  device_online: '上线',
  device_onboarding: '接入',
  internal_test_hold: '测试',
  fault_opened: '故障',
  fault_closed: '故障',
  ops_import: '导入',
  device_change_imported: '变更导入',
  pricing_change: '定价',
  contract_created: '合同',
}

type PendingFile = {
  id: string
  file: File
}

const MAX_FILE_BYTES = 20 * 1024 * 1024
const MAX_FILES = 5

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }
  return `${(size / 1024 / 1024).toFixed(2)} MB`
}

function formatDt(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getActivityIcon(type: string) {
  if (type === 'comment' || type === 'file') return MessageSquare
  return Activity
}

interface SupplierActivityPanelProps {
  supplierId: string
}

export function SupplierActivityPanel({ supplierId }: SupplierActivityPanelProps) {
  const user = useUser()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [comment, setComment] = useState('')
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const utils = trpc.useUtils()

  const {
    data: items = [],
    isLoading,
    isError,
    error,
  } = trpc.supplier.listSupplierActivities.useQuery(
    { supplierId, limit: 100 },
    { enabled: Boolean(supplierId) },
  )

  const createActivity = trpc.supplier.createSupplierActivity.useMutation({
    onSuccess: async () => {
      setComment('')
      setPendingFiles([])
      await utils.supplier.listSupplierActivities.invalidate({ supplierId })
      toast.success('发送成功')
    },
    onError: (err) => {
      toast.error(err.message || '发送失败')
    },
  })

  const isMutating = createActivity.isPending
  const canSend = comment.trim().length > 0 || pendingFiles.length > 0
  const authorInitials = user?.name?.slice(0, 2) ?? '我'

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return

    const next: PendingFile[] = []
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`文件 ${file.name} 超过 20MB 限制`)
        continue
      }
      if (pendingFiles.length + next.length >= MAX_FILES) {
        toast.error(`最多上传 ${MAX_FILES} 个文件`)
        break
      }
      next.push({ id: crypto.randomUUID(), file })
    }

    if (next.length > 0) {
      setPendingFiles((current) => [...current, ...next])
    }
  }

  const handleSend = async () => {
    if (!canSend || isMutating) return

    try {
      const files = await Promise.all(
        pendingFiles.map(async (item) => ({
          fileName: item.file.name,
          mimeType: item.file.type || 'application/octet-stream',
          fileBase64: await fileToBase64(item.file),
        })),
      )

      await createActivity.mutateAsync({
        supplierId,
        comment,
        files,
      })
    } catch {
      /* handled in onError */
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium text-foreground">活动时间线</h2>
        <p className="text-sm text-muted-foreground">合同、接入、上线、故障与测试等运营事件</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">添加备注</CardTitle>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                addFiles(event.target.files)
                event.target.value = ''
              }}
            />
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={isMutating || pendingFiles.length >= MAX_FILES}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              上传文件
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 pb-6 border-b">
            <Avatar className="w-10 h-10 shrink-0">
              <AvatarFallback>{authorInitials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <Textarea
                placeholder="添加评论或备注..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                disabled={isMutating}
              />

              {pendingFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {pendingFiles.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                    >
                      <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(item.file.size)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        disabled={isMutating}
                        onClick={() =>
                          setPendingFiles((current) =>
                            current.filter((file) => file.id !== item.id),
                          )
                        }
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end mt-2">
                <Button
                  size="sm"
                  type="button"
                  disabled={!canSend || isMutating}
                  onClick={() => void handleSend()}
                >
                  {createActivity.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  发送
                </Button>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              加载中…
            </div>
          ) : isError ? (
            <p className="p-8 text-center text-destructive text-sm">
              {error.message || '加载活动记录失败'}
            </p>
          ) : items.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground text-sm">暂无活动记录</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((a) => {
                const Icon = getActivityIcon(a.type)
                return (
                  <li key={a.id} className="py-4 flex gap-4">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">{a.title}</span>
                        <Badge variant="outline" className="text-xs">
                          {typeLabels[a.type] ?? a.type}
                        </Badge>
                        {a.author_role === 'system' && (
                          <Badge variant="secondary" className="text-xs">
                            系统
                          </Badge>
                        )}
                      </div>
                      {a.description && (
                        <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                          {a.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {a.author_name} · {formatDt(a.occurred_at)}
                      </p>

                      {a.attachments && a.attachments.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {a.attachments.map((file) => (
                            <div
                              key={file.id}
                              className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                            >
                              <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatFileSize(file.size)}
                                </p>
                              </div>
                              <Button variant="ghost" size="sm" asChild>
                                <a href={file.url} download={file.name}>
                                  <Download className="w-4 h-4" />
                                </a>
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
