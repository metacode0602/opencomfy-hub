'use client'

import { useState } from 'react'
import { normalizeAppRole } from '@/lib/auth/app-role'
import { authClient } from '@/lib/auth-client'
import { trpc } from '@/lib/trpc/client'
import { invalidateCrmWorkbench } from '@/lib/dashboard/invalidate-crm-workbench'
import { CreateProjectDialog } from '@/components/dashboard/create-project-dialog'
import { Button } from '@workspace/ui/components/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@workspace/ui/components/tooltip'

export function WorkbenchHeader() {
  const utils = trpc.useUtils()
  const { data: session } = authClient.useSession()
  const { data: businessLines = [] } = trpc.crm.businessLines.listActive.useQuery()
  const [createOpen, setCreateOpen] = useState(false)

  const userName = session?.user?.name ?? '用户'
  const isAdmin = normalizeAppRole(session?.user?.role) === 'admin'

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">工作台</h1>
          <p className="text-muted-foreground">欢迎回来，{userName}</p>
        </div>
        {isAdmin ? (
          <div className="flex items-center gap-2">
            <Button onClick={() => setCreateOpen(true)}>新建项目</Button>
          </div>
        ) : null}
      </div>

      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        businessLines={businessLines}
        onCreated={() => invalidateCrmWorkbench(utils)}
      />
    </>
  )
}
