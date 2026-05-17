'use client'

import { Badge } from '@workspace/ui/components/badge'
import { cn } from '@workspace/ui/lib/utils'

interface StatusBadgeProps {
  status: string
  colorMap?: Record<string, string>
  labelMap?: Record<string, string>
  className?: string
}

const defaultColorMap: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  inactive: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  suspended: 'bg-red-500/20 text-red-400 border-red-500/30',
  paused: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  running: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  expired: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  terminated: 'bg-red-500/20 text-red-400 border-red-500/30',
  processing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  used: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  paid: 'bg-green-500/20 text-green-400 border-green-500/30',
  overdue: 'bg-red-500/20 text-red-400 border-red-500/30',
  lead: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  testing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  converted: 'bg-green-500/20 text-green-400 border-green-500/30',
}

const defaultLabelMap: Record<string, string> = {
  active: '活跃',
  inactive: '未激活',
  suspended: '已暂停',
  paused: '已暂停',
  completed: '已完成',
  pending: '待处理',
  running: '运行中',
  failed: '失败',
  draft: '草稿',
  expired: '已过期',
  terminated: '已终止',
  processing: '处理中',
  cancelled: '已取消',
  used: '已使用',
  paid: '已支付',
  overdue: '逾期',
  lead: '线索孵化',
  testing: '测试中',
  converted: '已转正',
}

export function StatusBadge({ 
  status, 
  colorMap = defaultColorMap,
  labelMap = defaultLabelMap,
  className 
}: StatusBadgeProps) {
  const color = colorMap[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  const label = labelMap[status] || status

  return (
    <Badge 
      variant="outline" 
      className={cn('border font-medium', color, className)}
    >
      {label}
    </Badge>
  )
}
