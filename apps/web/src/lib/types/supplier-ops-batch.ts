/** 供应链侧「设备上架 / 订单接入 / 故障事件」批量导入（mock） */

export type SupplierOpsBatchKind = "online-tasks" | "order-access" | "fault-incidents"

export type SupplierOpsInventoryRow = {
  public_ip: string
  private_ip: string
  root_account: string
  root_password: string
}

export type SupplierOpsUploadBatch = {
  id: string
  kind: SupplierOpsBatchKind
  supplier_id: string
  idc_code: string
  access_method: string
  file_name: string
  rows: SupplierOpsInventoryRow[]
  status: "parsed" | "parse_failed"
  parse_error?: string
  created_at: string
}
