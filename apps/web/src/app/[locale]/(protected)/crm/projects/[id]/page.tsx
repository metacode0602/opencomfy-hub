import { AppShell } from '@/components/dashboard/app-shell'
import { ProjectDetailContent } from '@/components/dashboard/project-detail-content'
import { createServerCaller } from '@/lib/trpc/server'
import { notFound } from 'next/navigation'

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const caller = await createServerCaller()
  const project = await caller.crm.projects.getById({ id })

  if (!project) {
    notFound()
  }

  return (
    <AppShell>
      <ProjectDetailContent project={project} />
    </AppShell>
  )
}
