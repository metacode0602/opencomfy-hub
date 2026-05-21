import XLSX from "xlsx-js-style"
import type { InternalTestHold, InternalTestHoldDevice } from "@/lib/types/supplier-domain"

/** 与设备上架 CSV 模板对齐的导出表头 */
export const TEST_HOLD_DEVICE_EXPORT_HEADERS = [
  "公网IP",
  "内网IP",
  "root账号",
  "密码",
  "SN",
  "端口",
] as const

export function downloadTestHoldDevicesExcel(params: {
  hold: InternalTestHold
  devices: InternalTestHoldDevice[]
}) {
  const { hold, devices } = params
  if (devices.length === 0) return false

  const wsData: string[][] = [
    [...TEST_HOLD_DEVICE_EXPORT_HEADERS],
    ...devices.map((d) => [
      d.external_ip,
      d.internal_ip,
      d.root_account,
      d.root_password,
      d.sn ?? "",
      d.port,
    ]),
  ]

  const ws = XLSX.utils.aoa_to_sheet(wsData)
  const headerStyle = {
    font: { bold: true },
    fill: { fgColor: { rgb: "E8EEF4" } },
  }
  for (let c = 0; c < TEST_HOLD_DEVICE_EXPORT_HEADERS.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    if (ws[addr]) ws[addr].s = headerStyle
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "设备上架")
  const slug = hold.user_name.replace(/\s+/g, "")
  XLSX.writeFile(wb, `测试占用-${hold.id}-${slug}-设备上架.xlsx`)
  return true
}
