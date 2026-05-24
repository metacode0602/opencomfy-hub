import type { DataCenter } from '@/lib/data/types'
import type { DatacenterScale } from '@/lib/types/datacenter-create'

export type UpdateDatacenterInput = {
  dataCenterId: string
  name: string
  address?: string
  description?: string
  location?: string
  containerInstanceRegion?: string
  bareMetalRegion?: string
  scale?: DatacenterScale
  publicIpCount?: number
  internalNetworkCidr?: string
  networkFee?: number
  managementNodeFee?: number
  externalOnboardingId?: string
}

export type UpdateDatacenterStatusInput = {
  dataCenterId: string
  status: 'online' | 'offline'
}

export type UpdateDatacenterResult = {
  dataCenter: DataCenter
}
