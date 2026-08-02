import { describe, it, expect } from 'vitest'
import { ENEMY_TRAITS, TRAIT_IDS } from '../src/data/enemyTraits'
import { STATUSES, STATUS_IDS } from '../src/data/statuses'
import { SETS } from '../src/data/sets'
import { RELIC_RANKS, relicsForRace } from '../src/data/relics'
import { STAGES } from '../src/data/stages'
import { WORLDS } from '../src/data/worlds'
import { ITEMS } from '../src/data/items'
import {
  codexProgress,
  foundSets,
  foundStatuses,
  foundTraits,
  relicEntries,
  setEntries,
  setMemberNames,
  statusEntries,
  traitEntries,
  traitsReachableInCampaign,
} from '../src/systems/codex'
import { createDefaultPlayerState } from '../src/state/playerState'
import type { PlayerState } from '../src/types'

function cleared(through: number, patch: Partial<PlayerState> = {}): PlayerState {
  const ids = WORLDS.slice(0, through).flatMap((w) => w.stages.map((s) => s.id))
  return {
    ...createDefaultPlayerState('Sim'),
    stageProgress: { highestUnlocked: Math.min(ids.length + 1, STAGES.length), completedStageIds: ids },
    ...patch,
  }
}

const fresh = () => createDefaultPlayerState('New')
const veteran = (patch: Partial<PlayerState> = {}) => cleared(WORLDS.length, patch)

describe('discovery is derived', () => {
  it('records nothing for a brand new hero', () => {
    const state = fresh()
    expect(foundTraits(state).size).toBe(0)
    expect(foundStatuses(state).size).toBe(0)
    expect(foundSets(state).size).toBe(0)
    expect(codexProgress(state).found).toBe(0)
  })

  it('fills in retroactively for a save that predates the Codex', () => {
    // The whole reason discovery is derived rather than stored: a player who
    // had already cleared half the campaign opens the Codex to a filled-in
    // book, not an empty one, and no migration was needed to do it.
    // Ten worlds in, exactly the four original traits have been met — the
    // eight added for the back half start at World 13 — so the assertion is
    // "the book is filling in", not an invented number.
    const state = cleared(10)
    expect(foundTraits(state).size).toBe(4)
    expect(codexProgress(state).found).toBeGreaterThanOrEqual(4)
    expect(codexProgress(state).found).toBeLessThan(codexProgress(veteran()).found)
  })

  it('counts a trait only once the stage carrying it is actually cleared', () => {
    const withStage3 = {
      ...fresh(),
      stageProgress: { highestUnlocked: 4, completedStageIds: ['stage-3'] },
    }
    const stage3Trait = STAGES[2].enemy.trait!
    expect(foundTraits(withStage3).has(stage3Trait)).toBe(true)
    // Unlocking a stage is not clearing it.
    const unlockedOnly = { ...fresh(), stageProgress: { highestUnlocked: 40, completedStageIds: [] } }
    expect(foundTraits(unlockedOnly).size).toBe(0)
  })

  it('ignores stage ids that are not real stages', () => {
    // Tower floors and rift weeks live in their own namespaces and must never
    // count towards the campaign's book.
    const forged = {
      ...fresh(),
      stageProgress: { highestUnlocked: 1, completedStageIds: ['tower-40', 'rift-9', 'nonsense'] },
    }
    expect(foundTraits(forged).size).toBe(0)
    expect(foundStatuses(forged).size).toBe(0)
  })

  it('counts a trait a boss only wears after a phase change', () => {
    // The player fought through it to win, so they have met it.
    const swapping = STAGES.find((s) => (s.enemy.boss?.phases ?? []).some((p) => p.trait))!
    const swappedTo = swapping.enemy.boss!.phases!.find((p) => p.trait)!.trait!
    const state = {
      ...fresh(),
      stageProgress: { highestUnlocked: STAGES.length, completedStageIds: [swapping.id] },
    }
    expect(foundTraits(state).has(swappedTo)).toBe(true)
  })

  it('finds a set from owning one piece of it', () => {
    const piece = ITEMS.find((item) => item.setId)!
    const state = { ...fresh(), ownedItemIds: [piece.id] }
    expect(foundSets(state).has(piece.setId!)).toBe(true)
    expect(foundSets(state).size).toBe(1)
  })
})

describe('the book is complete and reachable', () => {
  it("lists every trait, status, set and the kin's own relics", () => {
    const state = veteran()
    expect(traitEntries(state)).toHaveLength(ENEMY_TRAITS.length)
    expect(traitEntries(state)).toHaveLength(TRAIT_IDS.length)
    expect(statusEntries(state)).toHaveLength(STATUSES.length)
    expect(statusEntries(state)).toHaveLength(STATUS_IDS.length)
    expect(setEntries(state)).toHaveLength(SETS.length)
    expect(relicEntries(state)).toHaveLength(RELIC_RANKS.length)
  })

  it('shows only relics the hero could actually earn', () => {
    // Listing all eighteen would be showing fifteen a hero can never have.
    const state = veteran()
    for (const entry of relicEntries(state)) {
      expect(entry.value.raceId).toBe(state.raceId)
    }
    expect(relicEntries(state).map((e) => e.value.id)).toEqual(
      relicsForRace(state.raceId).map((r) => r.id),
    )
  })

  it('leaves no trait in the book that the campaign cannot show', () => {
    // A permanently unfillable row is a bug the player would read as a
    // mystery, so the catalogue and the campaign have to agree.
    const reachable = traitsReachableInCampaign()
    for (const trait of ENEMY_TRAITS) {
      expect(reachable.has(trait.id), `${trait.id} appears on no stage`).toBe(true)
    }
  })

  it('gives every set members to find', () => {
    for (const set of SETS) {
      expect(setMemberNames(set.id).length, set.id).toBeGreaterThanOrEqual(4)
    }
  })

  it('fills every trait and set for a hero who cleared the campaign and bought the shop', () => {
    const state = veteran({ ownedItemIds: ITEMS.map((item) => item.id) })
    expect(traitEntries(state).every((e) => e.found)).toBe(true)
    expect(setEntries(state).every((e) => e.found)).toBe(true)
  })

  it('gives every unfound row a hint, and every found row none', () => {
    const half = cleared(6)
    for (const entry of [...traitEntries(half), ...statusEntries(half), ...setEntries(half), ...relicEntries(half)]) {
      if (entry.found) expect(entry.hintKey).toBe('')
      else expect(entry.hintKey.length).toBeGreaterThan(0)
    }
  })
})

describe('progress counting', () => {
  it('never exceeds the total and only ever grows with progress', () => {
    let previous = 0
    for (let worlds = 0; worlds <= WORLDS.length; worlds++) {
      const p = codexProgress(cleared(worlds))
      expect(p.found, `world ${worlds}`).toBeLessThanOrEqual(p.total)
      expect(p.found, `world ${worlds}`).toBeGreaterThanOrEqual(previous)
      previous = p.found
    }
  })

  it('adds the same total for everyone, whatever their kin', () => {
    // The totals differ only by kin relics, which are three for every kin.
    const totals = new Set(
      ['human', 'elf', 'dwarf', 'orc', 'fae', 'undead'].map(
        (raceId) => codexProgress(veteran({ raceId: raceId as never })).total,
      ),
    )
    expect(totals.size).toBe(1)
  })
})
