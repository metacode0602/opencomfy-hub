export type GlobalSearchResultType =
  | 'customer'
  | 'project'
  | 'tenant'
  | 'supplier'
  | 'datacenter'

export type GlobalSearchResult = {
  id: string
  type: GlobalSearchResultType
  title: string
  subtitle?: string
  href: string
}

export const GLOBAL_SEARCH_TYPE_LABELS: Record<GlobalSearchResultType, string> = {
  customer: '客户',
  project: '项目',
  tenant: '租户',
  supplier: '供应商',
  datacenter: '机房',
}
