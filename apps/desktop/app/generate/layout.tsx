import Link from "next/link"
import type { ReactNode } from "react"

export default function GenerateLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-background/80 px-4 py-3 backdrop-blur">
        <nav className="mx-auto flex max-w-3xl items-center gap-4 text-sm">
          <Link
            href="/index"
            className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            ← 返回首页
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-foreground">生成任务</span>
        </nav>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-6">{children}</div>
    </div>
  )
}
