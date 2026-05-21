export const PLATFORM_SUPPLIER_TYPES = ['Enterprise', 'Personal'] as const

export type PlatformSupplierType = (typeof PLATFORM_SUPPLIER_TYPES)[number]

export const PLATFORM_SUPPLIER_TYPE_LABEL: Record<PlatformSupplierType, string> = {
  Enterprise: '企业',
  Personal: '个人',
}

export function isPlatformSupplierType(value: string): value is PlatformSupplierType {
  return (PLATFORM_SUPPLIER_TYPES as readonly string[]).includes(value)
}
