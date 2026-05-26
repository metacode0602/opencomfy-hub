'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import { Checkbox } from '@workspace/ui/components/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import type { Project } from '@/lib/data/types'
import { trpc } from '@/lib/trpc/client'

export type ProjectTagsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project | null
  onSaved: () => void
}

export function ProjectTagsDialog({
  open,
  onOpenChange,
  project,
  onSaved,
}: ProjectTagsDialogProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  const utils = trpc.useUtils()
  const { data: allTags = [], isLoading: tagsLoading } = trpc.crm.projectTags.list.useQuery(
    undefined,
    { enabled: open },
  )
  const { data: projectTags = [], isLoading: projectTagsLoading } =
    trpc.crm.projectTags.listByProject.useQuery(
      { projectId: project?.id ?? '' },
      { enabled: open && !!project?.id },
    )

  const createTagMutation = trpc.crm.projectTags.create.useMutation({
    onSuccess: (tag) => {
      void utils.crm.projectTags.list.invalidate()
      setSelectedIds((prev) => (prev.includes(tag.id) ? prev : [...prev, tag.id]))
      setNewTagName('')
      setSubmitError(null)
    },
    onError: (e) => setSubmitError(e.message),
  })

  const setTagsMutation = trpc.crm.projectTags.setForProject.useMutation({
    onSuccess: () => {
      void utils.crm.projectTags.listByProject.invalidate()
      void utils.crm.projects.list.invalidate()
      onSaved()
      onOpenChange(false)
    },
    onError: (e) => setSubmitError(e.message),
  })

  const projectTagIds = projectTags.map((t) => t.id).join(',')

  useEffect(() => {
    if (!open || !project?.id) return
    setSelectedIds(projectTagIds ? projectTagIds.split(',') : [])
    setNewTagName('')
    setSubmitError(null)
  }, [open, project?.id, projectTagIds])

  const toggleTag = (tagId: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? (prev.includes(tagId) ? prev : [...prev, tagId]) : prev.filter((id) => id !== tagId),
    )
    setSubmitError(null)
  }

  const handleAddTag = () => {
    const name = newTagName.trim()
    if (!name) {
      setSubmitError('请输入标签名称')
      return
    }
    const existing = allTags.find((t) => t.name === name)
    if (existing) {
      setSelectedIds((prev) => (prev.includes(existing.id) ? prev : [...prev, existing.id]))
      setNewTagName('')
      return
    }
    createTagMutation.mutate({ name })
  }

  const handleSubmit = () => {
    if (!project) return
    setTagsMutation.mutate({ projectId: project.id, tagIds: selectedIds })
  }

  const loading = tagsLoading || projectTagsLoading
  const saving = setTagsMutation.isPending || createTagMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>设置标签</DialogTitle>
          <DialogDescription>
            {project ? `为「${project.name}」选择或新增标签` : '为项目选择或新增标签'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>可选标签</Label>
            {loading ? (
              <p className="text-sm text-muted-foreground">加载中…</p>
            ) : allTags.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无标签，请先新增</p>
            ) : (
              <div className="space-y-2 max-h-[240px] overflow-y-auto rounded-md border p-3">
                {allTags.map((tag) => (
                  <label
                    key={tag.id}
                    className="flex items-center gap-3 cursor-pointer rounded-sm px-1 py-1.5 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedIds.includes(tag.id)}
                      onCheckedChange={(checked) => toggleTag(tag.id, checked === true)}
                    />
                    <span className="text-sm">{tag.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-project-tag">新增标签</Label>
            <div className="flex gap-2">
              <Input
                id="new-project-tag"
                placeholder="输入新标签名称"
                value={newTagName}
                onChange={(e) => {
                  setNewTagName(e.target.value)
                  setSubmitError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddTag()
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddTag}
                disabled={createTagMutation.isPending}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={!project || saving}>
            {setTagsMutation.isPending ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
