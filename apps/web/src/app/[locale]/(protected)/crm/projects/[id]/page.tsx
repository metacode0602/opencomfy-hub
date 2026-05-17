import { AppShell } from '@/components/dashboard/app-shell'
import { ProjectDetailContent } from '@/components/dashboard/project-detail-content'
import { mockProjects } from '@/lib/data/mock-data'
import { notFound } from 'next/navigation'

export default async function ProjectDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params
  const project = mockProjects.find(p => p.id === id)
  
  if (!project) {
    notFound()
  }

  return (
    <AppShell>
      <ProjectDetailContent project={project} />
    </AppShell>
  )
}
