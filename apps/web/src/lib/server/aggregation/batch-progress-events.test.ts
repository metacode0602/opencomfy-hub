import { describe, expect, it } from 'vitest'
import { BATCH_PROGRESS_EVENT_TYPE_LABELS } from './batch-progress-events'

describe('batch-progress-events', () => {
  it('covers all event type labels', () => {
    const types = [
      'batch_created',
      'plan_revised',
      'progress_synced',
      'status_changed',
      'batch_completed',
      'batch_cancelled',
    ] as const
    for (const t of types) {
      expect(BATCH_PROGRESS_EVENT_TYPE_LABELS[t]).toBeTruthy()
    }
  })
})
