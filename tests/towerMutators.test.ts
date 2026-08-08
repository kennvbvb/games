import { describe, it, expect } from 'vitest'
import {
  FLOORS_PER_BAND,
  TOWER_MUTATORS,
  WARDED_DEFENCE,
  bandOfFloor,
  bandStart,
  isCheckpointFloor,
  mutatorForFloor,
  mutatorForStageId,
} from '../src/data/towerMutators'
import { TOWER_RELIC_FLOORS, grantFloorRelic, relicForFloor } from '../src/systems/tower'
import { isTowerBossFloor, towerEnemy, towerFloor } from '../src/data/tower'
import { ITEMS, ITEM_BY_ID, SHOP_ITEMS } from '../src/data/items'
import { buildOf } from '../src/data/builds'
import { NEUTRAL, foldModifiers } from '../src/systems/combatModifiers'
import { resolveBattle } from '../src/systems/combat'
import { playerBattleInputs } from '../src/systems/playerBattle'
import { createDefaultPlayerState } from '../src/state/playerState'
import { statsForLevel } from '../src/systems/leveling'
import { buyItem, effectiveStats } from '../src/systems/upgrades'
import type { PlayerState } from '../src/types'

function geared(patch: Partial<PlayerState> = {}): PlayerState {
  const base = createDefaultPlayerState('Climb')
  return {
    ...base,
    level: 40,
    gold: 999999,
    stats: statsForLevel(40, base.raceId),
    ...patch,
  }
}

describe('tower bands', () => {
  it('changes the rule every five floors, and nowhere else', () => {
    for (let floor = 1; floor <= 40; floor += 1) {
      expect(bandOfFloor(floor)).toBe(Math.ceil(floor / FLOORS_PER_BAND))
      // Inside a band, every floor answers to the same rule.
      expect(mutatorForFloor(floor).id).toBe(mutatorForFloor(bandStart(floor)).id)
    }
    expect(mutatorForFloor(FLOORS_PER_BAND).id).not.toBe(mutatorForFloor(FLOORS_PER_BAND + 1).id)
  })

  it('puts a checkpoint at the head of every band and nowhere else', () => {
    for (let floor = 1; floor <= 40; floor += 1) {
      expect(isCheckpointFloor(floor), `floor ${floor}`).toBe((floor - 1) % FLOORS_PER_BAND === 0)
    }
  })

  it('opens on a band with no rule, so a first climb is not a puzzle', () => {
    expect(mutatorForFloor(1).id).toBe('open')
    expect(foldModifiers([mutatorForFloor(1).mods ?? {}])).toEqual(NEUTRAL)
  })

  it('gives every other band a rule that actually does something', () => {
    for (const mutator of TOWER_MUTATORS.filter((m) => m.id !== 'open')) {
      const changesPlayer = mutator.mods !== undefined && foldModifiers([mutator.mods]) !== NEUTRAL
      const changesEnemy = mutator.enemyDefBonus !== undefined
      const changesGear = mutator.silenceAccessories === true
      expect(changesPlayer || changesEnemy || changesGear, mutator.id).toBe(true)
    }
  })

  it('cycles rather than running out', () => {
    const cycle = TOWER_MUTATORS.length * FLOORS_PER_BAND
    for (const floor of [1, 7, 13, 19]) {
      expect(mutatorForFloor(floor).id).toBe(mutatorForFloor(floor + cycle).id)
    }
  })

  it('reads the rule off a floor id, never off the player', () => {
    expect(mutatorForStageId('tower-7')!.id).toBe(mutatorForFloor(7).id)
    expect(mutatorForStageId('stage-7')).toBeUndefined()
    expect(mutatorForStageId('rift-3')).toBeUndefined()
    expect(mutatorForStageId('tower-nonsense')).toBeUndefined()
  })
})

describe('what each rule does to a fight', () => {
  it('Warded armours the floor, and only the warded floors', () => {
    // Floor 5 closes the open band and floor 6 opens the warded one, so one
    // floor apart the defence jumps by exactly the rule and nothing else.
    expect(mutatorForFloor(5).id).toBe('open')
    expect(mutatorForFloor(6).id).toBe('warded')
    expect(mutatorForFloor(1).enemyDefBonus).toBeUndefined()
    expect(towerEnemy(6).def - towerEnemy(5).def).toBeGreaterThanOrEqual(WARDED_DEFENCE)
  })

  it('adds exactly what a committed Breaker build strips, and no more', () => {
    // The rule *is* this equality: bring the answer and the band is cancelled
    // outright. Pinned so neither number can move without the other.
    const pierceAvailable =
      (ITEM_BY_ID.get('void-pike')!.effect!.mods.pierce ?? 0) + (buildOf('breaker').resonance.pierce ?? 0)
    expect(WARDED_DEFENCE).toBe(pierceAvailable)
  })

  it('never scales the armour, because scaling it walls the low-attack kin', () => {
    // A multiplier was measured and rejected: even x1.10 pushed Dwarf onto the
    // minimum-1 damage floor two bands in. Flat is the guarantee, so this is
    // worth a test rather than only a comment.
    for (const mutator of TOWER_MUTATORS) {
      expect(Object.keys(mutator), mutator.id).not.toContain('enemyDefScale')
    }
    // And the cost of the rule is the same absolute number on every floor.
    for (const floor of [6, 26, 46, 66]) {
      expect(mutatorForFloor(floor).id).toBe('warded')
      expect(mutatorForFloor(floor).enemyDefBonus).toBe(WARDED_DEFENCE)
    }
  })

  it('Charmless silences both accessories, stats and effect alike', () => {
    const floor = [11, 12, 13, 14, 15].find((f) => mutatorForFloor(f).id === 'charmless')!
    const base = geared()
    const withCharms: PlayerState = {
      ...base,
      ownedItemIds: ['spring-totem', 'guard-amulet'],
      equipped: { ...base.equipped, accessory1: 'spring-totem', accessory2: 'guard-amulet' },
    }

    const normal = playerBattleInputs(withCharms, towerFloor(1))
    const silenced = playerBattleInputs(withCharms, towerFloor(floor))

    // Stats drop back to the bare hero's...
    expect(silenced.player).toEqual(effectiveStats(base))
    expect(normal.player.maxHp).toBeGreaterThan(silenced.player.maxHp)
    // ...and the relic's named effect goes with them.
    const totemHeal = ITEM_BY_ID.get('spring-totem')!.effect!.mods.heal!
    expect(foldModifiers(normal.modifiers!).heal).toBeGreaterThanOrEqual(totemHeal)
    expect(foldModifiers(silenced.modifiers!).heal).toBe(0)
  })

  it('Charmless leaves the other four slots alone', () => {
    const floor = [11, 12, 13, 14, 15].find((f) => mutatorForFloor(f).id === 'charmless')!
    const base = geared()
    const armed: PlayerState = {
      ...base,
      ownedItemIds: ['worldbreaker'],
      equipped: { ...base.equipped, weapon: 'worldbreaker' },
    }
    expect(playerBattleInputs(armed, towerFloor(floor)).player.atk).toBe(effectiveStats(armed).atk)
  })

  it('Withered halves healing and the opening shield together', () => {
    const player = { maxHp: 400, atk: 40, def: 10 }
    const enemy = { name: 'W', sprite: 'enemy_1', maxHp: 900, atk: 30, def: 5 }
    const rewards = { exp: 0, gold: 0 }
    const sustain = [{ heal: 0.1, healEvery: 2, shield: 0.2 }]

    const full = resolveBattle({ player, enemy, rewards, modifiers: sustain })
    const withered = resolveBattle({ player, enemy, rewards, modifiers: [...sustain, { sustainScale: 0.5 }] })

    expect(full.playerHpLeft).toBeGreaterThan(withered.playerHpLeft)
    const healedFull = full.log.reduce((n, e) => n + (e.healed ?? 0), 0)
    const healedWithered = withered.log.reduce((n, e) => n + (e.healed ?? 0), 0)
    expect(healedWithered).toBeLessThan(healedFull)
  })

  it('leaves the campaign and the rift untouched by any of it', () => {
    // The rule is read from the stage id, so nothing outside the tower can pick
    // one up — including a fight resolved with no stage at all.
    const base = geared()
    const charmed: PlayerState = {
      ...base,
      ownedItemIds: ['guard-amulet'],
      equipped: { ...base.equipped, accessory1: 'guard-amulet' },
    }
    expect(playerBattleInputs(charmed).player).toEqual(effectiveStats(charmed))
  })
})

describe('relics are won, not bought', () => {
  it('keeps every relic out of the shop', () => {
    const relics = ITEMS.filter((i) => i.effect)
    expect(relics.length).toBeGreaterThan(0)
    for (const relic of relics) {
      expect(SHOP_ITEMS, relic.id).not.toContain(relic)
      // And the refusal is in the purchase itself, not only in the list.
      expect(buyItem(geared({ level: 60 }), relic.id), relic.id).toBeNull()
    }
  })

  it('pays one on each of six boss floors', () => {
    expect(TOWER_RELIC_FLOORS).toHaveLength(6)
    for (const { floor, itemId } of TOWER_RELIC_FLOORS) {
      expect(isTowerBossFloor(floor), `floor ${floor}`).toBe(true)
      expect(ITEM_BY_ID.get(itemId)?.effect, itemId).toBeDefined()
    }
    // Everything the tower pays is a tower-sourced piece, and nothing else.
    const paid = new Set(TOWER_RELIC_FLOORS.map((r) => r.itemId))
    for (const relic of ITEMS.filter((i) => i.source === 'tower')) expect(paid, relic.id).toContain(relic.id)
    expect(paid.size).toBe(ITEMS.filter((i) => i.source === 'tower').length)
  })

  it('hands the Warded band’s answer to whoever beats the Warded band', () => {
    // Floor 10 closes the first Warded band and pays the piece that carries
    // Pierce. Deliberate, and worth pinning: it is the whole shape of the loop.
    const first = TOWER_RELIC_FLOORS[0]
    expect(mutatorForFloor(first.floor).id).toBe('warded')
    expect(ITEM_BY_ID.get(first.itemId)!.effect!.mods.pierce).toBeGreaterThan(0)
  })

  it('grants on first clear and never a second copy', () => {
    const base = geared()
    const once = grantFloorRelic(base, 10)
    expect(once.ownedItemIds).toContain(relicForFloor(10))
    expect(grantFloorRelic(once, 10)).toBe(once)
  })

  it('does nothing on a floor that pays no relic', () => {
    const base = geared()
    expect(grantFloorRelic(base, 9)).toBe(base)
    expect(relicForFloor(9)).toBeUndefined()
  })
})
