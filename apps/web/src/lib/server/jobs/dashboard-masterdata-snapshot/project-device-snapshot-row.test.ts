import { describe, expect, it } from 'vitest'

import {
  hourlyOnlineHoursValue,
  hourlySnapshotRowId,
  isOnlineAtEnd,
} from './project-device-snapshot-row'

function sumOnlineHoursCap24Local(values: string[]): string {
  const total = values.reduce((s, v) => s + Number(v), 0)
  return String(Math.min(24, Math.max(0, total)))
}

describe('isOnlineAtEnd', () => {
  it('在线且非维修 → true', () => {
    expect(isOnlineAtEnd('在线', false)).toBe(true)
  })

  it('维修中覆盖 → false', () => {
    expect(isOnlineAtEnd('在线', true)).toBe(false)
  })
})

describe('hourlyOnlineHoursValue', () => {
  it('在线整小时为 1', () => {
    expect(hourlyOnlineHoursValue('在线', false)).toBe('1')
  })

  it('维护为 0', () => {
    expect(hourlyOnlineHoursValue('在线', true)).toBe('0')
  })
})

describe('hourlySnapshotRowId', () => {
  it('uses Shanghai hour key', () => {
    const hour = new Date('2026-05-28T06:00:00.000Z')
    expect(hourlySnapshotRowId(hour, 'dev-1')).toBe('2026-05-28T14:00:dev-1')
  })
})

describe('daily online hours cap', () => {
  it('caps at 24', () => {
    expect(sumOnlineHoursCap24Local(Array(30).fill('1'))).toBe('24')
  })
})
