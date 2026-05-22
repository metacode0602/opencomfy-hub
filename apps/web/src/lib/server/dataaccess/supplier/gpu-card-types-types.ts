export type GpuCardTypeUpsertInput = {
  code: string
  name: string
  manufacturer: 'NVIDIA' | 'AMD' | 'Intel' | 'Huawei' | 'Other'
  memoryGB: number
  tdpWatts?: number
  computeCapability?: string
}

export type GpuCardTypeUpdateInput = Omit<GpuCardTypeUpsertInput, 'code'>
