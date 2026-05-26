'use client'

import { useRef, useState } from 'react'
import {
  Download,
  FileText,
  Loader2,
  Send,
  Upload,
  Video,
  X,
} from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Textarea } from '@workspace/ui/components/textarea'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { toast } from 'sonner'
import { trpc } from '@/lib/trpc/client'
import type { Project } from '@/lib/data/types'
import { getRoleLabel } from '@/components/dashboard/project-detail-constants'
import { getActivityIcon } from '@/components/dashboard/project-detail-utils'
import { useUser } from '@/components/features/auth/hooks/use-user'

interface ProjectTimelinePanelProps {
  project: Project
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

export function ProjectTimelinePanel({ project }: ProjectTimelinePanelProps) {
  const user = useUser()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [comment, setComment] = useState('')
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const utils = trpc.useUtils()
  const { data: activities = [] } = trpc.crm.projects.listActivities.useQuery({
    projectId: project.id,
  })

  const createActivity = trpc.crm.projects.createActivity.useMutation({
    onSuccess: async () => {
      setComment('')
      setPendingFiles([])
      await utils.crm.projects.listActivities.invalidate({ projectId: project.id })
      toast.success('发送成功')
    },
    onError: (error) => {
      toast.error(error.message || '发送失败')
    },
  })

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
    if (!canSend || createActivity.isPending) return

    try {
      const files = await Promise.all(
        pendingFiles.map(async (item) => ({
          fileName: item.file.name,
          mimeType: item.file.type || 'application/octet-stream',
          fileBase64: await fileToBase64(item.file),
        })),
      )

      await createActivity.mutateAsync({
        projectId: project.id,
        comment,
        files,
      })
    } catch {
      /* handled in onError */
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">活动时间线</CardTitle>
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
            disabled={createActivity.isPending || pendingFiles.length >= MAX_FILES}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            上传文件
          </Button>
          <Button variant="outline" size="sm" type="button" disabled>
            <Video className="w-4 h-4 mr-2" />
            记录会议
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-6 pb-6 border-b">
          <Avatar className="w-10 h-10">
            <AvatarFallback>{authorInitials}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <Textarea
              placeholder="添加评论或备注..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              disabled={createActivity.isPending}
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
                      disabled={createActivity.isPending}
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
                disabled={!canSend || createActivity.isPending}
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

        <div className="space-y-6">
          {activities.map((activity, index) => {
            const Icon = getActivityIcon(activity.type)
            return (
              <div key={activity.id} className="flex gap-4">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  {index < activities.length - 1 && (
                    <div className="absolute top-12 left-1/2 -translate-x-1/2 w-0.5 h-[calc(100%-12px)] bg-border" />
                  )}
                </div>
                <div className="flex-1 pb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{activity.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {getRoleLabel(activity.authorRole)}
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(activity.createdAt).toLocaleString('zh-CN')}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1">{activity.description}</p>
                  <p className="text-sm text-muted-foreground mt-2">{activity.author}</p>

                  {activity.attachments && activity.attachments.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {activity.attachments.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                        >
                          <FileText className="w-5 h-5 text-muted-foreground" />
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

                  {activity.metadata && (
                    <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                      {Object.entries(activity.metadata).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">
                            {key === 'duration' ? '时长' : key === 'attendees' ? '参与人' : key}:
                          </span>
                          <span>
                            {Array.isArray(value) ? (value as string[]).join(', ') : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
