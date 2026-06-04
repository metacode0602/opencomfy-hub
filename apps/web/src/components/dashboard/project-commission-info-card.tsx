'use client'

import { Badge } from '@workspace/ui/components/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import type { Project } from '@/lib/data/types'
import {
  CONVERSION_REASON_LABELS,
  OPPORTUNITY_SOURCE_LABELS,
} from '@/lib/crm/commission-constants'
import { trpc } from '@/lib/trpc/client'

type Props = {
  project: Project
}

export function ProjectCommissionInfoCard({ project }: Props) {
  const { data: phase, isLoading } = trpc.crm.projects.getCommissionPhase.useQuery({
    projectId: project.id,
  })

  const opportunityLabel = project.opportunitySource
    ? OPPORTUNITY_SOURCE_LABELS[project.opportunitySource]
    : '未设置'

  const conversion = project.conversionSetting

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">弹性算力提成</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">商机来源</p>
            <p className="font-medium">{opportunityLabel}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">成交锚定月</p>
            <p className="font-medium">{project.dealClosedMonth ?? '待首月消费锚定'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">当前月序</p>
            {isLoading ? (
              <p className="text-muted-foreground">加载中…</p>
            ) : phase?.monthsSinceDeal != null ? (
              <p className="font-medium">成交后第 {phase.monthsSinceDeal} 月</p>
            ) : (
              <p className="text-muted-foreground">—</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">提成月序分段</p>
            {isLoading ? (
              <p className="text-muted-foreground">加载中…</p>
            ) : phase?.monthPhaseLabel ? (
              <div className="flex items-center gap-2">
                <span className="font-medium">{phase.monthPhaseLabel}</span>
                {phase.isLocked ? (
                  <Badge variant="secondary" className="font-normal text-xs">
                    已固化
                  </Badge>
                ) : null}
              </div>
            ) : (
              <p className="text-muted-foreground">—</p>
            )}
          </div>
        </div>

        {conversion ? (
          <div className="border-t pt-3 space-y-1">
            <p className="text-xs text-muted-foreground">转正信息</p>
            <p>
              {CONVERSION_REASON_LABELS[conversion.reason]} · 签约 {conversion.signedOn} · 转正{' '}
              {conversion.conversionDate}
            </p>
            {conversion.remark ? (
              <p className="text-muted-foreground text-xs">{conversion.remark}</p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
