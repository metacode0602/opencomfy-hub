import { Suspense } from "react"
import { SettingsPageClient } from "./settings-page-client"

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">加载中…</div>}>
      <SettingsPageClient />
    </Suspense>
  )
}
