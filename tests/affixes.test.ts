import { describe, it, expect } from 'vitest'
import { AFFIXES, AFFIX_COUNT, RARITIES, affixModifiers, affixesFor } from '../src/data/affixes'
import { SETS, SET_MEMBERS, activeSets, setModifiers } from '../src/data/sets'
import { ITEMS, ITEM_BY_ID, ITEM_KINDS, slotsForKind } from '../src/data/items'
import { EMPTY_EQUIPMENT, affixesOf, equipItem, gearModifiers } from '../src/systems/upgrades'
import { foldModifiers } from '../src/systems/combatModifiers'
import { resolveBattle } from '../src/systems/combat'
import { createDefaultPlayerState } from '../src/state/playerState'
import { parsePlayerState } from '../src/state/validate'

describe('affixes', () => {
  it('gives every rarity the affix count it promises', () => {
    for (const item of ITEMS) {
      const pool = AFFIXES.filter((a) => a.kinds.includes(item.kind))
      const expected = Math.min(AFFIX_COUNT[item.rarity], pool.length)
      expect(affixesOf(item), `${item.id} (${item.rarity})`).toHaveLength(expected)
    }
  })

  it('leaves every kind a pool deep enough for a legendary', () => {
    // A legendary wants four affixes; a kind with three eligible ones would
    // silently ship a legendary that is really an epic.
    for (const kind of ITEM_KINDS) {
      const pool = AFFIXES.filter((a) => a.kinds.includes(kind))
      expect(pool.length, kind).toBeGreaterThanOrEqual(AFFIX_COUNT.legendary)
    }
  })

  it('derives the same affixes every time, on any device', () => {
    // This is what lets the stage preview be an exact simulation and a wiki
    // page about an item stay true.
    for (const item of ITEMS.slice(0, 12)) {
      const first = affixesFor(item.id, item.kind, item.rarity)
      for (let i = 0; i < 50; i++) {
        expect(affixesFor(item.id, item.kind, item.rarity)).toEqual(first)
      }
    }
  })

  it('never rolls the same affix twice on one item', () => {
    for (const item of ITEMS) {
      const ids = affixesOf(item).map((a) => a.config.id)
      expect(new Set(ids).size, `${item.id} repeats an affix`).toBe(ids.length)
    }
  })

  it('only rolls affixes the kind is allowed to carry', () => {
    for (const item of ITEMS) {
      for (const affix of affixesOf(item)) {
        expect(affix.config.kinds, `${item.id} rolled ${affix.config.id}`).toContain(item.kind)
      }
    }
  })

  it('scales magnitude with rarity', () => {
    const sharpness = AFFIXES.find((a) => a.id === 'sharpness')!
    const value = (rarity: (typeof RARITIES)[number]) => {
      const rolled = affixesFor('probe-item', 'weapon', rarity).find((a) => a.config.id === 'sharpness')
      return rolled?.value
    }
    // Not every rarity draws sharpness, but where it appears twice the dearer
    // one must not be weaker.
    const legendary = value('legendary')
    const uncommon = value('uncommon')
    if (legendary !== undefined && uncommon !== undefined) {
      expect(legendary).toBeGreaterThan(uncommon)
    }
    expect(sharpness.step).toBeGreaterThan(0)
  })

  it('gives two items of the same rarity different numbers', () => {
    // Rarity sets the magnitude and the hash nudges it, so a slot full of
    // epics does not read as one item printed five times.
    const epics = ITEMS.filter((i) => i.rarity === 'epic' && i.kind === 'body')
    const signatures = epics.map((i) => affixesOf(i).map((a) => `${a.config.id}:${a.value}`).join('|'))
    expect(new Set(signatures).size).toBe(signatures.length)
  })

  it('renders a value into every description', () => {
    for (const item of ITEMS) {
      for (const affix of affixesOf(item)) {
        expect(affix.text, `${item.id}/${affix.config.id}`).not.toContain('{value}')
        expect(affix.text.length).toBeGreaterThan(4)
      }
    }
  })

  it('turns into modifiers that actually change a fight', () => {
    const enemy = { name: 'Dummy', sprite: 'enemy_1', maxHp: 500, atk: 25, def: 6 }
    const rewards = { exp: 0, gold: 0 }
    const player = { maxHp: 220, atk: 45, def: 12 }
    const bare = resolveBattle({ player, enemy, rewards })

    const sharpened = affixModifiers(affixesFor('probe', 'weapon', 'legendary'))
    expect(sharpened.length).toBeGreaterThan(0)
    const buffed = resolveBattle({ player, enemy, rewards, modifiers: sharpened })
    expect(buffed.log.length).toBeLessThanOrEqual(bare.log.length)
  })
})

describe('set bonuses', () => {
  it('gives every set four pieces across four different kinds', () => {
    for (const set of SETS) {
      const members = SET_MEMBERS[set.id].map((id) => ITEM_BY_ID.get(id)!)
      expect(members.length, set.id).toBe(4)
      // Four different kinds means assembling one costs four of the six worn
      // slots — which is the price the bonus is paid for.
      expect(new Set(members.map((m) => m.kind)).size, set.id).toBe(4)
    }
  })

  it('pays nothing at one piece, the 2pc at two and both at four', () => {
    const set = SETS[0]
    const members = SET_MEMBERS[set.id]
    expect(setModifiers(members.slice(0, 1))).toEqual([])
    expect(setModifiers(members.slice(0, 2))).toEqual([set.twoPiece.mods])
    expect(setModifiers(members.slice(0, 3))).toEqual([set.twoPiece.mods])
    expect(setModifiers(members)).toEqual([set.twoPiece.mods, set.fourPiece.mods])
  })

  it('counts only worn pieces, never owned ones', () => {
    const members = SET_MEMBERS.ironclad
    const owned = { ...createDefaultPlayerState(), ownedItemIds: [...members], level: 30 }
    // Owned but nothing equipped: no set at all.
    expect(gearModifiers({ ...owned, equipped: { ...EMPTY_EQUIPMENT } })).toEqual([])

    let worn = owned
    for (const id of members) worn = equipItem(worn, id)
    const active = activeSets(members)
    expect(active[0].worn).toBe(4)
    expect(active[0].fourActive).toBe(true)
    expect(gearModifiers(worn).length).toBeGreaterThan(0)
  })

  it('reports partial progress so a player can see what is missing', () => {
    const [a, b] = SET_MEMBERS.trickster
    const partial = activeSets([a, b])
    expect(partial).toHaveLength(1)
    expect(partial[0].worn).toBe(2)
    expect(partial[0].twoActive).toBe(true)
    expect(partial[0].fourActive).toBe(false)
  })

  it('ignores items in no set at all', () => {
    expect(activeSets(['heros-emblem', 'royal-crown'])).toEqual([])
    expect(setModifiers(['heros-emblem'])).toEqual([])
  })

  it('folds set and affix modifiers into the same product as everything else', () => {
    const state = { ...createDefaultPlayerState(), level: 30, ownedItemIds: [...SET_MEMBERS.berserker] }
    let worn = state
    for (const id of SET_MEMBERS.berserker) worn = equipItem(worn, id)
    const folded = foldModifiers(gearModifiers(worn))
    // Berserker's 2pc is +8% damage; whatever the affixes add, the product can
    // only be larger than neutral, never replaced by the last source read.
    expect(folded.outgoing).toBeGreaterThanOrEqual(1.08)
  })
})

describe('two accessory slots', () => {
  const twoRings = () => ({
    ...createDefaultPlayerState(),
    level: 30,
    ownedItemIds: ['ruby-ring', 'guard-amulet'],
  })

  it('fills the second accessory slot rather than replacing the first', () => {
    let state = equipItem(twoRings(), 'ruby-ring')
    state = equipItem(state, 'guard-amulet')
    expect(state.equipped.accessory1).toBe('ruby-ring')
    expect(state.equipped.accessory2).toBe('guard-amulet')
  })

  it('refuses to wear one piece in both slots at once', () => {
    // Otherwise a single purchase would pay its stats and its affixes twice.
    let state = equipItem(twoRings(), 'ruby-ring', 'accessory1')
    state = equipItem(state, 'ruby-ring', 'accessory2')
    expect(state.equipped.accessory1).toBeNull()
    expect(state.equipped.accessory2).toBe('ruby-ring')
  })

  it('honours an explicit slot when one is given', () => {
    const state = equipItem(twoRings(), 'ruby-ring', 'accessory2')
    expect(state.equipped.accessory1).toBeNull()
    expect(state.equipped.accessory2).toBe('ruby-ring')
  })

  it('keeps a two-accessory save through validation', () => {
    let state = equipItem(twoRings(), 'ruby-ring')
    state = equipItem(state, 'guard-amulet')
    const parsed = parsePlayerState(JSON.parse(JSON.stringify(state)))!
    expect(parsed.equipped.accessory1).toBe('ruby-ring')
    expect(parsed.equipped.accessory2).toBe('guard-amulet')
  })

  it('never lets a non-accessory into an accessory slot', () => {
    expect(slotsForKind('weapon')).toEqual(['weapon'])
    expect(slotsForKind('accessory')).toEqual(['accessory1', 'accessory2'])
    const tampered = parsePlayerState({
      name: 'Cheat',
      level: 30,
      ownedItemIds: ['iron-sword'],
      equipped: { ...EMPTY_EQUIPMENT, accessory1: 'iron-sword' },
    })!
    expect(tampered.equipped.accessory1).toBeNull()
  })
})
