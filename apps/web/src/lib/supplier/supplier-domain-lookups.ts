'use client'

import { useMemo } from 'react'
import { trpc } from '@/lib/trpc/client'

export function useSupplierLabel(supplierId: string) {
  const { data } = trpc.supplier.getById.useQuery(
    { id: supplierId },
    { enabled: Boolean(supplierId) },
  )
  return data?.shortName ?? data?.name ?? supplierId
}

export function useContractNo(contractId: string) {
  const { data: contracts = [] } = trpc.supplier.listAllContracts.useQuery(undefined, {
    enabled: Boolean(contractId),
    staleTime: 60_000,
  })
  if (!contractId) return '—'
  return contracts.find((c) => c.id === contractId)?.contractNo ?? contractId
}

export function useDeviceLabel(deviceId: string) {
  const { data } = trpc.supplier.getPhysicalDeviceDetail.useQuery(
    { deviceId },
    { enabled: Boolean(deviceId) },
  )
  return useMemo(() => {
    if (!deviceId) return '—'
    const device = data?.device
    return device ? `${device.assetNo} / ${device.sn}` : deviceId
  }, [data, deviceId])
}

export function useBatchCode(batchId: string) {
  const { data } = trpc.supplier.onboardingBatch.getById.useQuery(
    { id: batchId },
    { enabled: Boolean(batchId) },
  )
  return data?.batchCode ?? batchId
}

export function useTermsVersionLabel(termsId: string) {
  return termsId ? `${termsId.slice(0, 10)}` : '—'
}

export function useDataCenterLabel(dataCenterId: string) {
  const { data } = trpc.supplier.getDataCenterDetail.useQuery(
    { dataCenterId },
    { enabled: Boolean(dataCenterId) },
  )
  if (!dataCenterId) return '—'
  const dc = data?.dataCenter
  return dc ? `${dc.name} (${dc.code})` : dataCenterId
}

export function useAssigneeLabel(staffId: string) {
  const { data } = trpc.crm.staff.getById.useQuery(
    { id: staffId },
    { enabled: Boolean(staffId) },
  )
  if (!staffId) return '—'
  return data?.display_name ?? staffId
}
