import { describe, it, expect } from 'vitest'
import { computeOfflineRewards, formatDuration } from '../src/systems/idle'
import { stageOutlook } from '../src/systems/difficulty'
import { createDefaultPlayerState } from '../src/state/playerState'
import { parsePlayerState } from '../src/state/validate'
import { STAGES } from '../src/data/stages'
import { BALANCE } from '../src/data/balance'
import type { PlayerState } from '../src/types'

const HOUR = 60 * 60 * 1000
const NOW = 1_800_000_000_000

/** A hero strong enough to farm the given stage comfortably. */
function farmer(stageId: string, level = 12): PlayerState {
  const base = createDefaultPlayerState('Idler')
  return {
    ...base,
    level,
    stats: { maxHp: 50 + (level - 1) * 12, atk: 10 + (level - 1) * 3, def: 4 + (level - 1) * 1 },
    idle: { farmingStageId: stageId, lastSeenAt: NOW - 2 * HOUR },
  }
}

describe('offline rewards', () => {
  it('pays nothing when no stage is being farmed', () => {
    const state = { ...createDefaultPlayerState(), idle: { farmingStageId: null, lastSeenAt: NOW - HOUR } }
    expect(computeOfflineRewards(state, NOW)).toBeNull()
  })

  it('pays nothing for a very short absence', () => {
    const state = farmer('stage-1')
    state.idle.lastSeenAt = NOW - 5_000
    expect(computeOfflineRewards(state, NOW)).toBeNull()
  })

  it('pays out proportionally to time away', () => {
    const oneHour = computeOfflineRewards({ ...farmer('stage-1'), idle: { farmingStageId: 'stage-1', lastSeenAt: NOW - HOUR } }, NOW)!
    const twoHours = computeOfflineRewards(farmer('stage-1'), NOW)!
    expect(oneHour.rewards.gold).toBeGreaterThan(0)
    expect(twoHours.battles).toBe(oneHour.battles * 2)
    expect(twoHours.rewards.gold).toBe(oneHour.rewards.gold * 2)
  })

  it('caps very long absences and flags them', () => {
    const away = { ...farmer('stage-1'), idle: { farmingStageId: 'stage-1', lastSeenAt: NOW - 48 * HOUR } }
    const report = computeOfflineRewards(away, NOW)!
    expect(report.capped).toBe(true)
    expect(report.creditedMs).toBe(BALANCE.idle.maxOfflineMs)
    expect(report.elapsedMs).toBeGreaterThan(report.creditedMs)

    const atCap = { ...farmer('stage-1'), idle: { farmingStageId: 'stage-1', lastSeenAt: NOW - 8 * HOUR } }
    expect(computeOfflineRewards(away, NOW)!.rewards).toEqual(computeOfflineRewards(atCap, NOW)!.rewards)
  })

  it('pays nothing when the farmed stage can no longer be won', () => {
    const weak = { ...createDefaultPlayerState(), idle: { farmingStageId: 'stage-12', lastSeenAt: NOW - 4 * HOUR } }
    expect(computeOfflineRewards(weak, NOW)).toBeNull()
  })

  it('pays nothing for an unknown stage id', () => {
    const state = { ...farmer('stage-1'), idle: { farmingStageId: 'stage-999', lastSeenAt: NOW - 4 * HOUR } }
    expect(computeOfflineRewards(state, NOW)).toBeNull()
  })

  it('ignores a future lastSeenAt rather than minting rewards', () => {
    // The validator is what defends this, so go through it like a real load does.
    const tampered = parsePlayerState({
      ...farmer('stage-1'),
      idle: { farmingStageId: 'stage-1', lastSeenAt: NOW + 100 * HOUR },
    })!
    expect(tampered.idle.lastSeenAt).toBeLessThanOrEqual(Date.now())
  })

  it('formats durations readably', () => {
    expect(formatDuration(30_000)).toBe('1m')
    expect(formatDuration(45 * 60_000)).toBe('45m')
    expect(formatDuration(2 * HOUR)).toBe('2h')
    expect(formatDuration(2 * HOUR + 15 * 60_000)).toBe('2h 15m')
  })
})

describe('stage outlook', () => {
  it('rates the first stage easy for a strong hero and hard for a weak one', () => {
    const strong = farmer('stage-1', 20)
    const weak = createDefaultPlayerState()
    expect(stageOutlook(strong, STAGES[0]).tier).toBe('easy')
    expect(stageOutlook(weak, STAGES[11]).tier).toBe('hard')
  })

  it('marks a losing fight as hard and not winnable', () => {
    const outlook = stageOutlook(createDefaultPlayerState(), STAGES[11])
    expect(outlook.willWin).toBe(false)
    expect(outlook.tier).toBe('hard')
  })

  it('reports remaining HP within 0..1', () => {
    for (const stage of STAGES) {
      const { hpRemaining } = stageOutlook(farmer('stage-1', 10), stage)
      expect(hpRemaining).toBeGreaterThanOrEqual(0)
      expect(hpRemaining).toBeLessThanOrEqual(1)
    }
  })
})
