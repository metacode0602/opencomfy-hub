import type {
  InternalTestHoldDepartment,
  InternalTestHoldSettlement,
} from '@/lib/types/supplier-domain'

export type InternalTestHoldCardLineInput = {
  gpuCardTypeId: string
  unitCount: number
}

export type InternalTestHoldCreateInput = {
  supplierId: string
  dataCenterId: string
  workOrderNo: string
  userName: string
  department: InternalTestHoldDepartment
  settlementMode: InternalTestHoldSettlement
  holdFrom: string
  holdUntil?: string | null
  remark?: string | null
  cardLines: InternalTestHoldCardLineInput[]
  operatorStaffId?: string | null
}

export type InternalTestHoldCreateResult = {
  holdIds: string[]
  workOrderNo: string
  createdCount: number
}

export type InternalTestHoldListItem = {
  id: string
  supplierId: string
  supplierName: string
  supplierShortName: string | null
  dataCenterId: string
  dataCenterName: string
  workOrderNo: string
  userName: string
  department: InternalTestHoldDepartment
  settlementMode: InternalTestHoldSettlement
  gpuCardTypeId: string
  cardTypeCode: string
  cardTypeName: string
  unitCount: number
  holdFrom: Date
  holdUntil: Date | null
  remark: string | null
  deviceCount: number
  createdAt: Date
}

export type InternalTestHoldDetailDevice = {
  id: string
  deviceId: string
  sn: string
  internalIp: string | null
  externalIp: string | null
  port: string
  rootAccount: string
  rootPasswordMasked: string
}

export type InternalTestHoldDetail = InternalTestHoldListItem & {
  devices: InternalTestHoldDetailDevice[]
}

export type InternalTestHoldLinkDevicesInput = {
  holdId: string
  devices: Array<{
    internalIp?: string
    externalIp?: string
    port?: string
    rootAccount: string
    rootPassword: string
  }>
}

export type InternalTestHoldLinkDevicesResult = {
  linkedCount: number
}

export type InternalTestHoldEndResult = {
  holdId: string
  holdUntil: Date
}
