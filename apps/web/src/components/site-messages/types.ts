export type SiteMessageLink = {
  label: string
  href: string
  /** 外部链接在新标签页打开；站内链接走 LocaleLink */
  external?: boolean
}

export type SiteMessage = {
  id: string
  title: string
  summary: string
  content: string
  createdAt: string
  read: boolean
  category?: string
  /** 消息底部独立操作链接，与正文内嵌链接分开渲染 */
  links?: SiteMessageLink[]
}
