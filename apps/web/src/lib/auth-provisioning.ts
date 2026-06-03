import { AsyncLocalStorage } from 'node:async_hooks'

export type ProvisioningContext = {
  operatorUserId: string
  mobile?: string
  /** 员工应用角色，建号时同步到 users.role */
  roles?: string[]
}

type ProvisioningStore = ProvisioningContext & {
  trusted: boolean
}

const provisioningStorage = new AsyncLocalStorage<ProvisioningStore>()

export function isTrustedProvisioning(): boolean {
  return provisioningStorage.getStore()?.trusted === true
}

export function getProvisioningContext(): ProvisioningContext | undefined {
  const store = provisioningStorage.getStore()
  if (!store?.trusted || !store.operatorUserId?.trim()) return undefined
  return {
    operatorUserId: store.operatorUserId,
    mobile: store.mobile,
    roles: store.roles,
  }
}

export function runWithProvisioningContext<T>(
  context: ProvisioningContext,
  fn: () => Promise<T>,
): Promise<T> {
  return provisioningStorage.run({ trusted: true, ...context }, fn)
}
