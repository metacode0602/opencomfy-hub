import { create } from "zustand"
import { persist } from "zustand/middleware"
import { supplierDomainSeed } from "@/lib/data/supplier-domain-mock"
import type {
  AccessConditionSheet,
  ComputeNode,
  EntityStateTransitionLog,
  FaultIncident,
  InternalTestHold,
  LifecycleStateDefinition,
  OnboardingBatch,
  OnboardingTask,
  ResourcePoolBinding,
  Supplier,
  SupplierActivity,
  SupplierContract,
  SupplierDataCenter,
  SupplierDevice,
  SupplierDeviceChangeLog,
  SupplierOpsUploadBatch,
  SupplierTermsVersion,
  SupplierUnitCost,
} from "@/lib/types/supplier-domain"

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function replaceById<T extends { id: string }>(list: T[], row: T): T[] {
  const i = list.findIndex((x) => x.id === row.id)
  if (i === -1) return [...list, row]
  const next = [...list]
  next[i] = row
  return next
}

type Base = typeof supplierDomainSeed

export type SupplierDomainMockState = Base & {
  resetToSeed: () => void
  createId: (prefix: string) => string

  upsertSupplier: (row: Supplier) => void
  removeSupplier: (id: string) => void

  upsertContract: (row: SupplierContract) => void
  removeContract: (id: string) => void

  upsertTermsVersion: (row: SupplierTermsVersion) => void
  removeTermsVersion: (id: string) => void

  upsertUnitCost: (row: SupplierUnitCost) => void
  removeUnitCost: (id: string) => void

  upsertAccessSheet: (row: AccessConditionSheet) => void
  removeAccessSheet: (id: string) => void

  upsertOnboardingBatch: (row: OnboardingBatch) => void
  removeOnboardingBatch: (id: string) => void

  upsertDevice: (row: SupplierDevice) => void
  removeDevice: (id: string) => void

  upsertComputeNode: (row: ComputeNode) => void
  removeComputeNode: (id: string) => void

  upsertOnboardingTask: (row: OnboardingTask) => void
  removeOnboardingTask: (id: string) => void

  upsertFaultIncident: (row: FaultIncident) => void
  removeFaultIncident: (id: string) => void

  upsertInternalTestHold: (row: InternalTestHold) => void
  removeInternalTestHold: (id: string) => void

  upsertResourcePoolBinding: (row: ResourcePoolBinding) => void
  removeResourcePoolBinding: (id: string) => void

  upsertLifecycleStateDefinition: (row: LifecycleStateDefinition) => void
  removeLifecycleStateDefinition: (id: string) => void

  upsertEntityStateTransitionLog: (row: EntityStateTransitionLog) => void
  removeEntityStateTransitionLog: (id: string) => void

  upsertDataCenter: (row: SupplierDataCenter) => void
  removeDataCenter: (id: string) => void

  upsertSupplierActivity: (row: SupplierActivity) => void
  removeSupplierActivity: (id: string) => void

  upsertDeviceChangeLog: (row: SupplierDeviceChangeLog) => void
  removeDeviceChangeLog: (id: string) => void

  upsertOpsUploadBatch: (row: SupplierOpsUploadBatch) => void
  removeOpsUploadBatch: (id: string) => void
}

function collectCascadeForSupplier(
  s: Base,
  supplierId: string,
): {
  contractIds: Set<string>
  termsIds: Set<string>
  batchIds: Set<string>
  deviceIds: Set<string>
  nodeIds: Set<string>
} {
  const contractIds = new Set(s.contracts.filter((c) => c.supplier_id === supplierId).map((c) => c.id))
  const termsIds = new Set(
    s.termsVersions
      .filter((t) => t.supplier_id === supplierId || (t.contract_id != null && contractIds.has(t.contract_id)))
      .map((t) => t.id),
  )
  const batchIds = new Set(
    s.onboardingBatches.filter((b) => contractIds.has(b.contract_id)).map((b) => b.id),
  )
  const deviceIds = new Set(s.devices.filter((d) => d.supplier_id === supplierId).map((d) => d.id))
  const nodeIds = new Set(s.computeNodes.filter((n) => deviceIds.has(n.device_id)).map((n) => n.id))
  return { contractIds, termsIds, batchIds, deviceIds, nodeIds }
}

export const useSupplierDomainMockStore = create<SupplierDomainMockState>()(
  persist(
    (set) => ({
      ...supplierDomainSeed,

      resetToSeed: () => set({ ...supplierDomainSeed }),
      createId: (prefix) => newId(prefix),

      upsertSupplier: (row) => set((s) => ({ suppliers: replaceById(s.suppliers, row) })),
      removeSupplier: (id) =>
        set((s) => {
          const { contractIds, termsIds, batchIds, deviceIds, nodeIds } = collectCascadeForSupplier(s, id)
          return {
            suppliers: s.suppliers.filter((x) => x.id !== id),
            contracts: s.contracts.filter((c) => !contractIds.has(c.id)),
            termsVersions: s.termsVersions.filter(
              (t) => t.supplier_id !== id && (t.contract_id == null || !contractIds.has(t.contract_id)),
            ),
            unitCosts: s.unitCosts.filter((u) => !termsIds.has(u.supplier_terms_version_id)),
            accessSheets: s.accessSheets.filter((a) => !contractIds.has(a.contract_id)),
            onboardingBatches: s.onboardingBatches.filter((b) => !batchIds.has(b.id)),
            devices: s.devices.filter((d) => d.supplier_id !== id),
            computeNodes: s.computeNodes.filter((n) => !deviceIds.has(n.device_id)),
            onboardingTasks: s.onboardingTasks.filter(
              (t) => !batchIds.has(t.onboarding_batch_id) && (t.device_id == null || !deviceIds.has(t.device_id)),
            ),
            faultIncidents: s.faultIncidents.filter(
              (f) =>
                (f.device_id == null || !deviceIds.has(f.device_id)) &&
                (f.compute_node_id == null || !nodeIds.has(f.compute_node_id)),
            ),
            internalTestHolds: s.internalTestHolds.filter((h) => h.supplier_id !== id),
            dataCenters: s.dataCenters.filter((dc) => dc.supplier_id !== id),
            resourcePoolBindings: s.resourcePoolBindings.filter((r) => !deviceIds.has(r.device_id)),
            supplierActivities: s.supplierActivities.filter((a) => a.supplier_id !== id),
            entityStateTransitionLogs: s.entityStateTransitionLogs.filter(
              (e) =>
                !(
                  (e.entity_type === "device" && deviceIds.has(e.entity_id)) ||
                  (e.entity_type === "compute_node" && nodeIds.has(e.entity_id))
                ),
            ),
          }
        }),

      upsertContract: (row) => set((s) => ({ contracts: replaceById(s.contracts, row) })),
      removeContract: (id) =>
        set((s) => {
          const batchIds = new Set(s.onboardingBatches.filter((b) => b.contract_id === id).map((b) => b.id))
          const deviceIds = new Set(
            s.devices.filter((d) => d.contract_id === id || batchIds.has(d.onboarding_batch_id)).map((d) => d.id),
          )
          const nodeIds = new Set(s.computeNodes.filter((n) => deviceIds.has(n.device_id)).map((n) => n.id))
          const termsIds = new Set(s.termsVersions.filter((t) => t.contract_id === id).map((t) => t.id))
          return {
            contracts: s.contracts.filter((c) => c.id !== id),
            termsVersions: s.termsVersions.filter((t) => t.contract_id !== id),
            unitCosts: s.unitCosts.filter((u) => !termsIds.has(u.supplier_terms_version_id)),
            accessSheets: s.accessSheets.filter((a) => a.contract_id !== id),
            onboardingBatches: s.onboardingBatches.filter((b) => b.contract_id !== id),
            devices: s.devices.filter((d) => !deviceIds.has(d.id)),
            computeNodes: s.computeNodes.filter((n) => !deviceIds.has(n.device_id)),
            onboardingTasks: s.onboardingTasks.filter(
              (t) => !batchIds.has(t.onboarding_batch_id) && (t.device_id == null || !deviceIds.has(t.device_id)),
            ),
            faultIncidents: s.faultIncidents.filter(
              (f) =>
                (f.device_id == null || !deviceIds.has(f.device_id)) &&
                (f.compute_node_id == null || !nodeIds.has(f.compute_node_id)),
            ),
            resourcePoolBindings: s.resourcePoolBindings.filter((r) => !deviceIds.has(r.device_id)),
            supplierActivities: s.supplierActivities.filter((a) => a.supplier_id !== id),
            entityStateTransitionLogs: s.entityStateTransitionLogs.filter(
              (e) =>
                !(
                  (e.entity_type === "device" && deviceIds.has(e.entity_id)) ||
                  (e.entity_type === "compute_node" && nodeIds.has(e.entity_id))
                ),
            ),
          }
        }),

      upsertTermsVersion: (row) => set((s) => ({ termsVersions: replaceById(s.termsVersions, row) })),
      removeTermsVersion: (tid) =>
        set((s) => ({
          termsVersions: s.termsVersions.filter((t) => t.id !== tid),
          unitCosts: s.unitCosts.filter((u) => u.supplier_terms_version_id !== tid),
        })),

      upsertUnitCost: (row) => set((s) => ({ unitCosts: replaceById(s.unitCosts, row) })),
      removeUnitCost: (id) => set((s) => ({ unitCosts: s.unitCosts.filter((x) => x.id !== id) })),

      upsertAccessSheet: (row) => set((s) => ({ accessSheets: replaceById(s.accessSheets, row) })),
      removeAccessSheet: (id) =>
        set((s) => ({
          accessSheets: s.accessSheets.filter((x) => x.id !== id),
          onboardingBatches: s.onboardingBatches.filter((b) => b.access_condition_sheet_id !== id),
        })),

      upsertOnboardingBatch: (row) => set((s) => ({ onboardingBatches: replaceById(s.onboardingBatches, row) })),
      removeOnboardingBatch: (bid) =>
        set((s) => {
          const deviceIds = new Set(s.devices.filter((d) => d.onboarding_batch_id === bid).map((d) => d.id))
          const nodeIds = new Set(s.computeNodes.filter((n) => deviceIds.has(n.device_id)).map((n) => n.id))
          return {
            onboardingBatches: s.onboardingBatches.filter((b) => b.id !== bid),
            devices: s.devices.filter((d) => d.onboarding_batch_id !== bid),
            computeNodes: s.computeNodes.filter((n) => !deviceIds.has(n.device_id)),
            onboardingTasks: s.onboardingTasks.filter(
              (t) => t.onboarding_batch_id !== bid && (t.device_id == null || !deviceIds.has(t.device_id)),
            ),
            faultIncidents: s.faultIncidents.filter(
              (f) =>
                (f.device_id == null || !deviceIds.has(f.device_id)) &&
                (f.compute_node_id == null || !nodeIds.has(f.compute_node_id)),
            ),
            resourcePoolBindings: s.resourcePoolBindings.filter((r) => !deviceIds.has(r.device_id)),
            entityStateTransitionLogs: s.entityStateTransitionLogs.filter(
              (e) =>
                !(
                  (e.entity_type === "device" && deviceIds.has(e.entity_id)) ||
                  (e.entity_type === "compute_node" && nodeIds.has(e.entity_id))
                ),
            ),
          }
        }),

      upsertDevice: (row) => set((s) => ({ devices: replaceById(s.devices, row) })),
      removeDevice: (did) =>
        set((s) => {
          const nodeIds = new Set(s.computeNodes.filter((n) => n.device_id === did).map((n) => n.id))
          return {
            devices: s.devices.filter((d) => d.id !== did),
            computeNodes: s.computeNodes.filter((n) => n.device_id !== did),
            onboardingTasks: s.onboardingTasks.filter((t) => t.device_id !== did),
            faultIncidents: s.faultIncidents.filter(
              (f) => f.device_id !== did && (f.compute_node_id == null || !nodeIds.has(f.compute_node_id)),
            ),
            resourcePoolBindings: s.resourcePoolBindings.filter((r) => r.device_id !== did),
            entityStateTransitionLogs: s.entityStateTransitionLogs.filter(
              (e) =>
                !(
                  (e.entity_type === "device" && e.entity_id === did) ||
                  (e.entity_type === "compute_node" && nodeIds.has(e.entity_id))
                ),
            ),
          }
        }),

      upsertComputeNode: (row) => set((s) => ({ computeNodes: replaceById(s.computeNodes, row) })),
      removeComputeNode: (nid) =>
        set((s) => ({
          computeNodes: s.computeNodes.filter((n) => n.id !== nid),
          faultIncidents: s.faultIncidents.filter((f) => f.compute_node_id !== nid),
          entityStateTransitionLogs: s.entityStateTransitionLogs.filter(
            (e) => !(e.entity_type === "compute_node" && e.entity_id === nid),
          ),
        })),

      upsertOnboardingTask: (row) => set((s) => ({ onboardingTasks: replaceById(s.onboardingTasks, row) })),
      removeOnboardingTask: (id) => set((s) => ({ onboardingTasks: s.onboardingTasks.filter((x) => x.id !== id) })),

      upsertFaultIncident: (row) => set((s) => ({ faultIncidents: replaceById(s.faultIncidents, row) })),
      removeFaultIncident: (id) => set((s) => ({ faultIncidents: s.faultIncidents.filter((x) => x.id !== id) })),

      upsertInternalTestHold: (row) => set((s) => ({ internalTestHolds: replaceById(s.internalTestHolds, row) })),
      removeInternalTestHold: (id) => set((s) => ({ internalTestHolds: s.internalTestHolds.filter((x) => x.id !== id) })),

      upsertResourcePoolBinding: (row) =>
        set((s) => ({ resourcePoolBindings: replaceById(s.resourcePoolBindings, row) })),
      removeResourcePoolBinding: (id) =>
        set((s) => ({ resourcePoolBindings: s.resourcePoolBindings.filter((x) => x.id !== id) })),

      upsertLifecycleStateDefinition: (row) =>
        set((s) => ({ lifecycleStateDefinitions: replaceById(s.lifecycleStateDefinitions, row) })),
      removeLifecycleStateDefinition: (id) =>
        set((s) => ({ lifecycleStateDefinitions: s.lifecycleStateDefinitions.filter((x) => x.id !== id) })),

      upsertEntityStateTransitionLog: (row) =>
        set((s) => ({ entityStateTransitionLogs: replaceById(s.entityStateTransitionLogs, row) })),
      removeEntityStateTransitionLog: (id) =>
        set((s) => ({ entityStateTransitionLogs: s.entityStateTransitionLogs.filter((x) => x.id !== id) })),

      upsertDataCenter: (row) => set((s) => ({ dataCenters: replaceById(s.dataCenters, row) })),
      removeDataCenter: (id) =>
        set((s) => ({
          dataCenters: s.dataCenters.filter((x) => x.id !== id),
          internalTestHolds: s.internalTestHolds.filter((h) => h.data_center_id !== id),
        })),

      upsertSupplierActivity: (row) => set((s) => ({ supplierActivities: replaceById(s.supplierActivities, row) })),
      removeSupplierActivity: (id) => set((s) => ({ supplierActivities: s.supplierActivities.filter((x) => x.id !== id) })),

      upsertDeviceChangeLog: (row) =>
        set((s) => ({ deviceChangeLogs: replaceById(s.deviceChangeLogs, row) })),
      removeDeviceChangeLog: (id) =>
        set((s) => ({ deviceChangeLogs: s.deviceChangeLogs.filter((x) => x.id !== id) })),

      upsertOpsUploadBatch: (row) =>
        set((s) => ({ opsUploadBatches: replaceById(s.opsUploadBatches, row) })),
      removeOpsUploadBatch: (id) =>
        set((s) => ({ opsUploadBatches: s.opsUploadBatches.filter((x) => x.id !== id) })),
    }),
    {
      name: "supplier-domain-mock-store-v3",
      version: 4,
      migrate: (persisted, version) => {
        const state = persisted as SupplierDomainMockState
        if (version < 3) {
          return {
            ...state,
            deviceChangeLogs: state.deviceChangeLogs ?? supplierDomainSeed.deviceChangeLogs,
            opsUploadBatches: state.opsUploadBatches ?? supplierDomainSeed.opsUploadBatches,
          }
        }
        if (version < 4) {
          const existingIds = new Set((state.devices ?? []).map((d) => d.id))
          const mergedDevices = [
            ...(state.devices ?? []),
            ...supplierDomainSeed.devices.filter((d) => !existingIds.has(d.id)),
          ]
          const existingNodeIds = new Set((state.computeNodes ?? []).map((n) => n.id))
          const mergedNodes = [
            ...(state.computeNodes ?? []),
            ...supplierDomainSeed.computeNodes.filter((n) => !existingNodeIds.has(n.id)),
          ]
          return { ...state, devices: mergedDevices, computeNodes: mergedNodes }
        }
        return state
      },
    },
  ),
)

/** 供列表/详情筛选：属于某供应商的合同 id 集合 */
export function contractIdsForSupplier(s: Base, supplierId: string): Set<string> {
  return new Set(s.contracts.filter((c) => c.supplier_id === supplierId).map((c) => c.id))
}

export function deviceIdsForSupplier(s: Base, supplierId: string): Set<string> {
  return new Set(s.devices.filter((d) => d.supplier_id === supplierId).map((d) => d.id))
}

export function nodeIdsForSupplierDevices(s: Base, deviceIds: Set<string>): Set<string> {
  return new Set(s.computeNodes.filter((n) => deviceIds.has(n.device_id)).map((n) => n.id))
}
