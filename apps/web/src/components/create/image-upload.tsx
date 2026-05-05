"use client"

import { useState, useCallback, useRef } from "react"
import { Upload, X, ImageIcon, RefreshCw } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

interface ImageUploadProps {
  value?: string
  onChange: (value: string | undefined) => void
  label?: string
  description?: string
  accept?: string
}

export function ImageUpload({
  value,
  onChange,
  label = "上传图片",
  description = "拖拽图片到此处，或点击上传",
  accept = "image/*",
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const replaceInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const file = e.dataTransfer.files[0]
      if (file && file.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onload = (event) => {
          onChange(event.target?.result as string)
        }
        reader.readAsDataURL(file)
      }
    },
    [onChange]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      const input = e.target
      if (file) {
        const reader = new FileReader()
        reader.onload = (event) => {
          onChange(event.target?.result as string)
          input.value = ""
        }
        reader.readAsDataURL(file)
      } else {
        input.value = ""
      }
    },
    [onChange]
  )

  const handleRemove = useCallback(() => {
    onChange(undefined)
  }, [onChange])

  if (value) {
    return (
      <div className="relative aspect-video rounded-xl overflow-hidden border border-border bg-secondary/50">
        <img
          src={value}
          alt="已选参考图"
          className="w-full h-full object-contain"
        />
        <input
          ref={replaceInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-end gap-2 p-2 bg-gradient-to-t from-black/60 to-transparent">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 gap-1.5 bg-background/90 hover:bg-background"
            onClick={() => replaceInputRef.current?.click()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            更换图片
          </Button>
        </div>
        <Button
          variant="destructive"
          size="icon"
          className="absolute top-2 right-2 h-8 w-8"
          onClick={handleRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "relative aspect-video rounded-xl border-2 border-dashed transition-colors cursor-pointer",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-secondary/50"
      )}
    >
      <input
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 pointer-events-none">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          {isDragging ? (
            <ImageIcon className="h-6 w-6 text-primary" />
          ) : (
            <Upload className="h-6 w-6 text-primary" />
          )}
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
          <p className="text-xs text-muted-foreground mt-2">支持点击选择图片或拖拽到此处</p>
        </div>
      </div>
    </div>
  )
}
