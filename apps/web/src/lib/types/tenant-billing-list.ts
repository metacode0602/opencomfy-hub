export type TenantRechargeListItem = {
  id: string
  transactionId: string
  amount: number
  paymentMethod: string
  status: string
  remark?: string
  createdAt: string
  completedAt?: string
}

export type TenantMonthlyBillListItem = {
  id: string
  billMonth: string
  totalAmount: number
  balanceAmount: number
  couponAmount: number
  status: string
  dueDate: string
  paidAt?: string
}

export type TenantMonthlyBillDetailItem = {
  id: string
  productLine: string
  resourceName: string
  amount: number
  balanceAmount: number
  couponAmount: number
  type: string
}

export type TenantCommerceOrderItem = {
  name: string
  quantity: number
  unitPrice: number
  total: number
}

export type TenantCommerceOrderListItem = {
  id: string
  orderNo: string
  status: string
  amount: number
  balanceAmount: number
  couponAmount: number
  dataCenterName?: string
  deviceCount?: number
  deviceModel?: string
  gpuCount?: number
  unit?: string
  createdAt: string
  completedAt?: string
  items: TenantCommerceOrderItem[]
}
