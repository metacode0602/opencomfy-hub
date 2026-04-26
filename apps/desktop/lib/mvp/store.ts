import { useSyncExternalStore } from "react"

import type { Asset, Delivery, GenerationJob, TemplateOutputType } from "@/lib/mvp/types"

type State = {
  assets: Record<string, Asset>
  jobs: Record<string, GenerationJob>
  deliveries: Record<string, Delivery>
}

type Action =
  | { type: "UPSERT_ASSET"; asset: Asset }
  | { type: "UPSERT_JOB"; job: GenerationJob }
  | { type: "UPSERT_DELIVERY"; delivery: Delivery }
  | { type: "INC_DOWNLOAD"; deliveryId: string }
  | { type: "HYDRATE"; state: Partial<State> }

const STORAGE_KEY = "opencomfy:mvp:state:v1"

function now() {
  return Date.now()
}

function genId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
}

function safeParseJson<T>(value: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function reduce(state: State, action: Action): State {
  switch (action.type) {
    case "UPSERT_ASSET":
      return { ...state, assets: { ...state.assets, [action.asset.id]: action.asset } }
    case "UPSERT_JOB":
      return { ...state, jobs: { ...state.jobs, [action.job.id]: action.job } }
    case "UPSERT_DELIVERY":
      return {
        ...state,
        deliveries: { ...state.deliveries, [action.delivery.id]: action.delivery },
      }
    case "INC_DOWNLOAD": {
      const d = state.deliveries[action.deliveryId]
      if (!d) return state
      return {
        ...state,
        deliveries: {
          ...state.deliveries,
          [action.deliveryId]: { ...d, downloadCount: (d.downloadCount ?? 0) + 1 },
        },
      }
    }
    case "HYDRATE":
      return {
        assets: action.state.assets ?? state.assets,
        jobs: action.state.jobs ?? state.jobs,
        deliveries: action.state.deliveries ?? state.deliveries,
      }
    default:
      return state
  }
}

function createStore() {
  let state: State = { assets: {}, jobs: {}, deliveries: {} }
  const listeners = new Set<() => void>()

  function emit() {
    for (const l of listeners) l()
  }

  function persist(next: State) {
    if (typeof window === "undefined") return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  function dispatch(action: Action) {
    state = reduce(state, action)
    persist(state)
    emit()
  }

  function getSnapshot() {
    return state
  }

  function subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  function hydrateFromStorage() {
    if (typeof window === "undefined") return
    const parsed = safeParseJson<State>(window.localStorage.getItem(STORAGE_KEY))
    if (parsed) dispatch({ type: "HYDRATE", state: parsed })
  }

  return { dispatch, getSnapshot, subscribe, hydrateFromStorage }
}

const store = createStore()
let didHydrate = false

export function useMvpStore<T>(selector: (s: State) => T): T {
  if (typeof window !== "undefined" && !didHydrate) {
    didHydrate = true
    store.hydrateFromStorage()
  }

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  return selector(snapshot)
}

export function mvpActions() {
  return {
    createMockJob(args: {
      templateId: string
      outputType: TemplateOutputType
      params: Record<string, string | number>
      inputImageDataUrl?: string
    }) {
      const jobId = genId("job")
      const createdAt = now()
      const baseJob: GenerationJob = {
        id: jobId,
        templateId: args.templateId,
        status: "queued",
        progress: 0,
        input: { params: args.params, inputImageDataUrl: args.inputImageDataUrl },
        createdAt,
        updatedAt: createdAt,
      }
      store.dispatch({ type: "UPSERT_JOB", job: baseJob })

      // 模拟：queued -> running -> succeeded/failed
      const fail = Math.random() < 0.08

      const runningAt = setTimeout(() => {
        const runningJob: GenerationJob = {
          ...baseJob,
          status: "running",
          progress: 10,
          updatedAt: now(),
        }
        store.dispatch({ type: "UPSERT_JOB", job: runningJob })
      }, 400)

      // 进度条模拟
      let progress = 10
      const progressTimer = setInterval(() => {
        const current = store.getSnapshot().jobs[jobId]
        if (!current || current.status !== "running") return
        progress = Math.min(95, progress + 8 + Math.round(Math.random() * 8))
        store.dispatch({
          type: "UPSERT_JOB",
          job: { ...current, progress, updatedAt: now() },
        })
      }, 500)

      const doneAt = setTimeout(() => {
        clearInterval(progressTimer)
        clearTimeout(runningAt)

        const current = store.getSnapshot().jobs[jobId]
        if (!current) return

        if (fail) {
          store.dispatch({
            type: "UPSERT_JOB",
            job: {
              ...current,
              status: "failed",
              progress: 100,
              errorMessage: "Mock 生成失败：请调整参数后重试",
              updatedAt: now(),
            },
          })
          return
        }

        const assetId = genId("asset")
        const createdAt = now()

        const url =
          args.outputType === "image"
            ? args.inputImageDataUrl ||
              "https://dummyimage.com/1024x768/111827/ffffff.png&text=Mock+Image"
            : "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"

        const asset: Asset = {
          id: assetId,
          type: args.outputType,
          url,
          mime: args.outputType === "image" ? "image/png" : "video/mp4",
          createdAt,
        }

        store.dispatch({ type: "UPSERT_ASSET", asset })
        store.dispatch({
          type: "UPSERT_JOB",
          job: {
            ...current,
            status: "succeeded",
            progress: 100,
            output: { assetId },
            updatedAt: now(),
          },
        })
      }, args.outputType === "video" ? 3200 : 2200)

      return jobId
    },

    createDelivery(args: { assetId: string; price: number; currency?: "CNY" }) {
      const deliveryId = genId("delivery")
      const delivery: Delivery = {
        id: deliveryId,
        assetId: args.assetId,
        price: args.price,
        currency: args.currency ?? "CNY",
        createdAt: now(),
        downloadCount: 0,
      }
      store.dispatch({ type: "UPSERT_DELIVERY", delivery })
      return deliveryId
    },

    incDownload(deliveryId: string) {
      store.dispatch({ type: "INC_DOWNLOAD", deliveryId })
    },
  }
}

export function getMvpState() {
  return store.getSnapshot()
}
