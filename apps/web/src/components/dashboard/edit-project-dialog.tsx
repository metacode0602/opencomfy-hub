'use client'

import { useEffect, useState } from 'react'
import { Button } from '@workspace/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import type { BusinessLine, Project } from '@/lib/data/types'
import { ProjectFormFields } from './project-form-fields'
import {
  formValuesToProjectInput,
  projectToFormValues,
  validateProjectForm,
} from './project-form-utils'
import { trpc } from '@/lib/trpc/client'

export type EditProjectDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project | null
  businessLines: BusinessLine[]
  onUpdated: () => void
}

export function EditProjectDialog({
  open,
  onOpenChange,
  project,
  businessLines,
  onUpdated,
}: EditProjectDialogProps) {
  const [values, setValues] = useState<ReturnType<typeof projectToFormValues> | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const { data: staff = [] } = trpc.crm.staff.listActive.useQuery()
  const updateMutation = trpc.crm.projects.update.useMutation({
    onSuccess: () => {
      onUpdated()
      onOpenChange(false)
    },
    onError: (e) => setSubmitError(e.message),
  })

  useEffect(() => {
    if (open && project) {
      setValues(projectToFormValues(project, staff))
      setSubmitError(null)
    }
    if (!open) {
      setValues(null)
      setSubmitError(null)
    }
  }, [open, project, staff])

  const handleChange = (patch: Partial<NonNullable<typeof values>>) => {
    setValues((prev) => (prev ? { ...prev, ...patch } : prev))
    setSubmitError(null)
  }

  const handleSubmit = () => {
    if (!project || !values) return

    const error = validateProjectForm(values)
    if (error) {
      setSubmitError(error)
      return
    }

    updateMutation.mutate({
      id: project.id,
      data: {
        ...formValuesToProjectInput(values),
        status: project.status,
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑项目</DialogTitle>
          <DialogDescription>
            {project ? `修改「${project.name}」的基本信息` : '修改项目基本信息'}
          </DialogDescription>
        </DialogHeader>

        {values && (
          <ProjectFormFields
            values={values}
            onChange={handleChange}
            businessLines={businessLines}
            idPrefix="edit-project"
            disableCustomerAndTenant
            hideAccountManager
            hideRevenueDepartment
          />
        )}

        {submitError && <p className="text-sm text-destructive">{submitError}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={!values || updateMutation.isPending}>
            {updateMutation.isPending ? '保存中…' : '保存修改'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
