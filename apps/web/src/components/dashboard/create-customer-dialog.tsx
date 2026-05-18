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
import type { Customer } from '@/lib/data/types'
import {
  CustomerFormFields,
  emptyCustomerFormValues,
  type CustomerFormValues,
} from './customer-form-fields'
import { formValuesToCustomer, validateCustomerForm } from './customer-form-utils'

export type CreateCustomerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (customer: Customer) => void
}

export function CreateCustomerDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateCustomerDialogProps) {
  const [values, setValues] = useState<CustomerFormValues>(emptyCustomerFormValues)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setValues(emptyCustomerFormValues)
      setSubmitError(null)
    }
  }, [open])

  const handleChange = (patch: Partial<CustomerFormValues>) => {
    setValues((prev) => ({ ...prev, ...patch }))
    setSubmitError(null)
  }

  const handleSubmit = () => {
    const error = validateCustomerForm(values)
    if (error) {
      setSubmitError(error)
      return
    }

    const customer = formValuesToCustomer(values, {
      id: `t-${Date.now()}`,
    })
    onCreated(customer)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>新建客户</DialogTitle>
          <DialogDescription>填写客户基本信息，创建新的客户账号</DialogDescription>
        </DialogHeader>

        <CustomerFormFields values={values} onChange={handleChange} idPrefix="create-customer" />

        {submitError && <p className="text-sm text-destructive">{submitError}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit}>创建客户</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
