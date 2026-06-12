export type SupplyChainLeadType = 'supplier' | 'datacenter'

/** 机房对接范围 */
export type DatacenterDockingScope =
  | 'spot_only'
  | 'bare_metal_only'
  | 'spot_and_bare_metal'
  | 'normal'

export type SupplyChainLeadStatus =
  | 'new'
  | 'contacting'
  | 'evaluating'
  | 'negotiating'
  | 'converted'
  | 'lost'

export type SupplyChainLeadPriority = 'high' | 'medium' | 'low'

export type SupplyChainLeadActivityType =
  | 'comment'
  | 'meeting'
  | 'stage_change'
  | 'resource_update'
  | 'site_visit'
  | 'file'

export type SupplyChainLeadAuthorRole =
  | 'supply'
  | 'business'
  | 'ops'
  | 'system'

export interface SupplyChainLeadContact {
  name: string
  title?: string
  phone?: string
  email?: string
  wechat?: string
}

export interface GpuResourceSnapshot {
  cardType: string
  total: number
  idle: number
  reserved: number
  inUse: number
  unitPrice?: number
  /** 可用时间，如「工作日 9:00-18:00」「7×24」 */
  availableTime?: string
  notes?: string
  updatedAt: string
}

export interface SupplyChainLead {
  id: string
  type: SupplyChainLeadType
  name: string
  code?: string
  status: SupplyChainLeadStatus
  priority: SupplyChainLeadPriority
  supplierName?: string
  location?: string
  province?: string
  city?: string
  description?: string
  source?: string
  ownerStaffName: string
  resourceContact: SupplyChainLeadContact
  businessContact?: SupplyChainLeadContact
  gpuResources: GpuResourceSnapshot[]
  /** 机房对接范围，仅 type=datacenter 时有效 */
  dockingScope?: DatacenterDockingScope
  tags: string[]
  estimatedOnlineDate?: string
  createdAt: string
  updatedAt: string
  lastActivityAt: string
}

export interface SupplyChainLeadActivity {
  id: string
  leadId: string
  type: SupplyChainLeadActivityType
  title: string
  description: string
  author: string
  authorRole: SupplyChainLeadAuthorRole
  createdAt: string
  editedAt?: string
  metadata?: Record<string, string | string[]>
}

export interface CreateSupplyChainLeadInput {
  type: SupplyChainLeadType
  name: string
  supplierName?: string
  location?: string
  province?: string
  city?: string
  description?: string
  source?: string
  priority: SupplyChainLeadPriority
  resourceContact: SupplyChainLeadContact
  businessContact?: SupplyChainLeadContact
  gpuResources?: Omit<GpuResourceSnapshot, 'updatedAt'>[]
  dockingScope?: DatacenterDockingScope
  tags?: string[]
  estimatedOnlineDate?: string
}
