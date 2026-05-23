'use client'

import { Card, CardContent } from '@workspace/ui/components/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table'
import { trpc } from '@/lib/trpc/client'

export type DeviceImportKind = 'device_inventory' | 'device_changelog' | 'fault_records'

export const DEVICE_IMPORT_KINDS: DeviceImportKind[] = [
  'device_inventory',
  'device_changelog',
  'fault_records',
]

export const IMPORT_META: Record<
  DeviceImportKind,
  {
    title: string
    description: string
    tableTarget: string
    batchTable: string
    columnsHint: string
  }
> = {
  device_inventory: {
    title: '设备主数据表',
    description: '导入 supplier_device、compute_node；含登录凭据（列表脱敏）',
    tableTarget: 'supplier_device + compute_node',
    batchTable: 'onboarding_batch（device_inventory）',
    columnsHint:
      '设备ID、设备标识、IP地址、K8s集群、集群角色、显卡型号、显卡数量、设备状态、设备用途、预期集群提供服务、登录用户名/密码、设备配置、设备接收时间、合作类型、带宽组、备注、集群中节点名称、维修中',
  },
  device_changelog: {
    title: '设备变更表',
    description:
      '每次上传新建变更批次；写入变更审计并刷新设备状态。工单列填写业务批次 WO- 工单号或批次号（ONB-/ORD-），且导入机房须与批次机房一致，可将设备挂接到无清单的业务批次',
    tableTarget: 'supplier_device_change_log',
    batchTable: 'onboarding_batch（device_changelog）',
    columnsHint:
      '设备ID、内网IP、操作时间、变更动作、变更内容、工单（WO- 或批次号）；设备须已在本机房主数据中登记',
  },
  fault_records: {
    title: '故障记录表',
    description: '导入 fault_incident；容器为 supplier_ops_upload_batch',
    tableTarget: 'fault_incident',
    batchTable: 'supplier_ops_upload_batch（fault_records）',
    columnsHint: '记录时间、解决时间、故障类型、影响时长、影响范围、影响台数、故障复盘',
  },
}

export function useInvalidateAfterDeviceImport(supplierId: string, dataCenterId?: string) {
  const utils = trpc.useUtils()

  return () => {
    void utils.supplier.deviceImport.getContext.invalidate({ supplierId })
    void utils.supplier.listPhysicalDevices.invalidate()
    void utils.supplier.getPhysicalDeviceStats.invalidate()
    void utils.supplier.listGpuInventory.invalidate()
    void utils.supplier.listDataCenters.invalidate({ supplierId })
    void utils.supplier.unitCosts.listRecords.invalidate({ supplierId })
    void utils.supplier.getById.invalidate({ id: supplierId })
    void utils.supplier.onboardingBatch.list.invalidate()
    void utils.supplier.onboardingBatch.listBySupplier.invalidate({ supplierId })
    void utils.supplier.listAllDataCenters.invalidate()
    void utils.supplier.getDataCenterStats.invalidate()
    if (dataCenterId) {
      void utils.supplier.getDataCenterDetail.invalidate({ dataCenterId })
    }
  }
}

export function ImportBatchTable({
  rows,
  emptyHint,
}: {
  rows: { id: string; code: string; status: string; count: string; time: string }[]
  emptyHint: string
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">{emptyHint}</CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>批次 / 文件</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>已入库</TableHead>
            <TableHead>时间</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.code}</TableCell>
              <TableCell>{r.status}</TableCell>
              <TableCell>{r.count}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{r.time}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}
