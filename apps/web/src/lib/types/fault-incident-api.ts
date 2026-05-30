export type FaultIncidentListItem = {
  id: string
  supplierId: string
  supplierName: string
  supplierShortName: string | null
  title: string
  faultType: string
  deviceId: string | null
  deviceSn: string | null
  deviceAssetNo: string | null
  computeNodeId: string | null
  severity: string
  incidentStatus: string
  resolutionOutcome: string | null
  openedAt: Date
  closedAt: Date | null
}

export type FaultIncidentCreateInput = {
  supplierId: string
  title: string
  severity: string
  deviceId?: string | null
  computeNodeId?: string | null
  operatorStaffId?: string | null
  operatorName: string
}

export type FaultIncidentCreateResult = {
  id: string
}

export type FaultIncidentCloseInput = {
  incidentId: string
  resolution?: string | null
  operatorStaffId?: string | null
  operatorName: string
}

export type FaultIncidentCloseResult = {
  id: string
  closedAt: Date
}
