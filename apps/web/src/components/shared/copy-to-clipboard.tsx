'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@workspace/ui/components/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@workspace/ui/components/tooltip'
import { cn } from '@workspace/ui/lib/utils'
import { toast } from 'sonner'

interface CopyToClipboardProps {
  text: string
  className?: string
  successMessage?: string
  errorMessage?: string
  tooltip?: string
}

export function CopyToClipboard({
  text,
  className,
  successMessage = '已复制到剪贴板',
  errorMessage = '复制失败',
  tooltip = '复制',
}: CopyToClipboardProps) {
  const [copied, setCopied] = useState(false)

  if (!text.trim()) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success(successMessage)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(errorMessage)
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn('size-7 shrink-0', className)}
          aria-label={tooltip}
          onClick={() => void handleCopy()}
        >
          {copied ? (
            <Check className="size-3.5 text-emerald-600" />
          ) : (
            <Copy className="size-3.5 text-muted-foreground" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{copied ? '已复制' : tooltip}</TooltipContent>
    </Tooltip>
  )
}
