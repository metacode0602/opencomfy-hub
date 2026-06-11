export type EntityContact = {
  id: string
  name: string
  phone: string
  email: string
  wechatId: string
  title: string
  isPrimary: boolean
  sortOrder: number
  remark: string
  createdAt: string
  updatedAt: string
}

export type CustomerContact = EntityContact & { customerId: string }
export type TenantContact = EntityContact & { tenantId: string }
export type MerchantContact = EntityContact & { merchantId: string }

export type EntityContactInput = {
  name: string
  phone?: string
  email?: string
  wechatId?: string
  title?: string
  remark?: string
  isPrimary?: boolean
}
