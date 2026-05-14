import { create } from "zustand"
import { persist } from "zustand/middleware"
import { supplierOpsBatchSeed } from "@/lib/data/supplier-ops-batch-seed"
import type { SupplierOpsBatchKind, SupplierOpsUploadBatch } from "@/lib/types/supplier-ops-batch"

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

type Base = { batches: SupplierOpsUploadBatch[] }

export type SupplierOpsBatchMockState = Base & {
  resetToSeed: () => void
  createId: (prefix: string) => string
  addBatch: (row: SupplierOpsUploadBatch) => void
  removeBatch: (id: string) => void
}

export const useSupplierOpsBatchMockStore = create<SupplierOpsBatchMockState>()(
  persist(
    (set) => ({
      batches: supplierOpsBatchSeed,

      resetToSeed: () => set({ batches: supplierOpsBatchSeed }),
      createId: (prefix) => newId(prefix),
      addBatch: (row) => set((s) => ({ batches: [row, ...s.batches] })),
      removeBatch: (id) => set((s) => ({ batches: s.batches.filter((b) => b.id !== id) })),
    }),
    {
      name: "supplier-ops-batch-mock-v1",
      version: 1,
    },
  ),
)

export function batchesByKind(s: Base, kind: SupplierOpsBatchKind): SupplierOpsUploadBatch[] {
  return s.batches.filter((b) => b.kind === kind).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
}
