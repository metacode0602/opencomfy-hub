'use client'

import { useEffect, useMemo, useState } from 'react'

const DEFAULT_PAGE_SIZE = 10

export type UseListPaginationOptions = {
  pageSize?: number
  /** 筛选条件变化时重置到第 1 页 */
  resetDeps?: unknown[]
}

export function useListPagination<T>(
  items: T[],
  options?: UseListPaginationOptions,
) {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetDeps 由调用方按需传入
  }, options?.resetDeps)

  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(page, totalPages)

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, safePage, pageSize])

  return {
    page: safePage,
    pageSize,
    totalPages,
    totalItems,
    items: paginatedItems,
    setPage,
  }
}
