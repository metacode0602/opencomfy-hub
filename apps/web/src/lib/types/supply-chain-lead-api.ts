import type {
  DatacenterDockingScope,
  SupplyChainLeadActivityType,
  SupplyChainLeadAuthorRole,
  SupplyChainLeadPriority,
  SupplyChainLeadStatus,
  SupplyChainLeadType,
} from '@/lib/supply-chain-leads/types'

export interface SupplyChainLeadContactDto {
  name: string
  title?: string | null
  phone?: string | null
  email?: string | null
  wechat?: string | null
}

export interface SupplyChainLeadGpuSnapshotDto {
  id: string
  cardType: string
  gpuCardTypeId?: string | null
  total: number
  idle: number
  reserved: number
  inUse: number
  unitPrice?: number | null
  availableTime?: string | null
  notes?: string | null
  updatedAt: string
}

export interface SupplyChainLeadListItemDto {
  id: string
  type: SupplyChainLeadType
  name: string
  code?: string | null
  status: SupplyChainLeadStatus
  priority: SupplyChainLeadPriority
  supplierName?: string | null
  location?: string | null
  province?: string | null
  city?: string | null
  description?: string | null
  source?: string | null
  ownerStaffName: string
  resourceContact: SupplyChainLeadContactDto
  businessContact?: SupplyChainLeadContactDto | null
  gpuResources: SupplyChainLeadGpuSnapshotDto[]
  dockingScope?: DatacenterDockingScope | null
  tags: string[]
  estimatedOnlineDate?: string | null
  convertedSupplierId?: string | null
  convertedDataCenterId?: string | null
  createdAt: string
  updatedAt: string
  lastActivityAt: string
}

export interface SupplyChainLeadActivityDto {
  id: string
  leadId: string
  type: SupplyChainLeadActivityType
  title: string
  description: string
  author: string
  authorRole: SupplyChainLeadAuthorRole
  authorStaffId?: string | null
  createdAt: string
  editedAt?: string | null
  metadata?: Record<string, string | string[]> | null
}

export interface SupplyChainLeadStatsDto {
  total: number
  active: number
  datacenters: number
  suppliers: number
  gpuTotal: number
  gpuIdle: number
}

export interface SupplyChainLeadCardTypeFilterOption {
  name: string
  leadCount: number
}
