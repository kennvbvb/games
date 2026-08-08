import { describe, it, expect } from 'vitest'
import { STAGES } from '../src/data/stages'
import { WORLDS } from '../src/data/worlds'
import { TRAIT_IDS } from '../src/data/enemyTraits'
import { BIOMES } from '../src/data/biomes'
import {
  TOWER_UNLOCK_WORLDS,
  isTowerBossFloor,
  isTowerStageId,
  towerEnemy,
  towerFloor,
  towerTrait,
} from '../src/data/tower'
import {
  MAX_TOWER_FLOOR,
  bestFloor,
  canAttempt,
  nextFloor,
  recordFloorCleared,
  sanitizeTower,
  towerUnlocked,
} from '../src/systems/tower'
import { stageOutlook } from '../src/systems/difficulty'
import { ITEMS } from '../src/data/items'
import { bestOwnedPerSlot } from '../src/systems/upgrades'
import { statsForLevel } from '../src/systems/leveling'
import { createDefaultPlayerState } from '../src/state/playerState'
import { parsePlayerState } from '../src/state/validate'
import EMOJI_ASSETS from '../src/data/emojiAssets.json'
import type { PlayerState } from '../src/types'

/** A save that has cleared every stage of worlds 1..through. */
function cleared(through: number, patch: Partial<PlayerState> = {}): PlayerState {
  const ids = WORLDS.slice(0, through).flatMap((w) => w.stages.map((s) => s.id))
  return {
    ...createDefaultPlayerState('Sim'),
    stageProgress: { highestUnlocked: Math.min(ids.length + 1, STAGES.length), completedStageIds: ids },
    ...patch,
  }
}

const graduate = (patch: Partial<PlayerState> = {}) => cleared(WORLDS.length, patch)

describe('floor generation', () => {
  it('produces a floor for any number, however deep', () => {
    for (const floor of [1, 2, 10, 99, 100, 137, 1000, MAX_TOWER_FLOOR]) {
      const stage = towerFloor(floor)
      expect(stage.id, `floor ${floor}`).toBe(`tower-${floor}`)
      expect(stage.order).toBe(floor)
      expect(Number.isFinite(stage.enemy.maxHp), `floor ${floor} hp`).toBe(true)
      expect(stage.enemy.maxHp).toBeGreaterThan(0)
      expect(stage.enemy.atk).toBeGreaterThan(0)
      expect(stage.rewards.gold).toBeGreaterThan(0)
    }
  })

  it('is a pure function of the floor number', () => {
    // Nothing in the tower shuffles, so the preview is an exact simulation and
    // floor 63 is the same floor on every device.
    for (const floor of [1, 7, 40, 250]) {
      expect(JSON.stringify(towerFloor(floor))).toBe(JSON.stringify(towerFloor(floor)))
    }
  })

  it('climbs without a backward step in health, attack or payout', () => {
    for (let floor = 2; floor <= 200; floor++) {
      const here = towerFloor(floor)
      const below = towerFloor(floor - 1)
      // Boss floors jump and the floor after settles back, so compare like
      // with like the way the campaign curve test does.
      if (isTowerBossFloor(floor) || isTowerBossFloor(floor - 1)) continue
      expect(here.enemy.maxHp, `floor ${floor} hp`).toBeGreaterThan(below.enemy.maxHp)
      expect(here.enemy.atk, `floor ${floor} atk`).toBeGreaterThanOrEqual(below.enemy.atk)
      expect(here.rewards.gold, `floor ${floor} gold`).toBeGreaterThan(below.rewards.gold)
    }
  })

  it('caps defence so a low-attack build is never locked out arithmetically', () => {
    // Defence is subtracted before the minimum-1 floor. Left to grow with the
    // rest of the curve it would stop weak attackers dealing anything at all,
    // which is not a harder fight — it is an unwinnable one wearing a health bar.
    const deep = towerEnemy(5000)
    expect(deep.def).toBeLessThanOrEqual(220)
    expect(deep.def).toBeLessThan(deep.atk)
  })

  it('outgrows any hero eventually, which is what ends a run', () => {
    const shallow = towerFloor(1).enemy.maxHp
    const deep = towerFloor(200).enemy.maxHp
    expect(deep / shallow).toBeGreaterThan(500)
  })

  it('puts a boss on every tenth floor and phases on it', () => {
    for (const floor of [10, 20, 100, 500]) {
      expect(isTowerBossFloor(floor), `floor ${floor}`).toBe(true)
      const boss = towerEnemy(floor).boss
      expect(boss, `floor ${floor}`).toBeDefined()
      expect(boss!.phases!.length).toBeGreaterThan(0)
      expect(boss!.phases!.length).toBeLessThanOrEqual(3)
    }
    for (const floor of [1, 9, 11, 99]) expect(isTowerBossFloor(floor), `floor ${floor}`).toBe(false)
  })

  it('never starts a boss on the trait its own phase swaps it into', () => {
    // Exactly the bug that doubled up on a campaign boss and cost a rebalance.
    for (let floor = 10; floor <= 600; floor += 10) {
      const enemy = towerEnemy(floor)
      const swaps = (enemy.boss?.phases ?? []).map((p) => p.trait).filter(Boolean)
      expect(swaps, `floor ${floor}`).not.toContain(enemy.trait)
    }
  })

  it('only ever asks for traits, biomes and sprites that exist', () => {
    const keys = new Set(Object.keys(EMOJI_ASSETS))
    for (let floor = 1; floor <= 200; floor++) {
      const stage = towerFloor(floor)
      expect(TRAIT_IDS, `floor ${floor}`).toContain(towerTrait(floor))
      expect(BIOMES[stage.visual.biome], `floor ${floor}`).toBeDefined()
      expect(keys.has(stage.enemy.sprite), `floor ${floor} sprite`).toBe(true)
      expect(keys.has(stage.visual.landmark), `floor ${floor} landmark`).toBe(true)
    }
  })

  it('keeps floor ids out of the campaign namespace', () => {
    // A floor recorded as a cleared stage would be dropped by the validator on
    // the next load; keeping the namespaces apart is what stops that happening.
    expect(isTowerStageId('tower-4')).toBe(true)
    expect(isTowerStageId('stage-4')).toBe(false)
    const campaignIds = new Set(STAGES.map((s) => s.id))
    for (let floor = 1; floor <= 200; floor++) {
      expect(campaignIds.has(towerFloor(floor).id)).toBe(false)
    }
  })
})

describe('climbing', () => {
  it('stays shut until every world is cleared', () => {
    expect(TOWER_UNLOCK_WORLDS).toBe(WORLDS.length)
    expect(towerUnlocked(cleared(WORLDS.length - 1))).toBe(false)
    expect(towerUnlocked(graduate())).toBe(true)
    // Being one stage short of the last world is still short.
    const nearly = cleared(WORLDS.length)
    const missingLast = {
      ...nearly,
      stageProgress: {
        ...nearly.stageProgress,
        completedStageIds: nearly.stageProgress.completedStageIds.slice(0, -1),
      },
    }
    expect(towerUnlocked(missingLast)).toBe(false)
  })

  it('opens exactly one floor past the deepest beaten', () => {
    const fresh = graduate()
    expect(bestFloor(fresh)).toBe(0)
    expect(nextFloor(fresh)).toBe(1)
    expect(canAttempt(fresh, 1)).toBe(true)
    expect(canAttempt(fresh, 2)).toBe(false)

    const climbed = recordFloorCleared(fresh, 7)
    expect(nextFloor(climbed)).toBe(8)
    expect(canAttempt(climbed, 8)).toBe(true)
    expect(canAttempt(climbed, 9)).toBe(false)
    // Old floors stay open for a re-run.
    expect(canAttempt(climbed, 3)).toBe(true)
    expect(canAttempt(climbed, 0)).toBe(false)
  })

  it('lets nothing be attempted at all while the tower is shut', () => {
    expect(canAttempt(cleared(5), 1)).toBe(false)
  })

  it('only ever moves the record forward', () => {
    const at10 = recordFloorCleared(graduate(), 10)
    expect(bestFloor(recordFloorCleared(at10, 4))).toBe(10)
    expect(bestFloor(recordFloorCleared(at10, 11))).toBe(11)
  })
})

describe('tower record in a save', () => {
  it('starts a pre-v15 save at zero', () => {
    const legacy = { ...graduate() } as Record<string, unknown>
    delete legacy.tower
    expect(parsePlayerState(legacy)!.tower.bestFloor).toBe(0)
  })

  it('keeps a real record across a load', () => {
    expect(parsePlayerState(recordFloorCleared(graduate(), 23))!.tower.bestFloor).toBe(23)
  })

  it('coerces nonsense rather than trusting or crashing on it', () => {
    expect(sanitizeTower(undefined)).toEqual({ bestFloor: 0 })
    expect(sanitizeTower({ bestFloor: 'lots' })).toEqual({ bestFloor: 0 })
    expect(sanitizeTower({ bestFloor: Number.NaN })).toEqual({ bestFloor: 0 })
    expect(sanitizeTower({ bestFloor: -40 })).toEqual({ bestFloor: 0 })
    expect(sanitizeTower({ bestFloor: 12.7 })).toEqual({ bestFloor: 12 })
    expect(sanitizeTower({ bestFloor: 1e12 })).toEqual({ bestFloor: MAX_TOWER_FLOOR })
  })

  it('buys an edited record nothing but a fight it loses', () => {
    // The tower is the one piece of progress that cannot be derived, so the
    // defence is different in kind: the claim is bounded, and the floor it
    // unlocks is one the curve has already put out of reach.
    const cheat = parsePlayerState({ ...graduate(), tower: { bestFloor: 500 } })!
    expect(cheat.tower.bestFloor).toBe(500)
    const outlook = stageOutlook(cheat, towerFloor(501))
    expect(outlook.willWin).toBe(false)
  })
})

describe('a real climb', () => {
  it('lets a fresh graduate take the opening floors and stops them later', () => {
    // A graduate is level 34 with the gear that gold bought on the way — that
    // is what the campaign walk actually produces, and a level-1 save with
    // every stage flagged cleared is not a hero anyone brings to the tower.
    //
    // Deliberately not asserting a fixed wall floor: that is a balance figure a
    // tuning pass is allowed to move. What has to hold is the shape — the tower
    // opens beatable and closes unbeatable.
    const owned = ITEMS.filter((item) => (item.minLevel ?? 1) <= 34).map((item) => item.id)
    const hero = graduate({
      level: 34,
      stats: statsForLevel(34, 'human'),
      ownedItemIds: owned,
      equipped: bestOwnedPerSlot(owned),
    })
    expect(stageOutlook(hero, towerFloor(1)).willWin).toBe(true)
    expect(stageOutlook(hero, towerFloor(120)).willWin).toBe(false)
  })
})
