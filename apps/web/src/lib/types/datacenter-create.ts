import type { DataCenter } from '@/lib/data/types'

export const DATACENTER_SCALE_OPTIONS = ['30台以内', '100台以内'] as const

export type DatacenterScale = (typeof DATACENTER_SCALE_OPTIONS)[number]

export type CreateDatacenterInput = {
  supplierId: string
  name: string
  code?: string
  address?: string
  description?: string
  location?: string
  containerInstanceRegion?: string
  bareMetalRegion?: string
  scale?: DatacenterScale
  publicIpCount?: number
  internalNetworkCidr?: string
  status?: DataCenter['status']
  networkFee?: number
  managementNodeFee?: number
  externalOnboardingId?: string
}

export type CreateDatacenterResult = {
  dataCenter: DataCenter
}
