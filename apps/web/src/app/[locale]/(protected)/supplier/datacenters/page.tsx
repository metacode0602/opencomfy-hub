import { AppShell } from '@/components/dashboard/app-shell'
import { DatacentersContent } from '../_components/datacenters-content'

export default function SupplierDatacenterPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">机房管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            数据中心台账、运行状态与 GPU 资源概览
          </p>
        </div>
        <DatacentersContent />
      </div>
    </AppShell>
  )
}
