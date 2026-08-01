import { describe, it, expect } from 'vitest'
import { ITEMS, ITEMS_BY_KIND, ITEM_BY_ID, ITEM_KINDS, itemsForSlot } from '../src/data/items'
import {
  EMPTY_EQUIPMENT,
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
  it('gives every kind a ladder, and every worn slot something to put in it', () => {
    expect(ITEMS.every((i) => ITEM_KINDS.includes(i.kind))).toBe(true)
    for (const kind of ITEM_KINDS) {
      expect(ITEMS_BY_KIND[kind].length, kind).toBeGreaterThanOrEqual(7)
    }
    expect(ITEM_KINDS.reduce((n, k) => n + ITEMS_BY_KIND[k].length, 0)).toBe(ITEMS.length)
    // Six worn slots, and the two accessory ones share a kind.
    expect(EQUIP_SLOTS).toHaveLength(6)
    for (const slot of EQUIP_SLOTS) expect(itemsForSlot(slot).length).toBeGreaterThan(0)
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
    expect(state.equipped).toEqual({
      ...EMPTY_EQUIPMENT,
      weapon: 'iron-sword',
      body: 'leather-shield',
    })
    // The replaced weapon is still owned, just not worn.
    expect(state.ownedItemIds).toContain('wooden-sword')
  })

  it('only counts worn gear towards stats', () => {
    let state = buyItem(rich(), 'wooden-sword')!
    state = buyItem(state, 'iron-sword')!
    const wornOnly = effectiveStats(state)

    // Both swords are owned; only the iron one should be contributing.
    const base = effectiveStats({ ...state, equipped: { ...EMPTY_EQUIPMENT } })
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
    expect(equipped.body).toBe('leather-shield')
    expect(equipped.accessory1).toBe('lucky-ribbon')
  })

  it('fills both accessory slots with the two dearest trinkets', () => {
    // Dearest first, not first-in-list first: otherwise the two slots take
    // whichever two happened to be bought earliest.
    const equipped = bestOwnedPerSlot(['lucky-ribbon', 'ruby-ring', 'wizard-orb'])
    expect(equipped.accessory1).toBe('wizard-orb')
    expect(equipped.accessory2).toBe('ruby-ring')
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
    expect(migrated.equipped.head).toBe('cozy-hat')
    expect(migrated.equipped.body).toBeNull()
  })

  it('carries a three-slot save across to six without dropping a piece', () => {
    // Armour becomes body and the charm becomes the first accessory, so a
    // returning player finds everything still worn and two new slots empty —
    // rather than an unexplained stat drop and a bag full of gear.
    const v12 = {
      name: 'Vet',
      level: 20,
      ownedItemIds: ['iron-sword', 'knight-armor', 'ruby-ring'],
      equipped: { weapon: 'iron-sword', armor: 'knight-armor', charm: 'ruby-ring' },
    }
    const migrated = parsePlayerState(v12)!
    expect(migrated.equipped).toEqual({
      ...EMPTY_EQUIPMENT,
      weapon: 'iron-sword',
      body: 'knight-armor',
      accessory1: 'ruby-ring',
    })
  })

  it('drops equipped ids that are not owned or sit in the wrong slot', () => {
    const tampered = {
      name: 'Cheater',
      level: 5,
      ownedItemIds: ['wooden-sword'],
      equipped: { weapon: 'dragonfang', body: 'wooden-sword', accessory1: 'nonsense' },
    }
    const parsed = parsePlayerState(tampered)!
    expect(parsed.equipped.weapon).toBeNull() // not owned
    expect(parsed.equipped.body).toBeNull() // owned, but it's a weapon
    expect(parsed.equipped.accessory1).toBeNull()
  })

  it('keeps a valid equipped block untouched', () => {
    const state = buyItem(rich(), 'iron-sword')!
    expect(parsePlayerState(state)!.equipped.weapon).toBe('iron-sword')
  })
})
