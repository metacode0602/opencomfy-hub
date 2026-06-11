import {
  emptyExpectedScale,
  isExpectedScaleEmpty,
  type Customer,
  type CustomerExpectedScale,
} from '@/lib/data/types'
import type { UserStaff } from '@/lib/types/crm'
import type { CustomerFormValues } from './customer-form-fields'

/** 兼容旧版 cardTypeIds 结构 */
function normalizeExpectedScale(
  raw: Customer['expectedScale'],
): CustomerExpectedScale {
  if (!raw) return { ...emptyExpectedScale }
  if ('cards' in raw && Array.isArray(raw.cards)) {
    return {
      cards: raw.cards,
      storage: raw.storage ?? emptyExpectedScale.storage,
      productLines: raw.productLines ?? emptyExpectedScale.productLines,
    }
  }
  const legacy = raw as { cardTypeIds?: string[] }
  if (legacy.cardTypeIds?.length) {
    return {
      ...emptyExpectedScale,
      cards: legacy.cardTypeIds.map((id) => ({ cardTypeId: id, cardCount: 1 })),
    }
  }
  return { ...emptyExpectedScale }
}

function resolveCustomerNames(values: CustomerFormValues) {
  const trimmedName = values.name.trim()
  const trimmedShortName = values.shortName.trim()
  return {
    name: trimmedName || trimmedShortName,
    shortName: trimmedShortName,
  }
}

function getStaffDisplayName(staffId: string, staff: UserStaff[]): string | undefined {
  return staff.find((m) => m.id === staffId)?.display_name
}

export function customerToFormValues(customer: Customer): CustomerFormValues {
  return {
    type: customer.type,
    name: customer.name,
    shortName: customer.shortName ?? '',
    contactPerson: customer.contactPerson,
    contactPhone: customer.contactPhone,
    contactEmail: customer.contactEmail,
    industry: customer.industry,
    address: customer.address,
    certCode: customer.certCode ?? '',
    salesManagerId: customer.salesManagerId ?? '',
    expectedScale: normalizeExpectedScale(customer.expectedScale),
  }
}

export function formValuesToCustomer(
  values: CustomerFormValues,
  base: Pick<Customer, 'id'> & Partial<Customer>,
  staff: UserStaff[] = [],
): Customer {
  const managerName = values.salesManagerId
    ? getStaffDisplayName(values.salesManagerId, staff)
    : undefined
  const scale = values.expectedScale
  const cards = scale.cards.filter((c) => c.cardTypeId && c.cardCount > 0)

  const { name, shortName } = resolveCustomerNames(values)

  return {
    id: base.id,
    name,
    shortName: shortName || undefined,
    type: values.type,
    status: base.status ?? 'active',
    contactPerson: values.contactPerson.trim(),
    contactPhone: values.contactPhone.trim(),
    contactEmail: values.contactEmail.trim(),
    industry: values.industry,
    address: values.address.trim(),
    certCode: values.certCode.trim() || undefined,
    salesManagerId: values.salesManagerId || undefined,
    salesManagerName: managerName ?? base.salesManagerName,
    expectedScale: isExpectedScaleEmpty({ ...scale, cards })
      ? null
      : { ...scale, cards },
    createdAt: base.createdAt ?? new Date().toISOString().slice(0, 10),
    platformRegisteredAt: base.platformRegisteredAt,
    identityVerified: base.identityVerified ?? false,
    identityVerifiedAt: base.identityVerifiedAt,
    identityVerificationType: base.identityVerificationType,
    projectCount: base.projectCount ?? 0,
    totalRecharge: base.totalRecharge ?? 0,
    totalConsumption: base.totalConsumption ?? 0,
    balance: base.balance ?? 0,
  }
}

export function formValuesToCustomerInput(values: CustomerFormValues) {
  const scale = values.expectedScale
  const cards = scale.cards.filter((c) => c.cardTypeId && c.cardCount > 0)
  const { name, shortName } = resolveCustomerNames(values)

  return {
    name,
    shortName: shortName || undefined,
    type: values.type,
    contactPerson: values.contactPerson.trim(),
    contactPhone: values.contactPhone.trim(),
    contactEmail: values.contactEmail.trim(),
    industry: values.industry,
    address: values.address.trim(),
    certCode: values.certCode.trim() || undefined,
    salesManagerId: values.salesManagerId || undefined,
    expectedScale: isExpectedScaleEmpty({ ...scale, cards })
      ? null
      : { ...scale, cards },
  }
}

export function validateCustomerForm(values: CustomerFormValues): string | null {
  if (!values.name.trim() && !values.shortName.trim()) {
    return '客户名称与客户简称不能同时为空'
  }
  return null
}
