import type {
  Activity,
  Bill,
  BillDetail,
  BusinessLine,
  Consumption,
  Contract,
  Coupon,
  Customer,
  CustomerExpectedScale,
  Order,
  OrderItem,
  PlatformTenant,
  Project,
  Recharge,
  Task,
} from '@/lib/data/types'
import type { UserStaff } from '@/lib/types/crm'
import type {
  BillingTenantRow,
  CrmProjectRow,
  CustomerRow,
} from '@workspace/db/schema'

/** numeric / string → number */
export function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0
  if (typeof value === 'number') return value
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export function toIsoDate(value: Date | string | null | undefined): string {
  if (!value) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

export function toIsoDateTime(value: Date | string | null | undefined): string {
  if (!value) return ''
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

export function mapBusinessLineRow(row: {
  id: string
  code: string
  name: string
  description: string | null
  sortOrder: number
  status: string
}): BusinessLine {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description ?? undefined,
    sortOrder: row.sortOrder,
    status: row.status as BusinessLine['status'],
  }
}

export function mapUserStaffRow(row: {
  id: string
  employeeNo: string | null
  displayName: string
  mobile: string
  email: string | null
  status: string
}): UserStaff {
  return {
    id: row.id,
    employee_no: row.employeeNo,
    display_name: row.displayName,
    mobile: row.mobile,
    email: row.email,
    status: row.status,
  }
}

export function mapCustomerRow(
  row: CustomerRow,
  metrics: {
    projectCount: number
    totalRecharge: number
    totalConsumption: number
    balance: number
    salesManagerName?: string
  },
): Customer {
  return {
    id: row.id,
    name: row.name,
    shortName: row.accountName ?? undefined,
    type: row.type as Customer['type'],
    status: row.status as Customer['status'],
    contactPerson: row.contactPerson ?? '',
    contactPhone: row.contactPhone ?? '',
    contactEmail: row.contactEmail ?? '',
    industry: row.industry ?? '',
    address: row.address ?? '',
    certCode: row.certCode ?? undefined,
    salesManagerId: row.salesManagerId ?? undefined,
    salesManagerName: metrics.salesManagerName,
    expectedScale: (row.expectedScale as CustomerExpectedScale | null) ?? null,
    createdAt: toIsoDate(row.createdAt),
    projectCount: metrics.projectCount,
    totalRecharge: metrics.totalRecharge,
    totalConsumption: metrics.totalConsumption,
    balance: metrics.balance,
  }
}

export function mapBillingTenantRow(row: BillingTenantRow): PlatformTenant {
  return {
    id: row.id,
    customerId: row.customerId,
    name: row.name,
    platformTenantId: row.platformTenantId ?? undefined,
    phone: row.phone ?? undefined,
    isDefault: row.isDefault,
    status: row.status as PlatformTenant['status'],
    balance: toNumber(row.balance),
    overdueAt: row.overdue_at ? row.overdue_at.toISOString() : undefined,
    creditLimit: row.credit_limit != null ? toNumber(row.credit_limit) : undefined,
  }
}

export function mapProjectRow(
  row: CrmProjectRow & {
    customerName: string
    customerType: string
    businessLineName: string
    preSalesManager: string
    accountManager: string
    deliveryManager: string
    projectManager: string
    totalConsumption: number
  },
): Project {
  return {
    id: row.id,
    name: row.name,
    customerId: row.customerId,
    customerName: row.customerName,
    customerType: row.customerType as Project['customerType'],
    primaryTenantId: row.primaryTenantId ?? undefined,
    businessLineId: row.businessLineId,
    businessLineName: row.businessLineName,
    stage: row.stage as Project['stage'],
    status: row.status as Project['status'],
    preSalesManager: row.preSalesManager,
    accountManager: row.accountManager,
    deliveryManager: row.deliveryManager,
    projectManager: row.projectManager,
    description: row.description ?? '',
    createdAt: toIsoDate(row.createdAt),
    startDate: toIsoDate(row.startDate),
    endDate: row.endDate ? toIsoDate(row.endDate) : undefined,
    monthlyBudget: toNumber(row.monthlyBudget),
    lastMonthRecharge: toNumber(row.lastMonthRecharge),
    thisMonthRecharge: toNumber(row.thisMonthRecharge),
    lastMonthConsumption: toNumber(row.lastMonthConsumption),
    thisMonthConsumption: toNumber(row.thisMonthConsumption),
    totalConsumption: row.totalConsumption,
    balance: toNumber(row.balance),
  }
}

export function mapContractRow(row: {
  id: string
  contractNo: string | null
  projectId: string | null
  customerId: string | null
  tenantId: string | null
  type: string
  status: string
  startDate: string
  endDate: string
  totalAmount: string | number
  paidAmount: string | number
  signedAt: Date | null
  signerName: string | null
  terms: string | null
  createdAt: Date
  projectName?: string
  customerName?: string
}): Contract {
  return {
    id: row.id,
    contractNo: row.contractNo ?? '',
    projectId: row.projectId ?? '',
    projectName: row.projectName ?? '',
    customerId: row.customerId ?? '',
    customerName: row.customerName ?? '',
    tenantId: row.tenantId ?? '',
    type: row.type as Contract['type'],
    status: row.status as Contract['status'],
    startDate: row.startDate,
    endDate: row.endDate,
    totalAmount: toNumber(row.totalAmount),
    paidAmount: toNumber(row.paidAmount),
    signedAt: row.signedAt ? toIsoDateTime(row.signedAt) : undefined,
    signerName: row.signerName ?? undefined,
    terms: row.terms ?? '',
    createdAt: toIsoDateTime(row.createdAt),
  }
}

export function mapRechargeRow(row: {
  id: string
  tenantId: string
  projectId: string | null
  amount: string | number
  paymentMethod: string
  status: string
  transactionId: string | null
  createdAt: Date
  completedAt: Date | null
}): Recharge {
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId ?? undefined,
    amount: toNumber(row.amount),
    paymentMethod: row.paymentMethod as Recharge['paymentMethod'],
    status: row.status as Recharge['status'],
    transactionId: row.transactionId ?? '',
    createdAt: toIsoDateTime(row.createdAt),
    completedAt: row.completedAt ? toIsoDateTime(row.completedAt) : undefined,
  }
}

export function mapConsumptionRow(row: {
  id: string
  tenantId: string | null
  projectId: string | null
  productLine: string
  resourceName: string | null
  amount: string | number
  duration: string | number | null
  unit: string | null
  occurredAt: Date
}): Consumption {
  return {
    id: row.id,
    tenantId: row.tenantId ?? '',
    projectId: row.projectId ?? '',
    productLine: row.productLine as Consumption['productLine'],
    resourceName: row.resourceName ?? '',
    amount: toNumber(row.amount),
    duration: toNumber(row.duration),
    unit: (row.unit as Consumption['unit']) ?? 'hour',
    createdAt: toIsoDateTime(row.occurredAt),
  }
}

export function mapCouponRow(row: {
  id: string
  tenantId: string
  projectId: string | null
  code: string | null
  name: string
  type: string
  value: string | number
  minAmount: string | number | null
  status: string
  issuedAt: Date
  expiredAt: Date
  usedAt: Date | null
}): Coupon {
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId ?? undefined,
    code: row.code ?? '',
    name: row.name,
    type: row.type as Coupon['type'],
    value: toNumber(row.value),
    minAmount: toNumber(row.minAmount),
    status: row.status as Coupon['status'],
    issuedAt: toIsoDateTime(row.issuedAt),
    expiredAt: toIsoDateTime(row.expiredAt),
    usedAt: row.usedAt ? toIsoDateTime(row.usedAt) : undefined,
  }
}

export function mapTaskRow(row: {
  id: string
  tenantId: string
  projectId: string | null
  title: string
  description: string | null
  status: string
  resourceType: string | null
  gpuCount: number | null
  cpuCount: number | null
  memoryGb: number | null
  startTime: Date
  endTime: Date | null
  cost: string | number | null
}): Task {
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId ?? '',
    title: row.title,
    description: row.description ?? '',
    status: row.status as Task['status'],
    resourceType: (row.resourceType as Task['resourceType']) ?? 'cloud_vm',
    gpuCount: row.gpuCount ?? undefined,
    cpuCount: row.cpuCount ?? undefined,
    memoryGB: row.memoryGb ?? undefined,
    startTime: toIsoDateTime(row.startTime),
    endTime: row.endTime ? toIsoDateTime(row.endTime) : undefined,
    cost: toNumber(row.cost),
  }
}

export function mapOrderRow(
  row: {
    id: string
    orderNo: string | null
    tenantId: string | null
    projectId: string | null
    productLine: string | null
    status: string
    amount: string | number
    createdAt: Date
    completedAt: Date | null
  },
  items: OrderItem[],
): Order {
  return {
    id: row.id,
    orderNo: row.orderNo ?? '',
    tenantId: row.tenantId ?? '',
    projectId: row.projectId ?? '',
    productLine: row.productLine ?? '',
    status: row.status as Order['status'],
    amount: toNumber(row.amount),
    items,
    createdAt: toIsoDateTime(row.createdAt),
    completedAt: row.completedAt ? toIsoDateTime(row.completedAt) : undefined,
  }
}

export function mapBillRow(
  row: {
    id: string
    tenantId: string | null
    projectId: string | null
    billMonth: string
    totalAmount: string | number
    status: string
    dueDate: string
    paidAt: Date | null
    projectName?: string
  },
  details: BillDetail[],
): Bill {
  return {
    id: row.id,
    tenantId: row.tenantId ?? '',
    projectId: row.projectId ?? '',
    projectName: row.projectName ?? '',
    month: row.billMonth,
    totalAmount: toNumber(row.totalAmount),
    status: row.status as Bill['status'],
    details,
    dueDate: row.dueDate,
    paidAt: row.paidAt ? toIsoDateTime(row.paidAt) : undefined,
  }
}

export function mapActivityRow(row: {
  id: string
  projectId: string
  type: string
  title: string
  description: string | null
  authorName: string | null
  authorRole: string | null
  metadata: unknown
  createdAt: Date
}): Activity {
  return {
    id: row.id,
    projectId: row.projectId,
    type: row.type as Activity['type'],
    title: row.title,
    description: row.description ?? '',
    author: row.authorName ?? '',
    authorRole: (row.authorRole as Activity['authorRole']) ?? 'system',
    metadata: (row.metadata as Record<string, unknown>) ?? undefined,
    createdAt: toIsoDateTime(row.createdAt),
  }
}
