export type BillingTenantListItem = {
  id: string
  customerId: string
  platformTenantId?: string
  name: string
  phone?: string
  status: string
  balance: number
  overdueAt?: string
  creditLimit?: number
  isDefault: boolean
  createdAt: string
  customerName: string
  contactPerson?: string
  contactPhone?: string
}

export type BillingTenantDetail = BillingTenantListItem & {
  customerType: 'B' | 'C'
  customerStatus: string
  contactEmail?: string
  updatedAt: string
}

export type BillingTenantUpdateInput = {
  tenant: {
    name: string
    phone?: string
    status: 'active' | 'inactive' | 'suspended'
    balance: number
    overdueAt?: string | null
    creditLimit?: number | null
    isDefault: boolean
  }
  customer: {
    contactPerson: string
    contactPhone: string
    contactEmail: string
    status: 'active' | 'inactive' | 'suspended'
  }
}

export type TenantImportResult = {
  total: number
  created: number
  updated: number
  failed: number
  errors: { row: number; platformTenantId?: string; message: string }[]
}
