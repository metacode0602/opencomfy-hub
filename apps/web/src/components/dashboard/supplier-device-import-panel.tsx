'use client'

import { Loader2 } from 'lucide-react'
import { Card, CardContent } from '@workspace/ui/components/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@workspace/ui/components/tabs'
import { Alert, AlertDescription } from '@workspace/ui/components/alert'
import { IMPORT_STATUS_LABELS } from '@/lib/supplier/onboarding-batch-utils'
import { FAULT_IMPORT_STATUS_LABELS } from '@/lib/supplier/device-import-utils'
import { trpc } from '@/lib/trpc/client'
import {
  ImportBatchTable,
  useInvalidateAfterDeviceImport,
} from '@/components/dashboard/device-import/device-import-dialog-shared'
import { DeviceImportCards } from '@/components/dashboard/device-import/device-import-cards'

interface SupplierDeviceImportPanelProps {
  supplierId: string
}

function formatDt(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function SupplierDeviceImportPanel({ supplierId }: SupplierDeviceImportPanelProps) {
  const invalidateAfterCommit = useInvalidateAfterDeviceImport(supplierId)

  const { data: supplier, isLoading: supplierLoading, isError: supplierError } =
    trpc.supplier.getById.useQuery({ id: supplierId }, { retry: 1 })

  const { data: dataCenters = [] } = trpc.supplier.listDataCenters.useQuery(
    { supplierId },
    { enabled: Boolean(supplierId) },
  )

  const { data: importContext, isLoading: contextLoading } =
    trpc.supplier.deviceImport.getContext.useQuery(
      { supplierId },
      { enabled: Boolean(supplierId) },
    )

  const recentInventoryBatches = importContext?.inventoryBatches ?? []
  const recentChangelogBatches = importContext?.changelogBatches ?? []
  const recentFaultBatches = importContext?.faultBatches ?? []
  const changeLogCount = importContext?.changeLogCount ?? 0

  if (supplierLoading || contextLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载导入上下文...
        </CardContent>
      </Card>
    )
  }

  if (supplierError || !supplier) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          未找到供应商或加载失败
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium text-foreground">运维数据导入</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          三类 Excel/CSV 批量导入，写入 PostgreSQL；依据 supplier-device-import-schema.md
        </p>
      </div>

      {dataCenters.length === 0 && (
        <Alert>
          <AlertDescription>
            该供应商尚未配置机房，设备主数据/变更导入需先添加机房并配置合同与接入条件单。
          </AlertDescription>
        </Alert>
      )}

      <DeviceImportCards supplierId={supplierId} onSuccess={invalidateAfterCommit} />

      <Tabs defaultValue="inventory">
        <TabsList>
          <TabsTrigger value="inventory">设备主数据批次</TabsTrigger>
          <TabsTrigger value="changelog">变更批次 ({recentChangelogBatches.length})</TabsTrigger>
          <TabsTrigger value="fault">故障导入 ({recentFaultBatches.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="inventory" className="mt-4">
          <ImportBatchTable
            emptyHint="暂无设备主数据导入批次"
            rows={recentInventoryBatches.map((b) => ({
              id: b.id,
              code: b.code,
              status:
                IMPORT_STATUS_LABELS[b.importStatus as keyof typeof IMPORT_STATUS_LABELS] ??
                b.importStatus,
              count: `${b.committedCount} / ${b.parsedSuccessCount}`,
              time: formatDt(b.committedAt ?? b.parsedAt),
            }))}
          />
        </TabsContent>
        <TabsContent value="changelog" className="mt-4">
          <p className="mb-3 text-xs text-muted-foreground">
            累计变更审计 {changeLogCount} 条（supplier_device_change_log）
          </p>
          <ImportBatchTable
            emptyHint="暂无设备变更导入批次"
            rows={recentChangelogBatches.map((b) => ({
              id: b.id,
              code: b.code,
              status:
                IMPORT_STATUS_LABELS[b.importStatus as keyof typeof IMPORT_STATUS_LABELS] ??
                b.importStatus,
              count: String(b.committedCount),
              time: formatDt(b.committedAt ?? b.parsedAt),
            }))}
          />
        </TabsContent>
        <TabsContent value="fault" className="mt-4">
          <ImportBatchTable
            emptyHint="暂无故障记录导入批次"
            rows={recentFaultBatches.map((b) => ({
              id: b.id,
              code: b.code,
              status:
                FAULT_IMPORT_STATUS_LABELS[b.importStatus as keyof typeof FAULT_IMPORT_STATUS_LABELS] ??
                b.importStatus,
              count: String(b.committedCount),
              time: formatDt(b.committedAt ?? b.createdAt),
            }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
