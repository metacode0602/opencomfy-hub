"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/command"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import { Label } from "@workspace/ui/components/label"
import { cn } from "@workspace/ui/lib/utils"
import { IconSelector, IconX } from "@tabler/icons-react"

export type StaffOption = {
  id: string
  display_name: string
  department?: string | null
}

export type StaffSelectProps = {
  id?: string
  label?: string
  value?: string
  defaultValue?: string
  staff: readonly StaffOption[]
  disabled?: boolean
  placeholder?: string
  clearLabel?: string
  allowEmpty?: boolean
  className?: string
  onChange: (value: string) => void
}

const NONE_VALUE = "__none__"
export const STAFF_SELECT_DROPDOWN_ATTR = "data-staff-select-dropdown"
const DROPDOWN_Z_INDEX = 200

type DropdownPosition = {
  top: number
  left: number
  width: number
}

function StaffOptionLabel({
  name,
  department,
  className,
}: {
  name: string
  department?: string | null
  className?: string
}) {
  const dept = department?.trim()
  if (!dept) {
    return <span className={className}>{name}</span>
  }

  return (
    <span className={cn("inline-flex min-w-0 items-baseline gap-1.5", className)}>
      <span className="truncate">{name}</span>
      <span className="text-muted-foreground shrink-0 text-xs">{dept}</span>
    </span>
  )
}

function formatStaffDisplay(member: StaffOption) {
  const dept = member.department?.trim()
  return dept ? `${member.display_name} · ${dept}` : member.display_name
}

function filterStaff(staff: readonly StaffOption[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return staff

  return staff.filter(
    (member) =>
      member.display_name.toLowerCase().includes(q) ||
      (member.department?.trim().toLowerCase().includes(q) ?? false),
  )
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
    window.addEventListener("resize", update)
    window.addEventListener("scroll", update, true)
    return () => {
      window.removeEventListener("resize", update)
      window.removeEventListener("scroll", update, true)
    }
  }, [anchorRef, open])

  return position
}

export function StaffSelect({
  id,
  label,
  value = "",
  defaultValue,
  staff,
  disabled,
  placeholder = "请选择或输入搜索",
  clearLabel = "不选择",
  allowEmpty = true,
  className,
  onChange,
}: StaffSelectProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const anchorRef = React.useRef<HTMLDivElement>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [mounted, setMounted] = React.useState(false)
  const defaultApplied = React.useRef(false)
  const dropdownPosition = useDropdownPosition(anchorRef, open)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (defaultApplied.current || !defaultValue || value) return
    defaultApplied.current = true
    onChange(defaultValue)
  }, [defaultValue, onChange, value])

  React.useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (containerRef.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setOpen(false)
      setQuery("")
    }

    document.addEventListener("pointerdown", handlePointerDown)
    return () => document.removeEventListener("pointerdown", handlePointerDown)
  }, [open])

  const selectedId = value || defaultValue || ""
  const selected = staff.find((member) => member.id === selectedId)
  const filteredStaff = React.useMemo(() => filterStaff(staff, query), [query, staff])
  const inputValue = open ? query : selected ? formatStaffDisplay(selected) : ""

  const openDropdown = React.useCallback(
    (resetQuery: boolean) => {
      if (resetQuery) {
        setQuery(selected ? formatStaffDisplay(selected) : "")
      }
      setOpen(true)
    },
    [selected],
  )

  const closeDropdown = React.useCallback(() => {
    setOpen(false)
    setQuery("")
  }, [])

  const handleClear = React.useCallback(() => {
    onChange("")
    setQuery("")
    setOpen(false)
    if (id) document.getElementById(id)?.focus()
  }, [id, onChange])

  const handleFocus = () => {
    openDropdown(!open)
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value
    setQuery(next)
    setOpen(true)
    if (!next.trim() && selectedId) {
      onChange("")
    }
  }

  const handleSelect = (staffId: string) => {
    onChange(staffId)
    setQuery("")
    setOpen(false)
    if (id) document.getElementById(id)?.focus()
  }

  const dropdown =
    open && dropdownPosition && mounted
      ? createPortal(
          <div
            ref={dropdownRef}
            {...{ [STAFF_SELECT_DROPDOWN_ATTR]: "" }}
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
              zIndex: DROPDOWN_Z_INDEX,
            }}
            className="bg-popover text-popover-foreground fixed overflow-hidden rounded-lg shadow-md ring-1 ring-foreground/10"
            onMouseDown={(event) => event.preventDefault()}
          >
            <Command shouldFilter={false}>
              <CommandList>
                <CommandEmpty>未找到匹配员工</CommandEmpty>
                <CommandGroup>
                  {allowEmpty ? (
                    <CommandItem
                      value={NONE_VALUE}
                      data-checked={!selectedId ? true : undefined}
                      onSelect={() => handleClear()}
                    >
                      <span className="text-muted-foreground">{clearLabel}</span>
                    </CommandItem>
                  ) : null}
                  {filteredStaff.map((member) => (
                    <CommandItem
                      key={member.id}
                      value={member.id}
                      data-checked={selectedId === member.id ? true : undefined}
                      onSelect={() => handleSelect(member.id)}
                    >
                      <StaffOptionLabel
                        name={member.display_name}
                        department={member.department}
                        className="flex-1"
                      />
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
    <div ref={containerRef} className={cn("space-y-2", className)}>
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
            {allowEmpty && selectedId ? (
              <InputGroupButton
                size="icon-xs"
                variant="ghost"
                disabled={disabled}
                aria-label={clearLabel}
                onMouseDown={(event) => event.preventDefault()}
                onClick={handleClear}
              >
                <IconX className="size-3.5" />
              </InputGroupButton>
            ) : null}
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled}
              aria-label="展开员工列表"
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
