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
import type { GPUCardType } from '@/lib/data/types'
import { normalizeGpuCardComparable } from '@/lib/supplier/gpu-card-type-import-match'

export type CardTypeSelectProps = {
  id?: string
  label?: string
  value?: string
  cardTypes: readonly GPUCardType[]
  disabled?: boolean
  placeholder?: string
  emptyMessage?: string
  className?: string
  getOptionDisabled?: (cardType: GPUCardType) => boolean
  onChange: (value: string) => void
}

export const CARD_TYPE_SELECT_DROPDOWN_ATTR = 'data-card-type-select-dropdown'
const DROPDOWN_Z_INDEX = 200

/** 在 Dialog 内使用时，挂到 DialogContent 的 onPointerDownOutside / onInteractOutside */
export function preventCardTypeSelectOutsideDismiss(event: Event) {
  const target = event.target
  if (
    target instanceof Element &&
    target.closest(`[${CARD_TYPE_SELECT_DROPDOWN_ATTR}]`)
  ) {
    event.preventDefault()
  }
}

type DropdownPosition = {
  top: number
  left: number
  width: number
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

function cardTypeSearchText(cardType: GPUCardType): string {
  return [
    cardType.name,
    cardType.code,
    cardType.manufacturer,
    `${cardType.memoryGB}GB`,
    String(cardType.memoryGB),
  ]
    .filter(Boolean)
    .join(' ')
}

export function filterCardTypes(cardTypes: readonly GPUCardType[], query: string) {
  const q = query.trim()
  if (!q) return cardTypes

  const normalizedQuery = normalizeGpuCardComparable(q)

  return cardTypes.filter((cardType) => {
    const searchText = cardTypeSearchText(cardType)
    if (fuzzyIncludes(searchText, q)) return true

    const normalizedCode = cardType.code ? normalizeGpuCardComparable(cardType.code) : ''
    const normalizedName = normalizeGpuCardComparable(cardType.name)
    if (normalizedCode && normalizedCode.includes(normalizedQuery)) return true
    if (normalizedName.includes(normalizedQuery)) return true

    return false
  })
}

function CardTypeOptionLabel({
  cardType,
  className,
}: {
  cardType: GPUCardType
  className?: string
}) {
  const meta = [cardType.code, `${cardType.memoryGB}GB`, cardType.manufacturer]
    .filter(Boolean)
    .join(' · ')

  return (
    <span className={cn('inline-flex min-w-0 items-baseline gap-1.5', className)}>
      <span className="truncate">{cardType.name}</span>
      {meta ? <span className="text-muted-foreground shrink-0 text-xs">{meta}</span> : null}
    </span>
  )
}

function formatCardTypeDisplay(cardType: GPUCardType) {
  return cardType.name
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

    const update = () => {
      const anchor = anchorRef.current
      if (!anchor) return

      const rect = anchor.getBoundingClientRect()
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
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

export function CardTypeSelect({
  id,
  label,
  value = '',
  cardTypes,
  disabled,
  placeholder = '选择或搜索卡型',
  emptyMessage = '未找到匹配卡型',
  className,
  getOptionDisabled,
  onChange,
}: CardTypeSelectProps) {
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

  const selected = cardTypes.find((cardType) => cardType.id === value)
  const filteredCardTypes = React.useMemo(
    () => filterCardTypes(cardTypes, query),
    [cardTypes, query],
  )
  const inputValue = open ? query : selected ? formatCardTypeDisplay(selected) : ''

  const openDropdown = React.useCallback(
    (resetQuery: boolean) => {
      if (resetQuery) {
        setQuery(selected ? formatCardTypeDisplay(selected) : '')
      }
      setOpen(true)
    },
    [selected],
  )

  const closeDropdown = React.useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])

  const handleFocus = () => {
    openDropdown(!open)
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value
    setQuery(next)
    setOpen(true)
    if (!next.trim() && value) {
      onChange('')
    }
  }

  const handleSelect = (cardTypeId: string) => {
    onChange(cardTypeId)
    setQuery('')
    setOpen(false)
    if (id) document.getElementById(id)?.focus()
  }

  const dropdown =
    open && dropdownPosition && mounted
      ? createPortal(
          <div
            ref={dropdownRef}
            {...{ [CARD_TYPE_SELECT_DROPDOWN_ATTR]: '' }}
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
              zIndex: DROPDOWN_Z_INDEX,
            }}
            className="pointer-events-auto bg-popover text-popover-foreground fixed overflow-hidden rounded-lg shadow-md ring-1 ring-foreground/10"
            onMouseDown={(event) => event.preventDefault()}
          >
            <Command shouldFilter={false}>
              <CommandList>
                <CommandEmpty>{emptyMessage}</CommandEmpty>
                <CommandGroup>
                  {filteredCardTypes.map((cardType) => (
                    <CommandItem
                      key={cardType.id}
                      value={cardType.id}
                      disabled={getOptionDisabled?.(cardType)}
                      data-checked={value === cardType.id ? true : undefined}
                      onSelect={() => handleSelect(cardType.id)}
                      onPointerDown={(event) => {
                        if (getOptionDisabled?.(cardType)) return
                        event.preventDefault()
                        handleSelect(cardType.id)
                      }}
                    >
                      <CardTypeOptionLabel cardType={cardType} className="flex-1" />
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
            onFocus={handleFocus}
            onChange={handleInputChange}
          />
          <InputGroupAddon align="inline-end" className="gap-0.5">
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled}
              aria-label="展开卡型列表"
              className="text-muted-foreground flex size-6 items-center justify-center rounded-md disabled:opacity-50"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                if (open) {
                  closeDropdown()
                  return
                }
                openDropdown(true)
                if (id) document.getElementById(id)?.focus()
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
