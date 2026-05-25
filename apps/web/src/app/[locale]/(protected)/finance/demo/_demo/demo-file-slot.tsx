"use client"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { IconCheck, IconFile, IconUpload } from "@tabler/icons-react"
import type { DemoUploadSlot } from "./demo-period-store"

export function DemoFileSlot({
  title,
  hint,
  slot,
  onSimulateUpload,
  readOnly,
}: {
  title: string
  hint: string
  slot: DemoUploadSlot
  onSimulateUpload?: () => void
  readOnly?: boolean
}) {
  const done = slot.status === "done"

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-colors",
        done ? "border-green-500/30 bg-green-500/5" : "border-dashed",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{hint}</p>
          {done && (
            <p className="flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400">
              <IconCheck className="size-4" />
              {slot.fileName} · {slot.rowCount} 行
            </p>
          )}
        </div>
        {!readOnly && (
          <Button
            type="button"
            variant={done ? "outline" : "default"}
            size="sm"
            onClick={onSimulateUpload}
          >
            {done ? (
              <>
                <IconFile className="mr-1.5 size-4" />
                重新模拟上传
              </>
            ) : (
              <>
                <IconUpload className="mr-1.5 size-4" />
                模拟上传
              </>
            )}
          </Button>
        )}
        {readOnly && (
          <span className="text-xs text-muted-foreground">
            {done ? "已在收入页上传" : "请先在收入页上传"}
          </span>
        )}
      </div>
    </div>
  )
}
