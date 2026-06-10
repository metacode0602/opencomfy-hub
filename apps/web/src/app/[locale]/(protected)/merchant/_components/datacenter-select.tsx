'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@workspace/ui/components/command'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@workspace/ui/components/input-group'
import { Label } from '@workspace/ui/components/label'
import { cn } from '@workspace/ui/lib/utils'
import { IconSelector } from '@tabler/icons-react'
import type { MerchantPlatformDatacenter } from '@/lib/types/merchant'

export const DATACENTER_SELECT_DROPDOWN_ATTR = 'data-datacenter-select-dropdown'
const DROPDOWN_Z_INDEX = 200

export function preventDatacenterSelectOutsideDismiss(event: Event) {
  const target = event.target
  if (
    target instanceof Element &&
    target.closest(`[${DATACENTER_SELECT_DROPDOWN_ATTR}]`)
  ) {
    event.preventDefault()
  }
}

function fuzzyIncludes(text: string, query: string): boolean {
  const normalizedText = text.toLowerCase()
  const normalizedQuery = query.toLowerCase()
  if (normalizedText.includes(normalizedQuery)) return true

  let textIndex = 0
  for (const char of normalizedQuery) {
    const foundIndex = normalizedText.indexOf(char, textIndex)
    if (foundIndex === -1) return false
    textIndex = foundIndex + 1
  }
  return normalizedQuery.length > 0
}

function datacenterSearchText(dc: MerchantPlatformDatacenter): string {
  return [dc.name, dc.code, dc.location, dc.regionCode, dc.id].filter(Boolean).join(' ')
}

export function filterDatacenters(
  datacenters: readonly MerchantPlatformDatacenter[],
  query: string,
) {
  const q = query.trim()
  if (!q) return datacenters
  return datacenters.filter((dc) => fuzzyIncludes(datacenterSearchText(dc), q))
}

type DropdownPosition = {
  top: number
  left: number
  width: number
  maxHeight: number
}

const DROPDOWN_VIEWPORT_PADDING = 8
const DROPDOWN_MIN_HEIGHT = 120

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

    const update = () => {
      const anchor = anchorRef.current
      if (!anchor) return
      const rect = anchor.getBoundingClientRect()
      const availableBelow =
        window.innerHeight - rect.bottom - DROPDOWN_VIEWPORT_PADDING
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.max(DROPDOWN_MIN_HEIGHT, availableBelow),
      })
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [anchorRef, open])

  return position
}

const statusLabel: Record<MerchantPlatformDatacenter['status'], string> = {
  online: '在线',
  offline: '离线',
  maintenance: '维护',
}

const statusBadgeClass: Record<MerchantPlatformDatacenter['status'], string> = {
  online: 'border-green-500/40 text-green-700 dark:text-green-300',
  offline: 'border-muted-foreground/40 text-muted-foreground',
  maintenance: 'border-amber-500/40 text-amber-700 dark:text-amber-300',
}

export type DatacenterSelectProps = {
  id?: string
  label?: string
  value?: string
  datacenters: readonly MerchantPlatformDatacenter[]
  disabled?: boolean
  placeholder?: string
  emptyMessage?: string
  className?: string
  onChange: (value: string) => void
}

export function DatacenterSelect({
  id,
  label,
  value = '',
  datacenters,
  disabled,
  placeholder = '选择或搜索机房',
  emptyMessage = '未找到匹配机房',
  className,
  onChange,
}: DatacenterSelectProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const anchorRef = React.useRef<HTMLDivElement>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [mounted, setMounted] = React.useState(false)
  const dropdownPosition = useDropdownPosition(anchorRef, open)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (containerRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setOpen(false)
      setQuery('')
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const selected = datacenters.find((dc) => dc.id === value)
  const filtered = React.useMemo(
    () => filterDatacenters(datacenters, query),
    [datacenters, query],
  )
  const inputValue = open ? query : selected ? selected.name : ''

  const closeDropdown = () => {
    setOpen(false)
    setQuery('')
  }

  const handleSelect = (dcId: string) => {
    onChange(dcId)
    setQuery('')
    setOpen(false)
  }

  const dropdown =
    open && dropdownPosition && mounted
      ? createPortal(
          <div
            ref={dropdownRef}
            {...{ [DATACENTER_SELECT_DROPDOWN_ATTR]: '' }}
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
              maxHeight: dropdownPosition.maxHeight,
              zIndex: DROPDOWN_Z_INDEX,
            }}
            className="pointer-events-auto bg-popover text-popover-foreground fixed flex flex-col overflow-hidden rounded-lg shadow-md ring-1 ring-foreground/10"
            onMouseDown={(event) => event.preventDefault()}
            onWheel={(event) => event.stopPropagation()}
          >
            <Command shouldFilter={false} className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <CommandList className="max-h-full min-h-0 overflow-y-auto overscroll-contain">
                <CommandEmpty>{emptyMessage}</CommandEmpty>
                <CommandGroup className="overflow-visible">
                  {filtered.map((dc) => (
                    <CommandItem
                      key={dc.id}
                      value={dc.id}
                      data-checked={value === dc.id ? true : undefined}
                      onSelect={() => handleSelect(dc.id)}
                      onPointerDown={(event) => {
                        event.preventDefault()
                        handleSelect(dc.id)
                      }}
                      className={cn(dc.status === 'offline' && 'opacity-90')}
                    >
                      <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="truncate font-medium">{dc.name}</span>
                          <span className="text-muted-foreground truncate text-xs">
                            {dc.code} · {dc.location} · {dc.regionCode}
                          </span>
                        </div>
                        <span
                          className={cn(
                            'shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium',
                            statusBadgeClass[dc.status],
                          )}
                        >
                          {statusLabel[dc.status]}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>,
          document.body,
        )
      : null

  return (
    <div ref={containerRef} className={cn('space-y-2', className)}>
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <div ref={anchorRef}>
        <InputGroup className="w-full">
          <InputGroupInput
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            autoComplete="off"
            disabled={disabled}
            placeholder={placeholder}
            value={inputValue}
            onFocus={() => {
              setQuery(selected ? selected.name : '')
              setOpen(true)
            }}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
              if (!e.target.value.trim() && value) onChange('')
            }}
          />
          <InputGroupAddon align="inline-end">
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled}
              aria-label="展开机房列表"
              className="text-muted-foreground flex size-6 items-center justify-center rounded-md disabled:opacity-50"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (open) closeDropdown()
                else {
                  setQuery(selected ? selected.name : '')
                  setOpen(true)
                }
              }}
            >
              <IconSelector className="size-4" />
            </button>
          </InputGroupAddon>
        </InputGroup>
      </div>
      {dropdown}
    </div>
  )
}
