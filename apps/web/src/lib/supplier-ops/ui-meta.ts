import type { SupplierOpsBatchKind } from "@/lib/types/supplier-ops-batch"

export const ONLINE_REASON_OPTIONS = [
  { value: "contract_delivery", label: "合同交付" },
  { value: "capacity_expansion", label: "扩容补量" },
  { value: "hardware_replacement", label: "硬件替换" },
  { value: "new_business", label: "新业务上线" },
  { value: "test_to_production", label: "测试转生产" },
  { value: "other", label: "其他" },
] as const

export function onlineReasonLabel(value: string | null | undefined): string {
  if (!value) return "—"
  const hit = ONLINE_REASON_OPTIONS.find((o) => o.value === value)
  return hit?.label ?? value
}

export const ACCESS_METHOD_OPTIONS = [
  { value: "ssh_jump", label: "SSH 跳板" },
  { value: "ipmi", label: "IPMI 带外" },
  { value: "out_of_band", label: "专线带外" },
  { value: "on_site", label: "现场上架" },
] as const

export const MOCK_IDC_OPTIONS = [
  { value: "HB-BJ-DC1", label: "华北-北京 DC1" },
  { value: "HB-SH-DC2", label: "华北-上海 DC2" },
  { value: "HN-GZ-DC1", label: "华南-广州 DC1" },
] as const

export function accessMethodLabel(value: string): string {
  const hit = ACCESS_METHOD_OPTIONS.find((o) => o.value === value)
  return hit?.label ?? value
}

export function idcOptionLabel(code: string): string {
  const hit = MOCK_IDC_OPTIONS.find((o) => o.value === code)
  return hit?.label ?? code
}

export const OPS_KIND_UI: Record<
  SupplierOpsBatchKind,
  { title: string; description: string; basePath: string; dialogTitle: string }
> = {
  "online-tasks": {
    title: "设备上架",
    description: "按供应商与机房批量登记上架主机（mock）；支持 CSV 模板导入。",
    basePath: "/supplier/online-tasks",
    dialogTitle: "新建上架批次",
  },
  "order-access": {
    title: "订单接入",
    description: "登记订单侧待接入机器清单（mock）；字段与上架一致，便于后续打通工单。",
    basePath: "/supplier/order-access",
    dialogTitle: "新建订单接入批次",
  },
  "fault-incidents": {
    title: "故障事件",
    description: "故障排查涉及的机器清单导入（mock）；与故障单主数据流程独立演示。",
    basePath: "/supplier/fault-incidents",
    dialogTitle: "新建故障关联主机清单",
  },
}
