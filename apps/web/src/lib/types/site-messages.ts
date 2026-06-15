export type SiteMessageLink = {
  label: string
  href: string
  external?: boolean
}

export type SiteMessageListItem = {
  id: string
  title: string
  summary: string
  category: string | null
  read: boolean
  createdAt: string
}

export type SiteMessageDetail = SiteMessageListItem & {
  content: string
  links: SiteMessageLink[]
  readAt: string | null
}

export type SiteMessageListResult = {
  items: SiteMessageListItem[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type SiteMessageReadFilter = 'all' | 'unread' | 'read'
