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
  formValuesToProject,
  validateProjectForm,
} from './project-form-utils'

export type CreateProjectDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessLines: BusinessLine[]
  onCreated: (project: Project) => void
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  businessLines,
  onCreated,
}: CreateProjectDialogProps) {
  const [values, setValues] = useState(emptyProjectFormValues)
  const [submitError, setSubmitError] = useState<string | null>(null)

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

    const project = formValuesToProject(
      values,
      {
        id: `p-${Date.now()}`,
        totalConsumption: 0,
        balance: 0,
      },
      businessLines,
    )
    onCreated(project)
    onOpenChange(false)
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
          <Button onClick={handleSubmit}>创建项目</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
