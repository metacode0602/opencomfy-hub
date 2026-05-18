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
  type CustomerFormValues,
} from './customer-form-fields'
import {
  customerToFormValues,
  formValuesToCustomer,
  validateCustomerForm,
} from './customer-form-utils'

export type EditCustomerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: Customer | null
  onUpdated: (customer: Customer) => void
}

export function EditCustomerDialog({
  open,
  onOpenChange,
  customer,
  onUpdated,
}: EditCustomerDialogProps) {
  const [values, setValues] = useState<CustomerFormValues | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (open && customer) {
      setValues(customerToFormValues(customer))
      setSubmitError(null)
    }
    if (!open) {
      setValues(null)
      setSubmitError(null)
    }
  }, [open, customer])

  const handleChange = (patch: Partial<CustomerFormValues>) => {
    setValues((prev) => (prev ? { ...prev, ...patch } : prev))
    setSubmitError(null)
  }

  const handleSubmit = () => {
    if (!customer || !values) return

    const error = validateCustomerForm(values)
    if (error) {
      setSubmitError(error)
      return
    }

    onUpdated(
      formValuesToCustomer(values, {
        id: customer.id,
        status: customer.status,
        createdAt: customer.createdAt,
        projectCount: customer.projectCount,
        totalRecharge: customer.totalRecharge,
        totalConsumption: customer.totalConsumption,
        balance: customer.balance,
      }),
    )
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑客户</DialogTitle>
          <DialogDescription>
            {customer ? `修改「${customer.name}」的基本信息` : '修改客户基本信息'}
          </DialogDescription>
        </DialogHeader>

        {values && (
          <CustomerFormFields values={values} onChange={handleChange} idPrefix="edit-customer" />
        )}

        {submitError && <p className="text-sm text-destructive">{submitError}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={!values}>
            保存修改
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
