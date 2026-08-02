import { describe, it, expect } from 'vitest'
import { STAGES } from '../src/data/stages'
import { BOSS_STAGE_IDS, WORLDS } from '../src/data/worlds'
import { RACES } from '../src/data/races'
import { RELICS, RELIC_RANKS, relicsForRace } from '../src/data/relics'
import {
  MAX_MASTERY_RANK,
  RANK_THRESHOLDS,
  equipRelic,
  masteryModifiers,
  masteryProgress,
  masteryRank,
  masteryXp,
  rankModifiers,
  relicOf,
  sanitizeRelic,
  unequipRelic,
  unlockedRelics,
} from '../src/systems/mastery'
import { NEUTRAL, foldModifiers } from '../src/systems/combatModifiers'
import { createDefaultPlayerState } from '../src/state/playerState'
import { parsePlayerState } from '../src/state/validate'
import EMOJI_ASSETS from '../src/data/emojiAssets.json'
import type { PlayerState } from '../src/types'

/** A save that has cleared every stage of worlds 1..through, in order. */
function cleared(through: number, raceId = 'human'): PlayerState {
  const ids = WORLDS.slice(0, through).flatMap((world) => world.stages.map((s) => s.id))
  return {
    ...createDefaultPlayerState('Sim', undefined, raceId as never),
    stageProgress: { highestUnlocked: Math.min(ids.length + 1, STAGES.length), completedStageIds: ids },
  }
}

describe('relic catalogue', () => {
  it('gives every kin one relic per relic rank', () => {
    for (const race of RACES) {
      const relics = relicsForRace(race.id)
      expect(relics.map((r) => r.unlockRank), race.id).toEqual([...RELIC_RANKS])
    }
    expect(RELICS).toHaveLength(RACES.length * RELIC_RANKS.length)
  })

  it('has unique ids and points every relic at a texture that exists', () => {
    const keys = new Set(Object.keys(EMOJI_ASSETS))
    expect(new Set(RELICS.map((r) => r.id)).size).toBe(RELICS.length)
    for (const relic of RELICS) {
      expect(keys.has(relic.sprite), `${relic.id} → ${relic.sprite}`).toBe(true)
    }
  })

  it('never opens a relic past the rank cap', () => {
    for (const relic of RELICS) {
      expect(relic.unlockRank, relic.id).toBeGreaterThan(0)
      expect(relic.unlockRank, relic.id).toBeLessThanOrEqual(MAX_MASTERY_RANK)
    }
  })

  it('gives every relic an effect that actually changes a fight', () => {
    // A relic whose mods fold to neutral would read as a reward and pay nothing.
    for (const relic of RELICS) {
      expect(foldModifiers([relic.mods]), relic.id).not.toEqual(NEUTRAL)
    }
  })
})

describe('mastery experience', () => {
  it('pays a stage its world number, and a boss three times that', () => {
    const one = cleared(1)
    // World 1: four ordinary stages at 1 each, plus the boss at 3.
    expect(masteryXp(one)).toBe(7)

    const two = cleared(2)
    // World 2 adds four at 2 and a boss at 6.
    expect(masteryXp(two)).toBe(7 + 14)
  })

  it('makes a deep stage worth more than an early one', () => {
    const early = { ...cleared(0), stageProgress: { highestUnlocked: 1, completedStageIds: ['stage-1'] } }
    const late = {
      ...cleared(0),
      stageProgress: { highestUnlocked: 1, completedStageIds: [STAGES[STAGES.length - 2].id] },
    }
    expect(masteryXp(late)).toBeGreaterThan(masteryXp(early) * 15)
  })

  it('cannot be inflated by ids that are not stages', () => {
    const forged = {
      ...cleared(0),
      stageProgress: { highestUnlocked: 1, completedStageIds: ['stage-1', 'stage-9999', 'not-a-stage'] },
    }
    expect(masteryXp(forged)).toBe(1)
  })

  it('reaches exactly the cap on a fully cleared campaign, and no sooner', () => {
    expect(masteryRank(cleared(WORLDS.length))).toBe(MAX_MASTERY_RANK)
    expect(masteryRank(cleared(WORLDS.length - 1))).toBeLessThan(MAX_MASTERY_RANK)
    expect(masteryRank(cleared(0))).toBe(0)
  })

  it('lands a rank on each of its thresholds and never skips backwards', () => {
    expect(RANK_THRESHOLDS).toHaveLength(MAX_MASTERY_RANK)
    for (let i = 1; i < RANK_THRESHOLDS.length; i++) {
      expect(RANK_THRESHOLDS[i], `threshold ${i}`).toBeGreaterThan(RANK_THRESHOLDS[i - 1])
    }
    let previous = 0
    for (let w = 0; w <= WORLDS.length; w++) {
      const rank = masteryRank(cleared(w))
      expect(rank, `world ${w}`).toBeGreaterThanOrEqual(previous)
      previous = rank
    }
  })

  it('reports progress inside the current rank, clamped to [0,1]', () => {
    for (let w = 0; w <= WORLDS.length; w++) {
      const p = masteryProgress(cleared(w))
      expect(p.fraction, `world ${w}`).toBeGreaterThanOrEqual(0)
      expect(p.fraction, `world ${w}`).toBeLessThanOrEqual(1)
      if (p.nextAt !== null) expect(p.nextAt).toBeGreaterThan(p.xp - 1)
    }
    // At the cap there is no next rank, and the bar reads full rather than empty.
    const capped = masteryProgress(cleared(WORLDS.length))
    expect(capped.nextAt).toBeNull()
    expect(capped.fraction).toBe(1)
  })

  it('counts every world boss as a boss', () => {
    // Guards the join between the two data files: if BOSS_STAGE_IDS and the
    // world list ever disagreed, mastery would quietly underpay.
    expect(BOSS_STAGE_IDS).toHaveLength(WORLDS.length)
    const bossesOnly = {
      ...cleared(0),
      stageProgress: { highestUnlocked: 1, completedStageIds: [...BOSS_STAGE_IDS] },
    }
    const expected = WORLDS.reduce((sum, w) => sum + w.index * 3, 0)
    expect(masteryXp(bossesOnly)).toBe(expected)
  })
})

describe('rank ramp', () => {
  it('is neutral at rank 0 and never punishes a higher rank', () => {
    expect(rankModifiers(0)).toEqual({ outgoing: 1, incoming: 1 })
    for (let rank = 1; rank <= MAX_MASTERY_RANK; rank++) {
      const here = rankModifiers(rank)
      const before = rankModifiers(rank - 1)
      expect(here.outgoing!, `rank ${rank}`).toBeGreaterThan(before.outgoing!)
      expect(here.incoming!, `rank ${rank}`).toBeLessThan(before.incoming!)
    }
  })

  it('stays modest at the cap', () => {
    // Pinned deliberately: this ramp is invisible in play, so nothing but a
    // test stops it drifting into the dominant source of a hero's power.
    const capped = rankModifiers(MAX_MASTERY_RANK)
    expect(capped.outgoing!).toBeLessThan(1.2)
    expect(capped.incoming!).toBeGreaterThan(0.85)
  })

  it('clamps a rank outside the track rather than compounding it', () => {
    expect(rankModifiers(99)).toEqual(rankModifiers(MAX_MASTERY_RANK))
    expect(rankModifiers(-5)).toEqual(rankModifiers(0))
  })
})

describe('relics in a save', () => {
  it('opens each kin its own relics and nobody else’s', () => {
    for (const race of RACES) {
      const state = cleared(WORLDS.length, race.id)
      const open = unlockedRelics(state)
      expect(open, race.id).toHaveLength(RELIC_RANKS.length)
      for (const relic of open) expect(relic.raceId, relic.id).toBe(race.id)
    }
  })

  it('refuses a relic the rank has not opened', () => {
    const early = cleared(1)
    expect(masteryRank(early)).toBeLessThan(RELIC_RANKS[0])
    const wanted = relicsForRace('human')[0]
    expect(equipRelic(early, wanted.id).equippedRelicId).toBeNull()

    const later = cleared(4)
    expect(masteryRank(later)).toBeGreaterThanOrEqual(RELIC_RANKS[0])
    expect(equipRelic(later, wanted.id).equippedRelicId).toBe(wanted.id)
  })

  it('refuses a relic belonging to another kin', () => {
    const state = cleared(WORLDS.length, 'dwarf')
    const elfRelic = relicsForRace('elf')[0]
    expect(equipRelic(state, elfRelic.id).equippedRelicId).toBeNull()
  })

  it('carries one relic at a time', () => {
    const state = cleared(WORLDS.length)
    const [first, second] = relicsForRace('human')
    const one = equipRelic(state, first.id)
    const two = equipRelic(one, second.id)
    expect(two.equippedRelicId).toBe(second.id)
    expect(relicOf(two)!.id).toBe(second.id)
    expect(unequipRelic(two).equippedRelicId).toBeNull()
  })

  it('feeds the fight the ramp alone when no relic is carried', () => {
    const state = cleared(WORLDS.length)
    expect(masteryModifiers(state)).toHaveLength(1)
    expect(masteryModifiers(equipRelic(state, relicsForRace('human')[0].id))).toHaveLength(2)
  })
})

describe('relic sanitization', () => {
  const rank = MAX_MASTERY_RANK

  it('drops anything that is not a relic id', () => {
    expect(sanitizeRelic(undefined, 'human', rank)).toBeNull()
    expect(sanitizeRelic(42, 'human', rank)).toBeNull()
    expect(sanitizeRelic('relic-nope', 'human', rank)).toBeNull()
    expect(sanitizeRelic({ id: 'relic-human-1' }, 'human', rank)).toBeNull()
  })

  it('drops a relic from another kin, the way skills do', () => {
    expect(sanitizeRelic('relic-elf-1', 'human', rank)).toBeNull()
    expect(sanitizeRelic('relic-human-1', 'human', rank)).toBe('relic-human-1')
  })

  it('drops a relic the progress has not earned', () => {
    expect(sanitizeRelic('relic-human-3', 'human', 8)).toBeNull()
    expect(sanitizeRelic('relic-human-3', 'human', 9)).toBe('relic-human-3')
  })
})

describe('save migration', () => {
  it('starts a pre-v14 save with no relic but the rank its progress earned', () => {
    // The field simply is not there on an older save. What matters is that the
    // rank is not zero for a player who had already cleared half the campaign:
    // mastery is retroactive, not a track that resets everyone on upgrade.
    const legacy = { ...cleared(10) } as Record<string, unknown>
    delete legacy.equippedRelicId
    const parsed = parsePlayerState(legacy)!
    expect(parsed.equippedRelicId).toBeNull()
    expect(masteryRank(parsed)).toBeGreaterThan(RELIC_RANKS[0])
  })

  it('keeps a relic the save has genuinely earned', () => {
    const earned = equipRelic(cleared(WORLDS.length), 'relic-human-3')
    expect(parsePlayerState(earned)!.equippedRelicId).toBe('relic-human-3')
  })

  it('strips a relic an edited save claims without the progress for it', () => {
    const forged = { ...cleared(1), equippedRelicId: 'relic-human-3' }
    expect(parsePlayerState(forged)!.equippedRelicId).toBeNull()
  })

  it('strips a relic left behind by a change of kin', () => {
    const swapped = { ...equipRelic(cleared(WORLDS.length), 'relic-human-1'), raceId: 'orc' as const }
    expect(parsePlayerState(swapped)!.equippedRelicId).toBeNull()
  })

  it('gives a brand new hero rank 0 and no relic', () => {
    const fresh = createDefaultPlayerState('New')
    expect(fresh.equippedRelicId).toBeNull()
    expect(masteryRank(fresh)).toBe(0)
    expect(unlockedRelics(fresh)).toHaveLength(0)
  })
})
