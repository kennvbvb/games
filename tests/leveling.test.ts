import { describe, it, expect } from 'vitest'
import { expToNext, statsForLevel, applyExp } from '../src/systems/leveling'
import { createDefaultPlayerState } from '../src/state/playerState'

describe('leveling', () => {
  it('computes an increasing exp curve', () => {
    expect(expToNext(2)).toBeGreaterThan(expToNext(1))
    expect(expToNext(5)).toBeGreaterThan(expToNext(4))
  })

  it('grants higher stats at higher levels', () => {
    const lvl1 = statsForLevel(1)
    const lvl5 = statsForLevel(5)
    expect(lvl5.maxHp).toBeGreaterThan(lvl1.maxHp)
    expect(lvl5.atk).toBeGreaterThan(lvl1.atk)
    expect(lvl5.def).toBeGreaterThan(lvl1.def)
  })

  it('levels up once when exp exactly meets the threshold', () => {
    const state = createDefaultPlayerState()
    const threshold = expToNext(1)
    const leveled = applyExp(state, threshold)
    expect(leveled.level).toBe(2)
    expect(leveled.exp).toBe(0)
  })

  it('handles multiple level-ups from one large exp gain', () => {
    const state = createDefaultPlayerState()
    const bigExp = expToNext(1) + expToNext(2) + expToNext(3) + 5
    const leveled = applyExp(state, bigExp)
    expect(leveled.level).toBe(4)
    expect(leveled.exp).toBe(5)
  })

  it('carries over leftover exp below the next threshold', () => {
    const state = createDefaultPlayerState()
    const leveled = applyExp(state, expToNext(1) - 1)
    expect(leveled.level).toBe(1)
    expect(leveled.exp).toBe(expToNext(1) - 1)
  })
})
