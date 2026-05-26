'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { Search } from 'lucide-react'
import { Badge } from '@workspace/ui/components/badge'
import { Input } from '@workspace/ui/components/input'
import { cn } from '@workspace/ui/lib/utils'
import { trpc } from '@/lib/trpc/client'
import { useLocaleRouter } from '@/lib/i18n/navigation'
import {
  GLOBAL_SEARCH_TYPE_LABELS,
  type GlobalSearchResult,
  type GlobalSearchResultType,
} from '@/lib/types/global-search'

const DROPDOWN_ATTR = 'data-site-header-search-dropdown'
const DROPDOWN_Z_INDEX = 200
const MIN_QUERY_LENGTH = 1

type DropdownPosition = {
  top: number
  left: number
  width: number
}

const GROUP_ORDER: GlobalSearchResultType[] = [
  'customer',
  'project',
  'tenant',
  'supplier',
  'datacenter',
]

function groupResults(results: GlobalSearchResult[]) {
  const groups = new Map<GlobalSearchResultType, GlobalSearchResult[]>()
  for (const result of results) {
    const list = groups.get(result.type) ?? []
    list.push(result)
    groups.set(result.type, list)
  }
  return GROUP_ORDER.filter((type) => groups.has(type)).map((type) => ({
    type,
    items: groups.get(type)!,
  }))
}

function useDropdownPosition(
  anchorRef: React.RefObject<HTMLElement | null>,
  open: boolean,
) {
  const [position, setPosition] = React.useState<DropdownPosition | null>(null)

  React.useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setPosition(null)
      return
    }

    const updatePosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (!rect) return
      setPosition({
        top: rect.bottom + 6,
        left: rect.left,
        width: Math.max(rect.width, 320),
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [anchorRef, open])

  return position
}

export function SiteHeaderSearch() {
  const router = useLocaleRouter()
  const anchorRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [query, setQuery] = React.useState('')
  const [debouncedQuery, setDebouncedQuery] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  const enabled = debouncedQuery.length >= MIN_QUERY_LENGTH
  const { data: results = [], isFetching } = trpc.dashboard.globalSearch.useQuery(
    { query: debouncedQuery },
    { enabled },
  )

  const groupedResults = React.useMemo(() => groupResults(results), [results])
  const groupedResultsWithOffset = React.useMemo(() => {
    let offset = 0
    return groupedResults.map((group) => {
      const startIndex = offset
      offset += group.items.length
      return { ...group, startIndex }
    })
  }, [groupedResults])
  const flatResults = React.useMemo(
    () => groupedResults.flatMap((group) => group.items),
    [groupedResults],
  )

  React.useEffect(() => {
    setActiveIndex(0)
  }, [debouncedQuery, results.length])

  const position = useDropdownPosition(anchorRef, open && enabled)

  const navigateTo = React.useCallback(
    (href: string) => {
      setOpen(false)
      setQuery('')
      setDebouncedQuery('')
      router.push(href)
    },
    [router],
  )

  React.useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (anchorRef.current?.contains(target)) return
      if (target instanceof Element && target.closest(`[${DROPDOWN_ATTR}]`)) return
      setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }

    if (!open || flatResults.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % flatResults.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (index - 1 + flatResults.length) % flatResults.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const target = flatResults[activeIndex]
      if (target) navigateTo(target.href)
    }
  }

  const showDropdown = open && enabled && (isFetching || results.length > 0 || debouncedQuery.length > 0)

  return (
    <>
      <div ref={anchorRef} className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="search"
          value={query}
          placeholder="搜索名称、租户ID、客户、项目、租户、供应商、机房..."
          className="border-0 bg-muted/50 pl-10 focus-visible:ring-1"
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
      </div>

      {showDropdown && position
        ? createPortal(
            <div
              {...{ [DROPDOWN_ATTR]: '' }}
              className="rounded-xl border bg-popover text-popover-foreground shadow-md"
              style={{
                position: 'fixed',
                top: position.top,
                left: position.left,
                width: position.width,
                zIndex: DROPDOWN_Z_INDEX,
              }}
            >
              <div className="max-h-80 overflow-y-auto p-1">
                {isFetching ? (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">搜索中...</div>
                ) : flatResults.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    未找到匹配结果
                  </div>
                ) : (
                  groupedResultsWithOffset.map((group) => (
                      <div key={group.type} className="py-1">
                        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                          {GLOBAL_SEARCH_TYPE_LABELS[group.type]}
                        </div>
                        {group.items.map((item, itemIndex) => {
                          const flatIndex = group.startIndex + itemIndex
                          const isActive = flatIndex === activeIndex

                          return (
                            <button
                              key={`${item.type}-${item.id}`}
                              type="button"
                              className={cn(
                                'flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left text-sm outline-none transition-colors',
                                isActive ? 'bg-muted text-foreground' : 'hover:bg-muted/70',
                              )}
                              onMouseEnter={() => setActiveIndex(flatIndex)}
                              onClick={() => navigateTo(item.href)}
                            >
                              <Badge variant="secondary" className="mt-0.5 shrink-0">
                                {GLOBAL_SEARCH_TYPE_LABELS[item.type]}
                              </Badge>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">{item.title}</span>
                                {item.subtitle ? (
                                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                    {item.subtitle}
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    ))
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
