'use client'

import type { EntityContact } from '@/lib/types/entity-contact'
import { Badge } from '@workspace/ui/components/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { IconLoader2 } from '@tabler/icons-react'

export function EntityContactsList({
  contacts,
  isLoading,
  emptyMessage = '暂无联系人',
}: {
  contacts: EntityContact[]
  isLoading?: boolean
  emptyMessage?: string
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <IconLoader2 className="size-5 animate-spin" />
      </div>
    )
  }

  if (contacts.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <div className="rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground">姓名</TableHead>
            <TableHead className="text-muted-foreground">职务</TableHead>
            <TableHead className="text-muted-foreground">手机</TableHead>
            <TableHead className="text-muted-foreground">邮箱</TableHead>
            <TableHead className="text-muted-foreground">微信</TableHead>
            <TableHead className="text-muted-foreground">主联系人</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => (
            <TableRow key={contact.id} className="border-border">
              <TableCell className="font-medium text-foreground">{contact.name}</TableCell>
              <TableCell className="text-foreground">{contact.title || '—'}</TableCell>
              <TableCell className="text-foreground">{contact.phone || '—'}</TableCell>
              <TableCell className="break-all text-foreground">{contact.email || '—'}</TableCell>
              <TableCell className="text-foreground">{contact.wechatId || '—'}</TableCell>
              <TableCell>
                {contact.isPrimary ? (
                  <Badge variant="secondary" className="text-xs">
                    主联系人
                  </Badge>
                ) : (
                  '—'
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
