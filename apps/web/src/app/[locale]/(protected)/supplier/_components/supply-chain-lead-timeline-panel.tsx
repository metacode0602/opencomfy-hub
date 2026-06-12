'use client'

import { useState } from 'react'
import {
  ArrowRight,
  CheckCircle,
  Clock,
  Loader2,
  MapPin,
  MessageSquare,
  Pencil,
  Send,
  Server,
  Video,
} from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Textarea } from '@workspace/ui/components/textarea'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { toast } from 'sonner'
import { useUser } from '@/components/features/auth/hooks/use-user'
import { MarkdownContent } from '@/components/shared/markdown-content'
import { getAuthorRoleLabel } from '@/lib/supply-chain-leads/constants'
import type { SupplyChainLeadActivityDto } from '@/lib/types/supply-chain-lead-api'
import { trpc } from '@/lib/trpc/client'

function getActivityIcon(type: string) {
  switch (type) {
    case 'comment':
      return MessageSquare
    case 'meeting':
      return Video
    case 'stage_change':
      return ArrowRight
    case 'resource_update':
      return Server
    case 'site_visit':
      return MapPin
    case 'file':
      return CheckCircle
    default:
      return Clock
  }
}

interface SupplyChainLeadTimelinePanelProps {
  leadId: string
}

export function SupplyChainLeadTimelinePanel({ leadId }: SupplyChainLeadTimelinePanelProps) {
  const user = useUser()
  const utils = trpc.useUtils()
  const { data: activities = [], isLoading } = trpc.supplier.supplyChainLeads.listActivities.useQuery({
    leadId,
  })

  const createMutation = trpc.supplier.supplyChainLeads.createActivity.useMutation({
    onSuccess: async () => {
      setComment('')
      await utils.supplier.supplyChainLeads.listActivities.invalidate({ leadId })
      await utils.supplier.supplyChainLeads.getById.invalidate({ id: leadId })
      await utils.supplier.supplyChainLeads.list.invalidate()
      toast.success('发送成功')
    },
    onError: (e) => toast.error(e.message || '发送失败'),
  })

  const updateMutation = trpc.supplier.supplyChainLeads.updateActivity.useMutation({
    onSuccess: async () => {
      setEditingActivityId(null)
      setEditDraft('')
      await utils.supplier.supplyChainLeads.listActivities.invalidate({ leadId })
      toast.success('已保存')
    },
    onError: (e) => toast.error(e.message || '保存失败'),
  })

  const [comment, setComment] = useState('')
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')

  const authorName = user?.name ?? '当前用户'
  const authorInitials = authorName.slice(0, 2)
  const isMutating = createMutation.isPending || updateMutation.isPending

  const handleSend = () => {
    if (!comment.trim()) return
    createMutation.mutate({ leadId, description: comment.trim() })
  }

  const startEditing = (activity: SupplyChainLeadActivityDto) => {
    setEditingActivityId(activity.id)
    setEditDraft(activity.description)
  }

  const cancelEditing = () => {
    setEditingActivityId(null)
    setEditDraft('')
  }

  const handleSaveEdit = (activityId: string) => {
    if (!editDraft.trim()) return
    updateMutation.mutate({ activityId, description: editDraft.trim() })
  }

  const canEdit = (activity: SupplyChainLeadActivityDto) =>
    activity.type === 'comment' && activity.authorRole !== 'system'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">活动时间线</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-6 pb-6 border-b">
          <Avatar className="w-10 h-10">
            <AvatarFallback>{authorInitials}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <Textarea
              placeholder="添加跟进记录、沟通纪要..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              disabled={isMutating}
            />
            <div className="flex justify-end mt-2">
              <Button
                size="sm"
                type="button"
                disabled={!comment.trim() || isMutating}
                onClick={handleSend}
              >
                {createMutation.isPending ? (
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
          <div className="flex justify-center py-8 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            加载中...
          </div>
        ) : activities.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">暂无活动记录</p>
        ) : (
          <div className="space-y-6">
            {activities.map((activity, index) => {
              const Icon = getActivityIcon(activity.type)
              const isEditing = editingActivityId === activity.id
              const editable = canEdit(activity)

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
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium">{activity.title}</span>
                        <Badge variant="outline" className="text-xs">
                          {getAuthorRoleLabel(activity.authorRole)}
                        </Badge>
                        {activity.editedAt && (
                          <span className="text-xs text-muted-foreground">已编辑</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {editable && !isEditing && (
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            className="h-8 w-8 p-0"
                            disabled={isMutating}
                            onClick={() => startEditing(activity)}
                          >
                            <Pencil className="w-4 h-4" />
                            <span className="sr-only">编辑</span>
                          </Button>
                        )}
                        <span className="text-sm text-muted-foreground">
                          {new Date(activity.createdAt).toLocaleString('zh-CN')}
                        </span>
                      </div>
                    </div>

                    {isEditing ? (
                      <div className="mt-2 space-y-2">
                        <Textarea
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          rows={4}
                          disabled={updateMutation.isPending}
                        />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" type="button" onClick={cancelEditing}>
                            取消
                          </Button>
                          <Button
                            size="sm"
                            type="button"
                            disabled={!editDraft.trim() || updateMutation.isPending}
                            onClick={() => handleSaveEdit(activity.id)}
                          >
                            保存
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <MarkdownContent content={activity.description} className="mt-1" />
                    )}

                    <p className="text-sm text-muted-foreground mt-2">{activity.author}</p>

                    {activity.metadata && (
                      <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                        {Object.entries(activity.metadata).map(([key, value]) => (
                          <div key={key} className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">
                              {key === 'duration'
                                ? '时长'
                                : key === 'attendees'
                                  ? '参与人'
                                  : key}
                              :
                            </span>
                            <span>
                              {Array.isArray(value) ? value.join(', ') : String(value)}
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
        )}
      </CardContent>
    </Card>
  )
}
