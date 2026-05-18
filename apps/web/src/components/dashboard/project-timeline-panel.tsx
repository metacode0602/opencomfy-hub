'use client'

import { useState } from 'react'
import {
  Download,
  FileText,
  Send,
  Upload,
  Video,
} from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Textarea } from '@workspace/ui/components/textarea'
import { Avatar, AvatarFallback } from '@workspace/ui/components/avatar'
import { getActivitiesByProjectId } from '@/lib/data/mock-data'
import type { Activity, Project } from '@/lib/data/types'
import { getRoleLabel } from '@/components/dashboard/project-detail-constants'
import { getActivityIcon } from '@/components/dashboard/project-detail-utils'

interface ProjectTimelinePanelProps {
  project: Project
}

export function ProjectTimelinePanel({ project }: ProjectTimelinePanelProps) {
  const [comment, setComment] = useState('')
  const [activities] = useState<Activity[]>(() => getActivitiesByProjectId(project.id))

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">活动时间线</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Upload className="w-4 h-4 mr-2" />
            上传文件
          </Button>
          <Button variant="outline" size="sm">
            <Video className="w-4 h-4 mr-2" />
            记录会议
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-6 pb-6 border-b">
          <Avatar className="w-10 h-10">
            <AvatarFallback>管理</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <Textarea
              placeholder="添加评论或备注..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end mt-2">
              <Button size="sm" disabled={!comment.trim()}>
                <Send className="w-4 h-4 mr-2" />
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
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                          <Button variant="ghost" size="sm">
                            <Download className="w-4 h-4" />
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
