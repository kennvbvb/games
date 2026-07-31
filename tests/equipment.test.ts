import { describe, it, expect } from 'vitest'
import { ITEMS, ITEMS_BY_SLOT, ITEM_BY_ID } from '../src/data/items'
import {
  EQUIP_SLOTS,
  bestOwnedPerSlot,
  buyItem,
  effectiveStats,
  equipItem,
  equippedItems,
  unequipSlot,
} from '../src/systems/upgrades'
import { createDefaultPlayerState } from '../src/state/playerState'
import { parsePlayerState } from '../src/state/validate'

const rich = () => ({ ...createDefaultPlayerState('Smith'), gold: 99999, level: 30 })

describe('equipment data', () => {
  it('gives every item a slot and every slot a ladder', () => {
    expect(ITEMS.every((i) => EQUIP_SLOTS.includes(i.slot))).toBe(true)
    for (const slot of EQUIP_SLOTS) {
      expect(ITEMS_BY_SLOT[slot].length).toBeGreaterThanOrEqual(5)
    }
    expect(ITEMS_BY_SLOT.weapon.length + ITEMS_BY_SLOT.armor.length + ITEMS_BY_SLOT.charm.length).toBe(ITEMS.length)
  })
})

describe('equipping', () => {
  it('wears a newly bought item straight away', () => {
    const bought = buyItem(rich(), 'wooden-sword')!
    expect(bought.equipped.weapon).toBe('wooden-sword')
    expect(bought.ownedItemIds).toContain('wooden-sword')
  })

  it('replaces only the matching slot', () => {
    let state = buyItem(rich(), 'wooden-sword')!
    state = buyItem(state, 'leather-shield')!
    state = buyItem(state, 'iron-sword')!
    expect(state.equipped).toEqual({ weapon: 'iron-sword', armor: 'leather-shield', charm: null })
    // The replaced weapon is still owned, just not worn.
    expect(state.ownedItemIds).toContain('wooden-sword')
  })

  it('only counts worn gear towards stats', () => {
    let state = buyItem(rich(), 'wooden-sword')!
    state = buyItem(state, 'iron-sword')!
    const wornOnly = effectiveStats(state)

    // Both swords are owned; only the iron one should be contributing.
    const base = effectiveStats({ ...state, equipped: { weapon: null, armor: null, charm: null } })
    expect(wornOnly.atk).toBe(base.atk + (ITEM_BY_ID.get('iron-sword')!.bonus.atk ?? 0))
  })

  it('swapping back to an older piece lowers stats — the trade-off is real', () => {
    let state = buyItem(rich(), 'iron-sword')!
    const strong = effectiveStats(state).atk
    state = buyItem(state, 'wooden-sword')!
    state = equipItem(state, 'wooden-sword')
    expect(effectiveStats(state).atk).toBeLessThan(strong)
  })

  it('refuses to equip something the player does not own', () => {
    const state = rich()
    expect(equipItem(state, 'dragonfang').equipped.weapon).toBeNull()
  })

  it('unequips a slot', () => {
    const state = buyItem(rich(), 'wooden-sword')!
    const bare = unequipSlot(state, 'weapon')
    expect(bare.equipped.weapon).toBeNull()
    expect(equippedItems(bare)).toHaveLength(0)
  })
})

describe('migration from pre-equipment saves', () => {
  it('auto-equips the best owned item per slot so nobody loses stats', () => {
    const owned = ['wooden-sword', 'iron-sword', 'leather-shield', 'lucky-ribbon']
    const equipped = bestOwnedPerSlot(owned)
    expect(equipped.weapon).toBe('iron-sword') // pricier than the wooden one
    expect(equipped.armor).toBe('leather-shield')
    expect(equipped.charm).toBe('lucky-ribbon')
  })

  it('fills slots when loading a save that predates equipment', () => {
    const legacy = {
      name: 'Vet',
      level: 12,
      gold: 100,
      ownedItemIds: ['knight-blade', 'wooden-sword', 'cozy-hat'],
      // no `equipped` block at all
    }
    const migrated = parsePlayerState(legacy)!
    expect(migrated.equipped.weapon).toBe('knight-blade')
    expect(migrated.equipped.armor).toBe('cozy-hat')
    expect(migrated.equipped.charm).toBeNull()
  })

  it('drops equipped ids that are not owned or sit in the wrong slot', () => {
    const tampered = {
      name: 'Cheater',
      level: 5,
      ownedItemIds: ['wooden-sword'],
      equipped: { weapon: 'dragonfang', armor: 'wooden-sword', charm: 'nonsense' },
    }
    const parsed = parsePlayerState(tampered)!
    expect(parsed.equipped.weapon).toBeNull() // not owned
    expect(parsed.equipped.armor).toBeNull() // owned, but it's a weapon
    expect(parsed.equipped.charm).toBeNull()
  })

  it('keeps a valid equipped block untouched', () => {
    const state = buyItem(rich(), 'iron-sword')!
    expect(parsePlayerState(state)!.equipped.weapon).toBe('iron-sword')
  })
})
