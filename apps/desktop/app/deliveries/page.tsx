"use client"

import Link from "next/link"
import { useMemo } from "react"

import { useMvpStore } from "@/lib/mvp/store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

function formatTime(ts: number) {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(ts))
  } catch {
    return new Date(ts).toLocaleString()
  }
}

export default function DeliveriesListPage() {
  const deliveries = useMvpStore((s) => Object.values(s.deliveries))
  const assets = useMvpStore((s) => s.assets)

  const sorted = useMemo(() => {
    const all = [...deliveries]
    all.sort((a, b) => b.createdAt - a.createdAt)
    return all
  }, [deliveries])

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">已交付列表（MVP Mock）</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            共 <span className="font-medium">{sorted.length}</span> 条（数据来自 localStorage）
          </p>
        </div>
        <Button variant="secondary" asChild>
          <Link href="/index">返回首页</Link>
        </Button>
      </div>

      {sorted.length === 0 ? (
        <Card className="p-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">还没有交付记录。请先到模板详情页生成并创建交付。</p>
            <Button asChild>
              <Link href="/index">去首页</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {sorted.map((d) => {
            const asset = assets[d.assetId]
            const href = `/deliveries?deliveryId=${encodeURIComponent(d.id)}`

            return (
              <Card key={d.id} className="overflow-hidden">
                {asset ? (
                  asset.type === "image" ? (
                    <img
                      src={asset.url}
                      alt={d.id}
                      className="h-40 w-full border-b object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <video
                      className="h-40 w-full border-b object-cover"
                      src={asset.url}
                      controls={false}
                      muted
                      preload="metadata"
                    />
                  )
                ) : (
                  <div className="flex h-40 w-full items-center justify-center border-b bg-muted/30 text-sm text-muted-foreground">
                    找不到资源（assetId: {d.assetId}）
                  </div>
                )}

                <div className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="outline">{asset?.type === "video" ? "视频" : "图片"}</Badge>
                    <Badge variant="secondary">
                      价格：{d.price} {d.currency}
                    </Badge>
                    <Badge variant="outline">下载次数：{d.downloadCount ?? 0}</Badge>
                  </div>

                  <div className="space-y-1 text-sm">
                    <div className="text-muted-foreground">
                      deliveryId: <span className="font-mono text-foreground">{d.id}</span>
                    </div>
                    <div className="text-muted-foreground">创建时间：{formatTime(d.createdAt)}</div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild>
                      <Link href={href}>打开下载页</Link>
                    </Button>
                    <Button variant="secondary" asChild>
                      <Link href={href}>复制链接后可生成二维码</Link>
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

