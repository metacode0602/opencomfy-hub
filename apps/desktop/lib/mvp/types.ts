export type TemplateOutputType = "image" | "video"

export type TemplateFieldType = "string" | "number" | "enum"

export type TemplateField = {
  key: string
  label: string
  type: TemplateFieldType
  required?: boolean
  description?: string
  placeholder?: string
  min?: number
  max?: number
  step?: number
  options?: { label: string; value: string }[]
}

export type TemplateDefinition = {
  id: string
  name: string
  description: string
  outputType: TemplateOutputType
  previewEmoji: string
  fields: TemplateField[]
  defaults: Record<string, string | number>
}

export type AssetType = "image" | "video"

export type Asset = {
  id: string
  type: AssetType
  url: string
  mime: string
  sizeBytes?: number
  width?: number
  height?: number
  durationSeconds?: number
  createdAt: number
}

export type GenerationJobStatus = "queued" | "running" | "succeeded" | "failed"

export type GenerationJob = {
  id: string
  templateId: string
  status: GenerationJobStatus
  progress?: number
  input: {
    params: Record<string, string | number>
    inputImageDataUrl?: string
  }
  output?: {
    assetId: string
  }
  errorMessage?: string
  createdAt: number
  updatedAt: number
}

export type Currency = "CNY"

export type Delivery = {
  id: string
  assetId: string
  price: number
  currency: Currency
  createdAt: number
  downloadCount: number
}
