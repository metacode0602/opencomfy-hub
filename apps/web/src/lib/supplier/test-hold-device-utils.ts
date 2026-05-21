import type { InternalTestHold, InternalTestHoldDevice, SupplierDevice } from "@/lib/types/supplier-domain"

export type TestHoldDeviceDraft = {
  internalIp: string
  externalIp: string
  port: string
  rootAccount: string
  rootPassword: string
}

function normIp(ip: string) {
  return ip.trim()
}

export function findSupplierDeviceForHold(
  hold: InternalTestHold,
  draft: TestHoldDeviceDraft,
  devices: SupplierDevice[],
): { device: SupplierDevice | null; error: string | null } {
  const internalIp = normIp(draft.internalIp)
  const externalIp = normIp(draft.externalIp)

  if (!internalIp && !externalIp) {
    return { device: null, error: "请填写内网 IP 或外网 IP" }
  }

  const pool = devices.filter(
    (d) => d.supplier_id === hold.supplier_id && d.data_center_id === hold.data_center_id,
  )

  const byInternal = internalIp ? pool.filter((d) => d.internal_ip === internalIp) : []
  const byExternal = externalIp ? pool.filter((d) => d.external_ip === externalIp) : []

  if (internalIp && byInternal.length === 0) {
    return { device: null, error: `内网 IP ${internalIp} 在该供应商机房下不存在` }
  }
  if (externalIp && byExternal.length === 0) {
    return { device: null, error: `外网 IP ${externalIp} 在该供应商机房下不存在` }
  }

  if (internalIp && externalIp) {
    const matched = byInternal.filter((d) => d.external_ip === externalIp)
    if (matched.length === 0) {
      return { device: null, error: "内网 IP 与外网 IP 不匹配同一台设备" }
    }
    return { device: matched[0]!, error: null }
  }

  const hit = (internalIp ? byInternal : byExternal)[0]
  if (!hit) {
    return { device: null, error: "未找到匹配设备" }
  }
  return { device: hit, error: null }
}

export function draftToHoldDevice(
  hold: InternalTestHold,
  draft: TestHoldDeviceDraft,
  device: SupplierDevice,
  createId: (prefix: string) => string,
): InternalTestHoldDevice {
  return {
    id: createId("hold-dev"),
    device_id: device.id,
    internal_ip: normIp(draft.internalIp) || device.internal_ip,
    external_ip: normIp(draft.externalIp) || device.external_ip,
    port: draft.port.trim() || "22",
    root_account: draft.rootAccount.trim() || "root",
    root_password: draft.rootPassword,
    sn: device.sn,
  }
}
