'use client'

import { useState } from 'react'
import { ChevronRight, FlaskConical, PackagePlus, ShoppingCart } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { OnboardingBatchWizardDialog } from './onboarding-batch-wizard-dialog'
import { TestHoldCreateDialog } from './test-hold-create-dialog'

type OnboardingMode = 'picker' | 'online' | 'order' | 'hold'

const MODE_OPTIONS: Array<{
  mode: Exclude<OnboardingMode, 'picker'>
  title: string
  description: string
  icon: typeof PackagePlus
}> = [
  {
    mode: 'online',
    title: '设备上架',
    description: '创建上架批次，填写计划卡型与数量，可选上传设备清单',
    icon: PackagePlus,
  },
  {
    mode: 'order',
    title: '订单接入',
    description: '登记订单侧待接入机器，关联订单编号与上架计划',
    icon: ShoppingCart,
  },
  {
    mode: 'hold',
    title: '内部占用',
    description: '登记内部测试 GPU 占用，影响可售量计算',
    icon: FlaskConical,
  },
]

export function DatacenterOnboardingDialog({
  open,
  onOpenChange,
  supplierId,
  supplierName,
  dataCenterId,
  dataCenterName,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplierId: string
  supplierName: string
  dataCenterId: string
  dataCenterName: string
  onSuccess?: () => void
}) {
  const [mode, setMode] = useState<OnboardingMode>('picker')

  const handleOpenChange = (next: boolean) => {
    if (!next) setMode('picker')
    onOpenChange(next)
  }

  const closeSubDialog = () => {
    setMode('picker')
    onOpenChange(false)
  }

  const handleSuccess = () => {
    onSuccess?.()
    closeSubDialog()
  }

  return (
    <>
      <Dialog open={open && mode === 'picker'} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>设备上架 / 接入</DialogTitle>
            <DialogDescription>
              为机房「{dataCenterName}」选择操作类型，供应商：{supplierName}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            {MODE_OPTIONS.map(({ mode: optionMode, title, description, icon: Icon }) => (
              <button
                key={optionMode}
                type="button"
                className="flex w-full items-start gap-4 rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted/40"
                onClick={() => setMode(optionMode)}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                </div>
                <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <OnboardingBatchWizardDialog
        routeKind="online-tasks"
        open={open && mode === 'online'}
        onOpenChange={(next) => {
          if (!next) closeSubDialog()
        }}
        defaultSupplierId={supplierId}
        defaultDataCenterId={dataCenterId}
        supplierName={supplierName}
        dataCenterName={dataCenterName}
        lockContext
        onSuccess={handleSuccess}
      />

      <OnboardingBatchWizardDialog
        routeKind="order-access"
        open={open && mode === 'order'}
        onOpenChange={(next) => {
          if (!next) closeSubDialog()
        }}
        defaultSupplierId={supplierId}
        defaultDataCenterId={dataCenterId}
        supplierName={supplierName}
        dataCenterName={dataCenterName}
        lockContext
        onSuccess={handleSuccess}
      />

      <TestHoldCreateDialog
        open={open && mode === 'hold'}
        onOpenChange={(next) => {
          if (!next) closeSubDialog()
        }}
        defaultSupplierId={supplierId}
        defaultDataCenterId={dataCenterId}
        supplierName={supplierName}
        dataCenterName={dataCenterName}
        lockContext
        onSuccess={handleSuccess}
      />
    </>
  )
}
