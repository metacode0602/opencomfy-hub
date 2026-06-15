'use client'

import { Badge } from '@workspace/ui/components/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { PROJECT_STAFF_ROLE_LABELS, type ProjectStaffRoleType } from '@/lib/crm/project-staff-roles'
import { trpc } from '@/lib/trpc/client'

export type ProjectStaffAssignmentHistoryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectName: string
  roleType: ProjectStaffRoleType
}

function formatDateTime(iso: string): string {
  return iso.slice(0, 19).replace('T', ' ')
}

export function ProjectStaffAssignmentHistoryDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  roleType,
}: ProjectStaffAssignmentHistoryDialogProps) {
  const roleLabel = PROJECT_STAFF_ROLE_LABELS[roleType]
  const { data: history = [], isLoading, isError, refetch } =
    trpc.crm.projects.listStaffAssignmentHistory.useQuery(
      { projectId, roleType },
      { enabled: open && !!projectId },
    )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{roleLabel}变更历史</DialogTitle>
          <DialogDescription>
            项目「{projectName}」的{roleLabel}任职记录，按生效日期倒序排列。
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-auto flex-1 -mx-1 px-1">
          {isError && (
            <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              加载历史失败，请
              <button type="button" className="ml-1 underline" onClick={() => refetch()}>
                重试
              </button>
            </div>
          )}

          {isLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">加载中…</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">暂无变更记录</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>人员</TableHead>
                  <TableHead>生效日期</TableHead>
                  <TableHead>结束日期</TableHead>
                  <TableHead>记录时间</TableHead>
                  <TableHead>操作人</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        {row.staffName}
                        {row.isCurrent && (
                          <Badge variant="secondary" className="text-xs">
                            当前
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{row.effectiveFrom}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {row.effectiveTo ?? '—'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                      {formatDateTime(row.createdAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.createdByName ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
