"use client"

import { Badge } from "@workspace/ui/components/badge"

const LABELS: Record<string, string> = {
  active: "在职",
  inactive: "停用",
}

export function CrmStaffStatusBadge({ status }: { status: string }) {
  const label = LABELS[status] ?? status
  const variant = status === "active" ? "default" : "secondary"
  return <Badge variant={variant}>{label}</Badge>
}
