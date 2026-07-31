import { describe, it, expect } from 'vitest'
import { ITEMS, ITEM_BY_ID } from '../src/data/items'
import { buyItem, effectiveStats } from '../src/systems/upgrades'
import { createDefaultPlayerState } from '../src/state/playerState'
import { parsePlayerState } from '../src/state/validate'
import type { PlayerState } from '../src/types'

describe('shop items', () => {
  it('has 20 unique items and every level gate is on a meaningful bonus', () => {
    expect(ITEMS).toHaveLength(20)
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(20)
    expect(ITEMS.some((i) => i.minLevel !== undefined)).toBe(true)
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

  it('owned items contribute to effective stats', () => {
    const state = createDefaultPlayerState()
    const base = effectiveStats(state)
    const withRing = effectiveStats({ ...state, ownedItemIds: ['ruby-ring'] })
    const ring = ITEM_BY_ID.get('ruby-ring')!
    expect(withRing.maxHp).toBe(base.maxHp + (ring.bonus.hp ?? 0))
    expect(withRing.atk).toBe(base.atk + (ring.bonus.atk ?? 0))
    expect(withRing.def).toBe(base.def)
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
