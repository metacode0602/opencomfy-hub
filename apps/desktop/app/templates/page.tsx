"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { TemplateDetailClient } from "@/app/templates/template-detail-client"

function TemplatesInner() {
  const router = useRouter()
  const sp = useSearchParams()
  const templateId = sp.get("templateId") ?? ""
  useEffect(() => {
    if (!templateId) router.replace("/index")
  }, [router, templateId])

  if (!templateId) return null
  return <TemplateDetailClient />
}

export default function TemplatesIndexPage() {
  return (
    <Suspense fallback={null}>
      <TemplatesInner />
    </Suspense>
  )
}
