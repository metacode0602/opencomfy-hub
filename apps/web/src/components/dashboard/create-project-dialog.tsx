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
  emptyProjectFormValues,
  formValuesToProjectInput,
  validateProjectForm,
} from './project-form-utils'
import { trpc } from '@/lib/trpc/client'

export type CreateProjectDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessLines: BusinessLine[]
  onCreated: () => void
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  businessLines,
  onCreated,
}: CreateProjectDialogProps) {
  const [values, setValues] = useState(emptyProjectFormValues)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const createMutation = trpc.crm.projects.create.useMutation({
    onSuccess: () => {
      onCreated()
      onOpenChange(false)
    },
    onError: (e) => setSubmitError(e.message),
  })

  useEffect(() => {
    if (!open) {
      setValues(emptyProjectFormValues)
      setSubmitError(null)
    }
  }, [open])

  const handleChange = (patch: Partial<typeof values>) => {
    setValues((prev) => ({ ...prev, ...patch }))
    setSubmitError(null)
  }

  const handleSubmit = () => {
    const error = validateProjectForm(values)
    if (error) {
      setSubmitError(error)
      return
    }

    createMutation.mutate(formValuesToProjectInput(values))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新建项目</DialogTitle>
          <DialogDescription>创建新项目并关联客户</DialogDescription>
        </DialogHeader>

        <ProjectFormFields
          values={values}
          onChange={handleChange}
          businessLines={businessLines}
          idPrefix="create-project"
        />

        {submitError && <p className="text-sm text-destructive">{submitError}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending}>
            {createMutation.isPending ? '创建中…' : '创建项目'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
