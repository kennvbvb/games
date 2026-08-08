import { describe, it, expect } from 'vitest'
import { STAGES } from '../src/data/stages'
import { WORLDS } from '../src/data/worlds'
import { ITEMS } from '../src/data/items'
import {
  BONUS_CAP,
  MAX_ASCENSIONS,
  ascend,
  ascensionModifiers,
  bonusAscensions,
  canAscend,
  sanitizeAscension,
} from '../src/systems/ascension'
import { MAX_MASTERY_RANK, masteryRank, unlockedRelics } from '../src/systems/mastery'
import { NEUTRAL, foldModifiers } from '../src/systems/combatModifiers'
import { playerBattleInputs } from '../src/systems/playerBattle'
import { bestOwnedPerSlot } from '../src/systems/upgrades'
import { statsForLevel } from '../src/systems/leveling'
import { createDefaultPlayerState } from '../src/state/playerState'
import { parsePlayerState } from '../src/state/validate'
import type { PlayerState } from '../src/types'

const allStageIds = STAGES.map((s) => s.id)

/** A hero who has genuinely finished the campaign, gear and all. */
function finished(patch: Partial<PlayerState> = {}): PlayerState {
  const owned = ITEMS.filter((item) => (item.minLevel ?? 1) <= 34).map((item) => item.id)
  return {
    ...createDefaultPlayerState('Sim'),
    level: 34,
    exp: 120,
    gold: 5000,
    stats: statsForLevel(34, 'human'),
    upgrades: { hp: 5, atk: 5, def: 3 },
    ownedItemIds: owned,
    equipped: bestOwnedPerSlot(owned),
    unlockedSkillIds: ['human-1-1'],
    loadout: ['human-1-1'],
    stageProgress: { highestUnlocked: STAGES.length, completedStageIds: allStageIds },
    idle: { farmingStageId: 'stage-88', lastSeenAt: Date.now() },
    ...patch,
  }
}

describe('when ascension is offered', () => {
  it('needs every stage cleared, not merely unlocked', () => {
    expect(canAscend(createDefaultPlayerState('New'))).toBe(false)
    expect(canAscend(finished())).toBe(true)

    // One stage short is short.
    const nearly = finished({
      stageProgress: { highestUnlocked: STAGES.length, completedStageIds: allStageIds.slice(0, -1) },
    })
    expect(canAscend(nearly)).toBe(false)

    // Unlocked to the end without clearing anything is not finished either.
    const unlockedOnly = finished({
      stageProgress: { highestUnlocked: STAGES.length, completedStageIds: [] },
    })
    expect(canAscend(unlockedOnly)).toBe(false)
  })

  it('stops offering once the counter is full', () => {
    expect(canAscend(finished({ ascension: { count: MAX_ASCENSIONS } }))).toBe(false)
    expect(canAscend(finished({ ascension: { count: MAX_ASCENSIONS - 1 } }))).toBe(true)
  })
})

describe('what ascending does', () => {
  const before = finished()
  const after = ascend(before)

  it('gives back everything earned inside the run', () => {
    expect(after.level).toBe(1)
    expect(after.exp).toBe(0)
    expect(after.gold).toBe(0)
    expect(after.upgrades).toEqual({ hp: 0, atk: 0, def: 0 })
    expect(after.ownedItemIds).toEqual([])
    expect(Object.values(after.equipped).every((id) => id === null)).toBe(true)
    expect(after.unlockedSkillIds).toEqual([])
    expect(after.loadout).toEqual([])
    expect(after.stageProgress).toEqual({ highestUnlocked: 1, completedStageIds: [] })
    expect(after.ascension.count).toBe(1)
  })

  it('keeps identity, settings and everything won outside the campaign', () => {
    expect(after.name).toBe(before.name)
    expect(after.raceId).toBe(before.raceId)
    expect(after.appearanceId).toBe(before.appearanceId)
    expect(after.settings).toEqual(before.settings)
    expect(after.claimedAchievementIds).toEqual(before.claimedAchievementIds)
    expect(after.lifetime).toEqual(before.lifetime)
    // Wiping these would punish the player for using the very features
    // ascension exists to feed.
    expect(after.tower).toEqual(before.tower)
    expect(after.rift).toEqual(before.rift)
  })

  it('stops farming a stage the reset just locked', () => {
    // Left alone this would keep paying offline rewards for a fight the hero
    // can no longer reach.
    expect(before.idle.farmingStageId).toBe('stage-88')
    expect(after.idle.farmingStageId).toBeNull()
    expect(after.idle.lastSeenAt).toBe(before.idle.lastSeenAt)
  })

  it('refuses to wipe a save that has not finished the campaign', () => {
    // A caller who forgot to check `canAscend` must not be able to destroy
    // progress by asking.
    const halfway = finished({
      stageProgress: { highestUnlocked: 50, completedStageIds: allStageIds.slice(0, 49) },
    })
    expect(ascend(halfway)).toBe(halfway)
  })
})

describe('mastery survives the reset', () => {
  it('keeps the rank and the relics a finished campaign earned', () => {
    const before = finished()
    expect(masteryRank(before)).toBe(MAX_MASTERY_RANK)
    const after = ascend(before)

    // The stage list is empty now, so a track that only read progress would
    // read zero — and would take the player's relics away at exactly the moment
    // the game asked them to start over.
    expect(after.stageProgress.completedStageIds).toEqual([])
    expect(masteryRank(after)).toBe(MAX_MASTERY_RANK)
    expect(unlockedRelics(after)).toHaveLength(3)
  })

  it('drops the carried relic but leaves it re-pickable', () => {
    const before = finished({ equippedRelicId: 'relic-human-3' })
    const after = ascend(before)
    expect(after.equippedRelicId).toBeNull()
    expect(unlockedRelics(after).some((r) => r.id === 'relic-human-3')).toBe(true)
    // And a load does not strip it back out, because the budget is banked.
    expect(parsePlayerState({ ...after, equippedRelicId: 'relic-human-3' })!.equippedRelicId).toBe(
      'relic-human-3',
    )
  })
})

describe('the permanent bonus', () => {
  it('is nothing at zero and grows with each ascension', () => {
    expect(ascensionModifiers(finished({ ascension: { count: 0 } }))).toEqual([])
    let previous = 1
    for (let n = 1; n <= BONUS_CAP; n++) {
      const mods = ascensionModifiers(finished({ ascension: { count: n } }))
      expect(mods, `count ${n}`).toHaveLength(1)
      expect(mods[0].outgoing!, `count ${n}`).toBeGreaterThan(previous)
      previous = mods[0].outgoing!
    }
  })

  it('stops growing at the cap while the counter keeps climbing', () => {
    const capped = ascensionModifiers(finished({ ascension: { count: BONUS_CAP } }))
    const beyond = ascensionModifiers(finished({ ascension: { count: BONUS_CAP + 40 } }))
    expect(beyond).toEqual(capped)
    expect(bonusAscensions(finished({ ascension: { count: 99 } }))).toBe(BONUS_CAP)
    // The count itself is still recorded, because it is the player's history.
    expect(finished({ ascension: { count: 99 } }).ascension.count).toBe(99)
  })

  it('reaches the fight through the one place every fight is assembled', () => {
    const plain = playerBattleInputs(finished({ ascension: { count: 0 } })).modifiers!
    const ascended = playerBattleInputs(finished({ ascension: { count: 3 } })).modifiers!
    expect(ascended).toHaveLength(plain.length + 1)
    expect(foldModifiers(ascended)).not.toEqual(foldModifiers(plain))
    expect(foldModifiers(ascended).outgoing).toBeGreaterThan(foldModifiers(plain).outgoing)
  })

  it('is neutral for a save that never ascended', () => {
    expect(foldModifiers(ascensionModifiers(createDefaultPlayerState('New')))).toEqual(NEUTRAL)
  })
})

describe('the count in a save', () => {
  it('starts a pre-v17 save at zero', () => {
    const legacy = { ...finished() } as Record<string, unknown>
    delete legacy.ascension
    expect(parsePlayerState(legacy)!.ascension.count).toBe(0)
  })

  it('survives a load', () => {
    expect(parsePlayerState(finished({ ascension: { count: 4 } }))!.ascension.count).toBe(4)
  })

  it('coerces nonsense rather than trusting it', () => {
    expect(sanitizeAscension(undefined)).toEqual({ count: 0 })
    expect(sanitizeAscension({ count: 'many' })).toEqual({ count: 0 })
    expect(sanitizeAscension({ count: Number.NaN })).toEqual({ count: 0 })
    expect(sanitizeAscension({ count: -3 })).toEqual({ count: 0 })
    expect(sanitizeAscension({ count: 2.9 })).toEqual({ count: 2 })
    expect(sanitizeAscension({ count: 1e9 })).toEqual({ count: MAX_ASCENSIONS })
  })
})

describe('a second run', () => {
  it('starts from the beginning, keeping only what ascension promised', () => {
    const first = ascend(finished())
    expect(canAscend(first)).toBe(false)

    // Play it again.
    const second = {
      ...first,
      stageProgress: { highestUnlocked: STAGES.length, completedStageIds: allStageIds },
    }
    expect(canAscend(second)).toBe(true)
    const third = ascend(second)
    expect(third.ascension.count).toBe(2)
    expect(masteryRank(third)).toBe(MAX_MASTERY_RANK)
  })

  it('leaves the world list untouched — ascension resets progress, not content', () => {
    expect(STAGES).toHaveLength(100)
    expect(WORLDS).toHaveLength(20)
  })
})
