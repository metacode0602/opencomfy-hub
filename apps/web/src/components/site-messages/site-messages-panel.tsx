"use client"

import * as React from "react"
import { Bell, Loader2, MailOpen } from "lucide-react"

import { ListPagination } from "@/components/shared/list-pagination"
import { trpc } from "@/lib/trpc/client"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { ScrollArea } from "@workspace/ui/components/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"

import { SiteMessageBody } from "./site-message-body"

const PAGE_SIZE = 10

function formatMessageTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) return "刚刚"
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`
  if (diffHours < 24) return `${diffHours} 小时前`
  if (diffDays < 7) return `${diffDays} 天前`

  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

type SiteMessagesPanelProps = {
  buttonClassName?: string
}

export function SiteMessagesPanel({ buttonClassName }: SiteMessagesPanelProps) {
  const utils = trpc.useUtils()
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [detailOpen, setDetailOpen] = React.useState(false)
  const [selectedMessageId, setSelectedMessageId] = React.useState<string | null>(null)
  const [page, setPage] = React.useState(1)
  const listContainerRef = React.useRef<HTMLDivElement>(null)

  const { data: unreadData } = trpc.siteMessages.unreadCount.useQuery()
  const unreadCount = unreadData?.count ?? 0

  const {
    data: listData,
    isLoading: listLoading,
    isFetching: listFetching,
  } = trpc.siteMessages.list.useQuery(
    { page, pageSize: PAGE_SIZE, readFilter: "all" },
    { enabled: sheetOpen },
  )

  const { data: selectedMessage, isLoading: detailLoading } = trpc.siteMessages.getById.useQuery(
    { id: selectedMessageId ?? "" },
    { enabled: detailOpen && Boolean(selectedMessageId) },
  )

  const markReadMutation = trpc.siteMessages.markRead.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.siteMessages.list.invalidate(),
        utils.siteMessages.unreadCount.invalidate(),
        selectedMessageId
          ? utils.siteMessages.getById.invalidate({ id: selectedMessageId })
          : Promise.resolve(),
      ])
    },
  })

  const markAllReadMutation = trpc.siteMessages.markAllRead.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.siteMessages.list.invalidate(),
        utils.siteMessages.unreadCount.invalidate(),
      ])
    },
  })

  const handleSelectMessage = (messageId: string) => {
    setSelectedMessageId(messageId)
    setDetailOpen(true)
    markReadMutation.mutate({ id: messageId })
  }

  const handleMarkAllRead = () => {
    markAllReadMutation.mutate()
  }

  const closeOverlays = () => {
    setDetailOpen(false)
    setSheetOpen(false)
    setSelectedMessageId(null)
  }

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage)
  }

  React.useEffect(() => {
    if (!sheetOpen) return
    const viewport = listContainerRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]',
    )
    viewport?.scrollTo({ top: 0 })
  }, [page, sheetOpen])

  const messages = listData?.items ?? []
  const totalItems = listData?.total ?? 0
  const totalPages = listData?.totalPages ?? 0

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={cn("relative shrink-0", buttonClassName)}
        aria-label="站内信"
        onClick={() => setSheetOpen(true)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <Badge className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center px-1 text-xs">
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        ) : null}
      </Button>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b px-4 py-4">
            <div className="flex items-start justify-between gap-3 pr-8">
              <div className="space-y-1">
                <SheetTitle>站内信</SheetTitle>
                <SheetDescription>
                  {unreadCount > 0 ? `${unreadCount} 条未读消息` : "暂无未读消息"}
                </SheetDescription>
              </div>
              {unreadCount > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0 px-2 text-xs"
                  onClick={handleMarkAllRead}
                  disabled={markAllReadMutation.isPending}
                >
                  {markAllReadMutation.isPending ? (
                    <Loader2 className="mr-1 size-3.5 animate-spin" />
                  ) : (
                    <MailOpen className="mr-1 size-3.5" />
                  )}
                  全部已读
                </Button>
              ) : null}
            </div>
          </SheetHeader>

          <div ref={listContainerRef} className="min-h-0 flex-1">
            <ScrollArea className="h-full">
            {listLoading ? (
              <div className="space-y-0 divide-y">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="space-y-2 px-4 py-4">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                <Bell className="mb-3 size-8 text-muted-foreground/40" />
                <p className="text-sm font-medium">暂无消息</p>
                <p className="mt-1 text-xs text-muted-foreground">新的通知会显示在这里</p>
              </div>
            ) : (
              <div className={cn("divide-y", listFetching && !listLoading && "opacity-70")}>
                {messages.map((message) => (
                  <button
                    key={message.id}
                    type="button"
                    className={cn(
                      "flex w-full flex-col gap-1 px-4 py-4 text-left transition-colors hover:bg-muted/50",
                      !message.read && "bg-primary/5",
                    )}
                    onClick={() => handleSelectMessage(message.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          {!message.read ? (
                            <span className="size-2 shrink-0 rounded-full bg-primary" />
                          ) : null}
                          <p
                            className={cn(
                              "truncate text-sm",
                              !message.read ? "font-medium text-foreground" : "text-foreground/90",
                            )}
                          >
                            {message.title}
                          </p>
                        </div>
                        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {message.summary}
                        </p>
                      </div>
                      {message.category ? (
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          {message.category}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {formatMessageTime(message.createdAt)}
                    </p>
                  </button>
                ))}
              </div>
            )}
            </ScrollArea>
          </div>

          <ListPagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={PAGE_SIZE}
            onPageChange={handlePageChange}
          />
        </SheetContent>
      </Sheet>

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) setSelectedMessageId(null)
        }}
      >
        <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          {detailLoading ? (
            <div className="space-y-4 px-6 py-6">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : selectedMessage ? (
            <>
              <DialogHeader className="space-y-3 border-b px-6 py-4 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  {selectedMessage.category ? (
                    <Badge variant="secondary">{selectedMessage.category}</Badge>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    {formatMessageTime(selectedMessage.createdAt)}
                  </span>
                </div>
                <DialogTitle className="text-base leading-snug">
                  {selectedMessage.title}
                </DialogTitle>
                <DialogDescription className="text-sm leading-relaxed">
                  {selectedMessage.summary}
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="min-h-0 flex-1">
                <div className="px-6 py-4">
                  <SiteMessageBody
                    content={selectedMessage.content}
                    links={selectedMessage.links}
                    onInternalNavigate={closeOverlays}
                  />
                </div>
              </ScrollArea>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
