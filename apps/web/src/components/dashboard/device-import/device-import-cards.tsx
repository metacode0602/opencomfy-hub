'use client'

import { AlertTriangle, History, Server } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { DeviceInventoryImportTrigger } from './device-inventory-import-dialog'
import { DeviceChangelogImportTrigger } from './device-changelog-import-dialog'
import { FaultRecordsImportTrigger } from './fault-records-import-dialog'
import { DEVICE_IMPORT_KINDS, IMPORT_META, type DeviceImportKind } from './device-import-dialog-shared'

const IMPORT_ICONS: Record<DeviceImportKind, typeof Server> = {
  device_inventory: Server,
  device_changelog: History,
  fault_records: AlertTriangle,
}

const IMPORT_TRIGGERS = {
  device_inventory: DeviceInventoryImportTrigger,
  device_changelog: DeviceChangelogImportTrigger,
  fault_records: FaultRecordsImportTrigger,
} as const

export interface DeviceImportCardsProps {
  supplierId: string
  defaultDataCenterId?: string
  dataCenterName?: string
  lockDataCenter?: boolean
  onSuccess?: () => void
  /** 传入时在 Card 内渲染；不传则直接渲染网格（供应商页） */
  sectionTitle?: string
  sectionDescription?: string
}

export function DeviceImportCards({
  supplierId,
  defaultDataCenterId,
  dataCenterName,
  lockDataCenter,
  onSuccess,
  sectionTitle,
  sectionDescription,
}: DeviceImportCardsProps) {
  const nested = Boolean(sectionTitle)
  const triggerProps = {
    supplierId,
    defaultDataCenterId,
    dataCenterName,
    lockDataCenter,
    onSuccess,
  }

  const grid = (
    <div className={nested ? 'grid grid-cols-1 gap-4 md:grid-cols-3' : 'grid grid-cols-3 gap-4'}>
      {DEVICE_IMPORT_KINDS.map((kind) => {
        const m = IMPORT_META[kind]
        const Icon = IMPORT_ICONS[kind]
        const Trigger = IMPORT_TRIGGERS[kind]
        return (
          <Card key={kind} className={nested ? 'border-border bg-muted/20' : 'border-border'}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary" />
                <CardTitle className={nested ? 'text-sm' : 'text-base'}>{m.title}</CardTitle>
              </div>
              <CardDescription className="text-xs">{m.tableTarget}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p
                className={
                  nested
                    ? 'line-clamp-3 text-xs text-muted-foreground'
                    : 'line-clamp-2 text-xs text-muted-foreground'
                }
              >
                {m.description}
              </p>
              {!nested && (
                <p className="font-mono text-xs text-muted-foreground">{m.batchTable}</p>
              )}
              <Trigger {...triggerProps} />
            </CardContent>
          </Card>
        )
      })}
    </div>
  )

  if (!sectionTitle) {
    return grid
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-base">{sectionTitle}</CardTitle>
        {sectionDescription ? <CardDescription>{sectionDescription}</CardDescription> : null}
      </CardHeader>
      <CardContent>{grid}</CardContent>
    </Card>
  )
}
