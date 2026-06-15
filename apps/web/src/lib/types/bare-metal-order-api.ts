export type BareMetalOrderMark = 'online' | 'offline'
export type BareMetalOrderSource = 'platform_sync' | 'offline_excel'

export type BareMetalOrderListItemDto = {
  id: string
  orderNo: string | null
  platformOrderId: string | null
  orderMark: BareMetalOrderMark
  source: BareMetalOrderSource | string
  status: string
  payStatus: string
  tenantId: string
  tenantName: string | null
  platformTenantId: string
  projectId: string | null
  projectName: string | null
  dataCenterId: string | null
  dataCenterName: string | null
  idcName: string | null
  deviceCount: number
  gpuCount: number
  purchaseQtyText: string | null
  billingUnit: string
  finalAmount: string
  orderedAt: string
  rentStartsAt: string | null
  rentEndsAt: string | null
}

export type BareMetalOrderDeviceDto = {
  id: string
  lineNo: number
  allocationStatus: string
  deviceModelText: string | null
  gpuCardTypeId: string | null
  gpuCardTypeCode: string | null
  gpuCount: number
  durationHours: string | null
  unitPricePerCardHour: string | null
  lineAmount: string | null
  rentStartsAt: string | null
  rentEndsAt: string | null
  supplierDeviceId: string | null
  platformDeviceId: string | null
}

export type BareMetalOrderDetailDto = BareMetalOrderListItemDto & {
  orderAmount: string | null
  refundAmount: string
  balanceAmount: string
  couponAmount: string
  paidAt: string | null
  completedAt: string | null
  purchaseQty: number | null
  idcCode: string | null
  supplierId: string | null
  supplierName: string | null
  customerId: string | null
  customerName: string | null
  importBatchId: string | null
  matchFlags: Record<string, unknown>
  remark: string | null
  devices: BareMetalOrderDeviceDto[]
}

export type OfflineBareMetalOrderPreviewRowDto = {
  rowNo: number
  cardType: string
  gpuCardTypeId: string | null
  gpuCardTypeCode: string | null
  gpuCount: number
  rentStartsAt: string
  rentEndsAt: string
  durationHours: number
  unitPricePerCardHour: number
  lineAmount: number
  errors: string[]
  warnings: string[]
}

export type OfflineBareMetalOrderPreviewResult = {
  previewToken: string
  fileName: string
  projectId: string
  projectName: string
  tenantId: string
  tenantName: string
  headSummary: {
    deviceLineCount: number
    gpuCount: number
    finalAmount: number
    rentStartsAt: string | null
    rentEndsAt: string | null
    purchaseQtyText: string
  }
  rows: OfflineBareMetalOrderPreviewRowDto[]
  headerErrors: string[]
  selectable: boolean
}

export type OfflineBareMetalOrderImportResult = {
  importBatchId: string
  bareMetalOrderId: string
  orderNo: string
  deviceLineCount: number
  finalAmount: string
  errors: Array<{ rowNo: number; message: string }>
}
