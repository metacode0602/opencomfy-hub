"use client"

import * as React from "react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { trpc } from "@/lib/trpc/client"
import { toast } from "sonner"

export type StaffAuthLinkMode = "auto" | "existing" | "none"

export type StaffAuthLinkValues = {
  mode: StaffAuthLinkMode
  authUserId: string | null
}

export const staffAuthLinkEmptyValues: StaffAuthLinkValues = {
  mode: "auto",
  authUserId: null,
}

export function staffAuthInputFromValues(values: StaffAuthLinkValues) {
  if (values.mode === "none") {
    return {
      createLoginAccount: false,
      authUserId: undefined as string | undefined,
    }
  }
  if (values.mode === "existing" && values.authUserId) {
    return {
      createLoginAccount: false,
      authUserId: values.authUserId,
    }
  }
  return {
    createLoginAccount: true,
    authUserId: undefined as string | undefined,
  }
}

export function CrmStaffAuthLinkFields({
  mode,
  authUserId,
  onChange,
  linkedAuthUser,
  idPrefix = "staff-auth",
  allowUnlink = false,
  onUnlink,
}: {
  mode: StaffAuthLinkMode
  authUserId: string | null
  onChange: (patch: Partial<StaffAuthLinkValues>) => void
  linkedAuthUser?: {
    id: string
    name: string
    email: string
    phone_number: string | null
    must_change_password: boolean
  } | null
  idPrefix?: string
  allowUnlink?: boolean
  onUnlink?: () => void
}) {
  const [query, setQuery] = React.useState("")
  const [debouncedQuery, setDebouncedQuery] = React.useState("")

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [query])

  const { data: candidates = [], isFetching } = trpc.crm.staff.searchLinkableAuthUsers.useQuery(
    { query: debouncedQuery, limit: 10 },
    { enabled: mode === "existing" && debouncedQuery.length >= 2 },
  )

  const selectedCandidate = candidates.find((item) => item.id === authUserId)

  return (
    <div className="grid gap-4 rounded-md border p-4">
      <div>
        <Label>登录账号</Label>
        <p className="text-muted-foreground mt-1 text-xs">
          新建员工时可自动创建登录账号（使用环境变量中的默认密码）；也可关联已有未绑定账号。
        </p>
      </div>

      {linkedAuthUser && (
        <div className="rounded-md bg-muted/50 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{linkedAuthUser.name}</span>
            <Badge variant="outline">{linkedAuthUser.email}</Badge>
            {linkedAuthUser.must_change_password && (
              <Badge variant="secondary">待首次改密</Badge>
            )}
          </div>
          {linkedAuthUser.phone_number && (
            <p className="text-muted-foreground mt-1 text-xs">{linkedAuthUser.phone_number}</p>
          )}
          {allowUnlink && onUnlink && (
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onUnlink}>
              解除关联
            </Button>
          )}
        </div>
      )}

      {!linkedAuthUser && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              id={`${idPrefix}-mode-auto`}
              checked={mode === "auto"}
              onCheckedChange={(checked) => {
                if (checked === true) onChange({ mode: "auto", authUserId: null })
              }}
            />
            自动创建登录账号
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              id={`${idPrefix}-mode-existing`}
              checked={mode === "existing"}
              onCheckedChange={(checked) => {
                if (checked === true) onChange({ mode: "existing" })
              }}
            />
            关联已有登录账号
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              id={`${idPrefix}-mode-none`}
              checked={mode === "none"}
              onCheckedChange={(checked) => {
                if (checked === true) onChange({ mode: "none", authUserId: null })
              }}
            />
            暂不创建/关联
          </label>
        </div>
      )}

      {!linkedAuthUser && mode === "existing" && (
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-search`}>搜索账号</Label>
          <Input
            id={`${idPrefix}-search`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入邮箱、手机号或姓名"
          />
          {debouncedQuery.length >= 2 && (
            <div className="rounded-md border">
              {isFetching ? (
                <p className="text-muted-foreground p-3 text-sm">搜索中…</p>
              ) : candidates.length === 0 ? (
                <p className="text-muted-foreground p-3 text-sm">未找到可关联账号</p>
              ) : (
                candidates.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="hover:bg-muted/50 flex w-full items-start justify-between gap-3 border-b px-3 py-2 text-left last:border-b-0"
                    onClick={() => onChange({ authUserId: item.id })}
                  >
                    <div>
                      <div className="text-sm font-medium">{item.name}</div>
                      <div className="text-muted-foreground text-xs">{item.email}</div>
                    </div>
                    {authUserId === item.id && <Badge>已选</Badge>}
                  </button>
                ))
              )}
            </div>
          )}
          {selectedCandidate && (
            <p className="text-muted-foreground text-xs">
              已选择：{selectedCandidate.name}（{selectedCandidate.email}）
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export function validateStaffAuthLink(values: StaffAuthLinkValues): string | null {
  if (values.mode === "existing" && !values.authUserId) {
    return "请选择要关联的登录账号"
  }
  return null
}

export function CrmStaffAuthLinkPanel({
  staffId,
  linkedAuthUser,
  onUpdated,
}: {
  staffId: string
  linkedAuthUser?: {
    id: string
    name: string
    email: string
    phone_number: string | null
    must_change_password: boolean
  } | null
  onUpdated?: () => void
}) {
  const utils = trpc.useUtils()
  const [values, setValues] = React.useState<StaffAuthLinkValues>(staffAuthLinkEmptyValues)

  const linkMutation = trpc.crm.staff.linkAuthUser.useMutation({
    onSuccess: async () => {
      toast.success("已关联登录账号")
      await utils.crm.staff.getById.invalidate({ id: staffId })
      onUpdated?.()
      setValues(staffAuthLinkEmptyValues)
    },
    onError: (e) => toast.error(e.message),
  })

  const unlinkMutation = trpc.crm.staff.unlinkAuthUser.useMutation({
    onSuccess: async () => {
      toast.success("已解除关联")
      await utils.crm.staff.getById.invalidate({ id: staffId })
      onUpdated?.()
    },
    onError: (e) => toast.error(e.message),
  })

  const handleLink = () => {
    const err = validateStaffAuthLink(values)
    if (err) {
      toast.error(err)
      return
    }
    if (values.mode === "existing" && values.authUserId) {
      linkMutation.mutate({ staffId, authUserId: values.authUserId })
    }
  }

  return (
    <div className="space-y-3">
      <CrmStaffAuthLinkFields
        mode={linkedAuthUser ? "none" : values.mode}
        authUserId={values.authUserId}
        onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
        linkedAuthUser={linkedAuthUser}
        allowUnlink={Boolean(linkedAuthUser)}
        onUnlink={() => unlinkMutation.mutate({ staffId })}
        idPrefix={`staff-detail-auth-${staffId}`}
      />
      {!linkedAuthUser && values.mode === "existing" && (
        <Button
          type="button"
          size="sm"
          disabled={linkMutation.isPending}
          onClick={handleLink}
        >
          确认关联
        </Button>
      )}
    </div>
  )
}
