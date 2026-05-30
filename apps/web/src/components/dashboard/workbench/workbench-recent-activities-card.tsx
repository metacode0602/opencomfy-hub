'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Skeleton } from '@workspace/ui/components/skeleton'
import { trpc } from '@/lib/trpc/client'

export function WorkbenchRecentActivitiesCard() {
  const { data: recentActivities = [], isLoading } = trpc.crm.dashboard.recentActivities.useQuery({
    limit: 6,
  })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium">最近动态</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[220px] w-full" />
        ) : recentActivities.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">暂无动态</div>
        ) : (
          <div className="space-y-4">
            {recentActivities.map((activity) => (
              <div key={activity.id} className="flex gap-3">
                <div className="w-2 h-2 mt-2 rounded-full bg-primary flex-shrink-0" />
                <div className="space-y-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">{activity.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {activity.projectName || '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activity.createdAt.split('T')[0]}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
