import { describe, it, expect } from 'vitest'
import { STAGES } from '../src/data/stages'
import { WORLDS } from '../src/data/worlds'
import { TRAIT_IDS } from '../src/data/enemyTraits'
import { BIOMES } from '../src/data/biomes'
import {
  BANES,
  BOONS,
  RIFT_UNLOCK_WORLDS,
  WEEK_MS,
  baneForWeek,
  boonForStageId,
  boonForWeek,
  isRiftStageId,
  riftFor,
  weekIndex,
  weekStart,
} from '../src/data/rifts'
import {
  currentRift,
  msUntilNextRift,
  recordRiftCleared,
  riftAvailable,
  riftCleared,
  riftUnlocked,
  sanitizeRift,
} from '../src/systems/rift'
import { NEUTRAL, foldModifiers } from '../src/systems/combatModifiers'
import { playerBattleInputs } from '../src/systems/playerBattle'
import { isTowerStageId, towerFloor } from '../src/data/tower'
import { createDefaultPlayerState } from '../src/state/playerState'
import { parsePlayerState } from '../src/state/validate'
import EMOJI_ASSETS from '../src/data/emojiAssets.json'
import type { PlayerState } from '../src/types'

function cleared(through: number, patch: Partial<PlayerState> = {}): PlayerState {
  const ids = WORLDS.slice(0, through).flatMap((w) => w.stages.map((s) => s.id))
  return {
    ...createDefaultPlayerState('Sim'),
    stageProgress: { highestUnlocked: Math.min(ids.length + 1, STAGES.length), completedStageIds: ids },
    ...patch,
  }
}

/** A fixed instant, so nothing here depends on when the suite happens to run. */
const NOW = 1_800_000_000_000
const WEEK = weekIndex(NOW)

describe('weekly rotation', () => {
  it('changes exactly once every seven days', () => {
    // Measured from a week boundary, not from an arbitrary instant: NOW sits
    // partway through a week, so NOW + almost-a-week has already rolled over.
    const start = weekStart(WEEK)
    expect(weekIndex(start)).toBe(WEEK)
    expect(weekIndex(start + WEEK_MS - 1)).toBe(WEEK)
    expect(weekIndex(start + WEEK_MS)).toBe(WEEK + 1)
    // A clock before the epoch cannot produce a negative week.
    expect(weekIndex(-1)).toBe(0)
  })

  it('gives everyone the same week — same boon, bane, name and look', () => {
    // The numbers are scaled to the player's own frontier, so two saves do not
    // fight the same health bar. Everything that makes the week *the* week is
    // still identical, which is what makes it worth comparing notes about.
    const early = riftFor(WEEK, 8)
    const late = riftFor(WEEK, 20)
    expect(early.boon.id).toBe(late.boon.id)
    expect(early.bane.id).toBe(late.bane.id)
    expect(early.stage.id).toBe(late.stage.id)
    expect(early.stage.enemy.name).toBe(late.stage.enemy.name)
    expect(early.stage.visual).toEqual(late.stage.visual)
    expect(late.stage.enemy.maxHp).toBeGreaterThan(early.stage.enemy.maxHp)
    expect(late.stage.rewards.gold).toBeGreaterThan(early.stage.rewards.gold)
  })

  it('is a pure function of week and tier', () => {
    expect(JSON.stringify(riftFor(WEEK, 12))).toBe(JSON.stringify(riftFor(WEEK, 12)))
  })

  it('rises with the frontier without ever stepping backwards', () => {
    for (let tier = 2; tier <= 20; tier++) {
      const here = riftFor(WEEK, tier).stage
      const below = riftFor(WEEK, tier - 1).stage
      expect(here.enemy.maxHp, `tier ${tier}`).toBeGreaterThan(below.enemy.maxHp)
      expect(here.rewards.gold, `tier ${tier}`).toBeGreaterThan(below.rewards.gold)
    }
    // A tier outside the campaign clamps rather than producing nonsense.
    expect(riftFor(WEEK, 0).stage.enemy.maxHp).toBe(riftFor(WEEK, 1).stage.enemy.maxHp)
    expect(riftFor(WEEK, 999).stage.enemy.maxHp).toBe(riftFor(WEEK, 20).stage.enemy.maxHp)
  })

  it('does not repeat the boon-and-bane pairing for 42 weeks', () => {
    // Seven boons and six banes are co-prime on purpose. Walking both off the
    // same index would have shipped a rotation repeating inside two months.
    expect(BOONS).toHaveLength(7)
    expect(BANES).toHaveLength(6)
    const seen = new Set<string>()
    for (let w = 0; w < BOONS.length * BANES.length; w++) {
      seen.add(`${boonForWeek(w).id}|${baneForWeek(w).id}`)
    }
    expect(seen.size).toBe(BOONS.length * BANES.length)
    // And it does repeat after exactly that, which is the cycle length claimed.
    expect(boonForWeek(42).id).toBe(boonForWeek(0).id)
    expect(baneForWeek(42).id).toBe(baneForWeek(0).id)
  })

  it('counts down to the rotation without ever going negative', () => {
    expect(msUntilNextRift(NOW)).toBeGreaterThan(0)
    expect(msUntilNextRift(NOW)).toBeLessThanOrEqual(WEEK_MS)
    const justBefore = (WEEK + 1) * WEEK_MS - 1
    expect(msUntilNextRift(justBefore)).toBe(1)
  })
})

describe('rift content', () => {
  it('gives every boon and bane a real effect', () => {
    for (const boon of BOONS) {
      expect(foldModifiers([boon.mods]), boon.id).not.toEqual(NEUTRAL)
    }
    for (const bane of BANES) {
      const changesStats = bane.hpScale !== 1 || bane.atkScale !== 1
      expect(changesStats || bane.trait !== 'straightforward', bane.id).toBe(true)
    }
  })

  it('only names traits and textures that exist', () => {
    const keys = new Set(Object.keys(EMOJI_ASSETS))
    for (const boon of BOONS) expect(keys.has(boon.sprite), boon.id).toBe(true)
    for (const bane of BANES) {
      expect(keys.has(bane.sprite), bane.id).toBe(true)
      expect(TRAIT_IDS, bane.id).toContain(bane.trait)
    }
    for (let w = 0; w < 60; w++) {
      const rift = riftFor(w)
      expect(keys.has(rift.stage.enemy.sprite), `week ${w}`).toBe(true)
      expect(BIOMES[rift.stage.visual.biome], `week ${w}`).toBeDefined()
      expect(keys.has(rift.stage.visual.landmark), `week ${w}`).toBe(true)
    }
  })

  it('keeps rift ids out of the campaign and tower namespaces', () => {
    expect(isRiftStageId('rift-9')).toBe(true)
    expect(isRiftStageId('stage-9')).toBe(false)
    expect(isRiftStageId('tower-9')).toBe(false)
    expect(isTowerStageId(riftFor(WEEK).stage.id)).toBe(false)
    const campaignIds = new Set(STAGES.map((s) => s.id))
    for (let w = 0; w < 60; w++) expect(campaignIds.has(riftFor(w).stage.id)).toBe(false)
    // And the two generated modes cannot collide with each other either.
    expect(riftFor(5).stage.id).not.toBe(towerFloor(5).id)
  })

  it('reads the boon back out of the stage id rather than the clock', () => {
    // Taking it from the clock would let a preview rendered a minute before a
    // week boundary disagree with the fight begun after it — the one place the
    // forecast could stop being an exact simulation.
    for (let w = 0; w < 20; w++) {
      expect(boonForStageId(`rift-${w}`)?.id, `week ${w}`).toBe(boonForWeek(w).id)
    }
    expect(boonForStageId('stage-3')).toBeUndefined()
    expect(boonForStageId('tower-3')).toBeUndefined()
    expect(boonForStageId('rift-nonsense')).toBeUndefined()
  })
})

describe('the boon reaches the fight', () => {
  const hero = cleared(WORLDS.length)

  it('is added for a rift stage and for nothing else', () => {
    const plain = playerBattleInputs(hero).modifiers!.length
    const inRift = playerBattleInputs(hero, riftFor(WEEK).stage).modifiers!.length
    expect(inRift).toBe(plain + 1)
    expect(playerBattleInputs(hero, STAGES[0]).modifiers).toHaveLength(plain)
    expect(playerBattleInputs(hero, towerFloor(3)).modifiers).toHaveLength(plain)
  })

  it("is the boon that week's own id names", () => {
    const week = WEEK + 3
    const mods = playerBattleInputs(hero, riftFor(week).stage).modifiers!
    expect(mods[mods.length - 1]).toEqual(boonForWeek(week).mods)
  })
})

describe('clearing the rift', () => {
  const graduate = (patch: Partial<PlayerState> = {}) => cleared(RIFT_UNLOCK_WORLDS, patch)

  it('stays shut until eight worlds are cleared', () => {
    expect(riftUnlocked(cleared(RIFT_UNLOCK_WORLDS - 1))).toBe(false)
    expect(riftUnlocked(graduate())).toBe(true)
    expect(riftAvailable(cleared(1), NOW)).toBe(false)
  })

  it('is available once a week and not twice', () => {
    const fresh = graduate()
    expect(riftAvailable(fresh, NOW)).toBe(true)
    const done = recordRiftCleared(fresh, NOW)
    expect(riftCleared(done, NOW)).toBe(true)
    expect(riftAvailable(done, NOW)).toBe(false)
    // Clearing again inside the same week changes nothing.
    expect(recordRiftCleared(done, NOW)).toBe(done)
    // Next week it is back.
    expect(riftAvailable(done, NOW + WEEK_MS)).toBe(true)
  })

  it('is still available after a loss, because losing does not consume it', () => {
    // Nothing records a loss, which is the point: a rift the player cannot beat
    // yet has to stay open for them to come back to with a better build.
    const fresh = graduate()
    expect(riftAvailable(fresh, NOW)).toBe(true)
    expect(riftAvailable(fresh, NOW)).toBe(true)
  })

  it('names the current week when asked for the rift', () => {
    expect(currentRift(graduate(), NOW).week).toBe(WEEK)
    expect(currentRift(graduate(), NOW).stage.id).toBe(`rift-${WEEK}`)
  })
})

describe('paying out once a week', () => {
  const graduate = () => cleared(RIFT_UNLOCK_WORLDS)

  it('pays the first clear of the week and nothing after it', () => {
    // Mirrors what the result screen does: read availability *before* the win
    // is recorded, because recording it flips the answer.
    const fresh = graduate()
    const paysFirst = riftAvailable(fresh, NOW)
    const after = recordRiftCleared(fresh, NOW)
    const paysAgain = riftAvailable(after, NOW)

    expect(paysFirst).toBe(true)
    expect(paysAgain).toBe(false)
    expect(riftAvailable(after, NOW + WEEK_MS)).toBe(true)
  })
})

describe('rift record in a save', () => {
  it('starts a pre-v16 save as never cleared', () => {
    const legacy = { ...cleared(WORLDS.length) } as Record<string, unknown>
    delete legacy.rift
    expect(parsePlayerState(legacy)!.rift.clearedWeek).toBe(-1)
    expect(riftCleared(parsePlayerState(legacy)!)).toBe(false)
  })

  it('coerces nonsense rather than trusting it', () => {
    expect(sanitizeRift(undefined, NOW)).toEqual({ clearedWeek: -1 })
    expect(sanitizeRift({ clearedWeek: 'soon' }, NOW)).toEqual({ clearedWeek: -1 })
    expect(sanitizeRift({ clearedWeek: Number.NaN }, NOW)).toEqual({ clearedWeek: -1 })
    expect(sanitizeRift({ clearedWeek: -5 }, NOW)).toEqual({ clearedWeek: -1 })
    expect(sanitizeRift({ clearedWeek: WEEK }, NOW)).toEqual({ clearedWeek: WEEK })
  })

  it('clamps a week from the future instead of keeping it', () => {
    // Left alone, a far-future week would read as "cleared" for every week up
    // to it — the one way an edited save could lock itself *out* of content.
    expect(sanitizeRift({ clearedWeek: WEEK + 500 }, NOW)).toEqual({ clearedWeek: WEEK })
  })
})
