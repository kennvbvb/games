import { describe, it, expect } from 'vitest'
import { upgradeCost, buyUpgrade, effectiveStats } from '../src/systems/upgrades'
import { createDefaultPlayerState } from '../src/state/playerState'
import { parsePlayerState } from '../src/state/validate'
import { BALANCE } from '../src/data/balance'
import type { PlayerState } from '../src/types'

describe('upgrades', () => {
  it('costs grow with each purchase', () => {
    expect(upgradeCost('hp', 1)).toBeGreaterThan(upgradeCost('hp', 0))
    expect(upgradeCost('atk', 5)).toBeGreaterThan(upgradeCost('atk', 4))
  })

  it('buying deducts gold and increments the owned count', () => {
    const state = { ...createDefaultPlayerState(), gold: 100 }
    const next = buyUpgrade(state, 'atk')
    expect(next).not.toBeNull()
    expect(next!.gold).toBe(100 - upgradeCost('atk', 0))
    expect(next!.upgrades.atk).toBe(1)
    expect(next!.upgrades.hp).toBe(0)
  })

  it('refuses a purchase the player cannot afford', () => {
    const state = { ...createDefaultPlayerState(), gold: 0 }
    expect(buyUpgrade(state, 'hp')).toBeNull()
  })

  it('effective stats include purchased bonuses', () => {
    const state = createDefaultPlayerState()
    const base = effectiveStats(state)
    const boosted = effectiveStats({ ...state, upgrades: { hp: 2, atk: 1, def: 3 } })
    expect(boosted.maxHp).toBe(base.maxHp + 2 * BALANCE.upgrades.hp.bonus)
    expect(boosted.atk).toBe(base.atk + 1 * BALANCE.upgrades.atk.bonus)
    expect(boosted.def).toBe(base.def + 3 * BALANCE.upgrades.def.bonus)
  })

  it('normalizes old saves that lack the upgrades field', () => {
    const old = createDefaultPlayerState('Vet') as Partial<PlayerState>
    delete old.upgrades
    const migrated = parsePlayerState({ ...old, level: 3 })!
    expect(migrated.upgrades).toEqual({ hp: 0, atk: 0, def: 0 })
    expect(migrated.level).toBe(3)
    expect(migrated.stats.atk).toBeGreaterThan(createDefaultPlayerState().stats.atk)
  })
})
