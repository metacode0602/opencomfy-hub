import { AsyncLocalStorage } from 'node:async_hooks'

type ProvisioningStore = {
  trusted: boolean
}

const provisioningStorage = new AsyncLocalStorage<ProvisioningStore>()

export function isTrustedProvisioning(): boolean {
  return provisioningStorage.getStore()?.trusted === true
}

export function runWithProvisioningContext<T>(fn: () => Promise<T>): Promise<T> {
  return provisioningStorage.run({ trusted: true }, fn)
}
