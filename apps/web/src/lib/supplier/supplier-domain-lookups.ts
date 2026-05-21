"use client"

import { useMemo } from "react"
import { useSupplierDomainMockStore } from "@/lib/stores/supplier-domain-mock-store"

function readStore() {
  return useSupplierDomainMockStore.getState()
}

export function supplierLabelSync(supplierId: string) {
  const s = readStore().suppliers.find((x) => x.id === supplierId)
  return s?.short_name ?? supplierId
}

export function contractNoSync(contractId: string) {
  if (!contractId) return "—"
  const c = readStore().contracts.find((x) => x.id === contractId)
  return c?.contract_no ?? contractId
}

export function deviceLabelSync(deviceId: string) {
  if (!deviceId) return "—"
  const d = readStore().devices.find((x) => x.id === deviceId)
  return d ? `${d.asset_no} / ${d.sn}` : deviceId
}

export function batchCodeSync(batchId: string) {
  const b = readStore().onboardingBatches.find((x) => x.id === batchId)
  return b?.batch_code ?? batchId
}

export function termsVersionLabelSync(termsId: string) {
  const t = readStore().termsVersions.find((x) => x.id === termsId)
  return t ? `${t.deal_mode} · ${termsId.slice(0, 10)}` : termsId
}

export function useSupplierLabel(supplierId: string) {
  const name = useSupplierDomainMockStore((s) => s.suppliers.find((x) => x.id === supplierId)?.short_name)
  return name ?? supplierId
}

export function useContractNo(contractId: string) {
  return useSupplierDomainMockStore((s) => {
    if (!contractId) return "—"
    return s.contracts.find((c) => c.id === contractId)?.contract_no ?? contractId
  })
}

export function useDeviceLabel(deviceId: string) {
  const d = useSupplierDomainMockStore((s) =>
    deviceId ? s.devices.find((x) => x.id === deviceId) : undefined,
  )
  return useMemo(() => {
    if (!deviceId) return "—"
    return d ? `${d.asset_no} / ${d.sn}` : deviceId
  }, [d, deviceId])
}

export function useBatchCode(batchId: string) {
  return useSupplierDomainMockStore((s) => s.onboardingBatches.find((b) => b.id === batchId)?.batch_code ?? batchId)
}

export function useTermsVersionLabel(termsId: string) {
  const t = useSupplierDomainMockStore((s) => s.termsVersions.find((x) => x.id === termsId))
  return useMemo(() => (t ? `${t.deal_mode} · ${termsId.slice(0, 10)}` : termsId), [t, termsId])
}

export function dataCenterLabelSync(dataCenterId: string) {
  if (!dataCenterId) return "—"
  const dc = readStore().dataCenters.find((x) => x.id === dataCenterId)
  return dc ? `${dc.name} (${dc.code})` : dataCenterId
}

export function useDataCenterLabel(dataCenterId: string) {
  const dc = useSupplierDomainMockStore((s) =>
    dataCenterId ? s.dataCenters.find((x) => x.id === dataCenterId) : undefined,
  )
  return dc ? `${dc.name} (${dc.code})` : dataCenterId || "—"
}

export function useAssigneeLabel(id: string) {
  const map: Record<string, string> = {
    "staff-mock-01": "张三（mock）",
    "staff-mock-02": "李四（mock）",
  }
  return map[id] ?? id
}
