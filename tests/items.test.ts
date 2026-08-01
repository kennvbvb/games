import { describe, it, expect } from 'vitest'
import { ITEMS, ITEM_BY_ID, ITEM_KINDS } from '../src/data/items'
import { buyItem, effectiveStats } from '../src/systems/upgrades'
import { createDefaultPlayerState } from '../src/state/playerState'
import { parsePlayerState } from '../src/state/validate'
import type { PlayerState } from '../src/types'

describe('shop items', () => {
  it('has unique ids and at least one level gate', () => {
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length)
    expect(ITEMS.some((i) => i.minLevel !== undefined)).toBe(true)
  })

  it('offers gear the whole way to the last world', () => {
    // A 60-stage campaign where the shop stops mattering after World 3 makes
    // gold pointless for two thirds of the run.
    const gates = ITEMS.map((i) => i.minLevel ?? 1).sort((a, b) => a - b)
    expect(Math.max(...gates)).toBeGreaterThanOrEqual(20)
    for (const band of [
      [1, 6],
      [7, 12],
      [13, 18],
      [19, 30],
    ]) {
      const inBand = ITEMS.filter((i) => (i.minLevel ?? 1) >= band[0] && (i.minLevel ?? 1) <= band[1])
      expect(inBand.length, `no gear gated in levels ${band[0]}-${band[1]}`).toBeGreaterThanOrEqual(3)
    }
  })

  it('gives every kind something in the late game', () => {
    for (const kind of ITEM_KINDS) {
      const late = ITEMS.filter((i) => i.kind === kind && (i.minLevel ?? 1) >= 15)
      expect(late.length, `${kind} has no late-game option`).toBeGreaterThanOrEqual(2)
    }
  })

  it('has no item that is simply better than a cheaper one', () => {
    // A piece that wins on every stat while costing less ends the slot as a
    // choice — which is the whole point of one item per slot. Affixes are
    // deliberately not counted here: they are the *reason* two similarly
    // statted pieces differ, so folding them in would let a dominant stat
    // block hide behind a weaker affix.
    const stats = (i: (typeof ITEMS)[number]) => [i.bonus.hp ?? 0, i.bonus.atk ?? 0, i.bonus.def ?? 0]
    for (const a of ITEMS) {
      for (const b of ITEMS) {
        if (a.id === b.id || a.kind !== b.kind) continue
        const [ah, aa, ad] = stats(a)
        const [bh, ba, bd] = stats(b)
        const betterEverywhere = ah >= bh && aa >= ba && ad >= bd && (ah > bh || aa > ba || ad > bd)
        const noDearer = a.cost <= b.cost && (a.minLevel ?? 1) <= (b.minLevel ?? 1)
        expect(betterEverywhere && noDearer, `${b.id} is strictly dominated by ${a.id}`).toBe(false)
      }
    }
  })

  it('keeps cost climbing with power', () => {
    const power = (i: (typeof ITEMS)[number]) =>
      (i.bonus.hp ?? 0) / 4 + (i.bonus.atk ?? 0) * 1.5 + (i.bonus.def ?? 0)
    const sorted = [...ITEMS].sort((a, b) => a.cost - b.cost)
    // Not strictly monotonic — same-tier alternates trade off — but the
    // cheapest third must not out-power the dearest third.
    const third = Math.floor(sorted.length / 3)
    const cheapest = Math.max(...sorted.slice(0, third).map(power))
    const dearest = Math.min(...sorted.slice(-third).map(power))
    expect(cheapest).toBeLessThan(dearest)
  })

  it('buying deducts gold and adds the item once', () => {
    const state = { ...createDefaultPlayerState(), gold: 100 }
    const next = buyItem(state, 'wooden-sword')
    expect(next).not.toBeNull()
    expect(next!.gold).toBe(100 - ITEM_BY_ID.get('wooden-sword')!.cost)
    expect(next!.ownedItemIds).toEqual(['wooden-sword'])
    expect(buyItem(next!, 'wooden-sword')).toBeNull()
  })

  it('refuses level-locked items until the player reaches the required level', () => {
    const rich = { ...createDefaultPlayerState(), gold: 99999 }
    expect(buyItem(rich, 'heros-emblem')).toBeNull()
    const leveled = { ...rich, level: 20 }
    expect(buyItem(leveled, 'heros-emblem')).not.toBeNull()
  })

  it('refuses purchases the player cannot afford', () => {
    const broke = { ...createDefaultPlayerState(), gold: 1 }
    expect(buyItem(broke, 'wooden-sword')).toBeNull()
  })

  it('only equipped items contribute to effective stats', () => {
    const state = createDefaultPlayerState()
    const base = effectiveStats(state)
    const ring = ITEM_BY_ID.get('ruby-ring')!

    // Owning it is not enough — it has to be worn.
    const owned = { ...state, ownedItemIds: ['ruby-ring'] }
    expect(effectiveStats(owned)).toEqual(base)

    const worn = effectiveStats({ ...owned, equipped: { ...state.equipped, accessory1: 'ruby-ring' } })
    expect(worn.maxHp).toBe(base.maxHp + (ring.bonus.hp ?? 0))
    expect(worn.atk).toBe(base.atk + (ring.bonus.atk ?? 0))
    expect(worn.def).toBe(base.def)
  })

  it('normalizes old saves missing avatar and ownedItemIds', () => {
    const old = createDefaultPlayerState('Vet') as Partial<PlayerState>
    delete old.avatar
    delete old.ownedItemIds
    const migrated = parsePlayerState(old)!
    expect(migrated.avatar).toBe('cat')
    expect(migrated.ownedItemIds).toEqual([])
  })

  it('migrates avatars saved as raw emoji to texture ids', () => {
    const withAvatar = (avatar: string) => parsePlayerState({ name: 'Vet', level: 1, avatar })!.avatar
    expect(withAvatar('🦊')).toBe('fox')
    expect(withAvatar('🐼')).toBe('panda')
    // Already-migrated and unknown values both stay valid.
    expect(withAvatar('frog')).toBe('frog')
    expect(withAvatar('🍕')).toBe('cat')
  })
})
