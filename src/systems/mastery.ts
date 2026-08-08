import { BOSS_STAGE_IDS, worldOfStage } from '../data/worlds'
import { RELIC_BY_ID, relicsForRace } from '../data/relics'
import { STAGE_BY_ID } from '../data/stages'
import type { ModifierSource } from './combatModifiers'
import type { RelicConfig } from '../data/relics'
import type { PlayerState } from '../types'

/** Mastery stops climbing here; the last rank lands on a fully cleared campaign. */
export const MAX_MASTERY_RANK = 10

/** A cleared stage is worth the index of the world it sits in. */
export const XP_PER_WORLD_INDEX = 1
/** A world's boss is worth three times a normal stage in that world. */
export const BOSS_XP_MULTIPLIER = 3

/**
 * Mastery experience for the kin the save is playing.
 *
 * Weighting by world index rather than counting stages is what stops mastery
 * from being a second copy of "stages cleared": a World 20 stage moves the bar
 * twenty times as far as a World 1 stage, so farming the opening worlds — which
 * an idle game makes very easy — cannot walk the track to the top.
 *
 * Like skill points, this is **derived and never stored**. The only inputs are
 * `completedStageIds`, which the validator has already filtered down to real
 * stage ids, so there is no number in the save a hand edit could inflate.
 */
/**
 * Experience a whole campaign is worth: every stage of every world.
 *
 * Ascension banks this rather than forgetting it. A track that reset with the
 * campaign would punish the player for ascending — they would lose the relics
 * they had earned on this kin at exactly the moment the game asked them to
 * start again, which is the worst possible moment to take something away.
 */
export const XP_PER_CAMPAIGN = 7 * ((20 * 21) / 2)

export function masteryXpFor(completedStageIds: string[], ascensions = 0): number {
  const banked = Math.max(0, Math.floor(ascensions)) * XP_PER_CAMPAIGN
  return banked + completedStageIds.reduce((total, id) => {
    const stage = STAGE_BY_ID.get(id)
    if (!stage) return total
    const worth = worldOfStage(stage).index * XP_PER_WORLD_INDEX
    return total + (BOSS_STAGE_IDS.includes(id) ? worth * BOSS_XP_MULTIPLIER : worth)
  }, 0)
}

export function masteryXp(state: PlayerState): number {
  return masteryXpFor(state.stageProgress.completedStageIds, state.ascension.count)
}

/**
 * Cumulative experience needed for each rank.
 *
 * Every threshold is exactly "clear worlds 1..W outright", for a widening run of
 * worlds. Clearing a whole world therefore always lands a rank early on and
 * always makes visible progress later, and the numbers are checkable by hand
 * rather than being a curve nobody can reason about.
 */
const RANK_WORLDS = [1, 2, 3, 5, 7, 9, 12, 15, 18, 20]

/** Experience earned by clearing every stage of worlds 1..W. */
function xpThroughWorld(world: number): number {
  // 4 normal stages at w each, plus one boss at 3w: 7w per world.
  return 7 * ((world * (world + 1)) / 2)
}

export const RANK_THRESHOLDS: number[] = RANK_WORLDS.map(xpThroughWorld)

export function rankForXp(xp: number): number {
  return RANK_THRESHOLDS.filter((threshold) => xp >= threshold).length
}

export function masteryRank(state: PlayerState): number {
  return rankForXp(masteryXp(state))
}

export interface MasteryProgress {
  rank: number
  xp: number
  /** Experience at which the current rank began; 0 at rank 0. */
  rankStart: number
  /** Experience needed for the next rank, or null at the cap. */
  nextAt: number | null
  /** How far through the current rank, in [0,1]. 1 at the cap. */
  fraction: number
}

export function masteryProgress(state: PlayerState): MasteryProgress {
  const xp = masteryXp(state)
  const rank = masteryRank(state)
  const rankStart = rank === 0 ? 0 : RANK_THRESHOLDS[rank - 1]
  const nextAt = rank >= MAX_MASTERY_RANK ? null : RANK_THRESHOLDS[rank]
  const fraction = nextAt === null ? 1 : (xp - rankStart) / (nextAt - rankStart)
  return { rank, xp, rankStart, nextAt, fraction: Math.min(1, Math.max(0, fraction)) }
}

/**
 * The per-rank ramp, identical for every kin.
 *
 * Kept small and uniform on purpose. The interesting, kin-specific power on
 * this track lives in the relics, where the player picks it; a large hidden
 * ramp would move the whole campaign's balance without ever appearing as a
 * decision. At the cap this is roughly +16% damage dealt and -10% taken, and it
 * only gets there once the campaign is finished.
 */
export const OUTGOING_PER_RANK = 1.015
export const INCOMING_PER_RANK = 0.99

export function rankModifiers(rank: number): ModifierSource {
  const clamped = Math.min(Math.max(rank, 0), MAX_MASTERY_RANK)
  return {
    outgoing: OUTGOING_PER_RANK ** clamped,
    incoming: INCOMING_PER_RANK ** clamped,
  }
}

/** Relics of the player's kin that their current rank has opened. */
export function unlockedRelics(state: PlayerState): RelicConfig[] {
  const rank = masteryRank(state)
  return relicsForRace(state.raceId).filter((relic) => relic.unlockRank <= rank)
}

export function relicOf(state: PlayerState): RelicConfig | undefined {
  const id = state.equippedRelicId
  if (!id) return undefined
  return unlockedRelics(state).find((relic) => relic.id === id)
}

/** Everything mastery contributes to a fight: the rank ramp plus the relic. */
export function masteryModifiers(state: PlayerState): ModifierSource[] {
  const relic = relicOf(state)
  return relic ? [rankModifiers(masteryRank(state)), relic.mods] : [rankModifiers(masteryRank(state))]
}

/** Returns the new state; equipping a relic that is not open is a no-op. */
export function equipRelic(state: PlayerState, relicId: string): PlayerState {
  if (!unlockedRelics(state).some((relic) => relic.id === relicId)) return state
  return { ...state, equippedRelicId: relicId }
}

export function unequipRelic(state: PlayerState): PlayerState {
  return { ...state, equippedRelicId: null }
}

/**
 * Reduces an untrusted relic id to one the save could actually have earned.
 *
 * Three ways it can fail, all of them reachable without tampering: an id from a
 * kin the save no longer plays (changing kin is a legal save edit), a relic
 * above the rank the progress supports (a cloud copy from a further-along
 * device), and an id that is not a relic at all.
 */
export function sanitizeRelic(raw: unknown, raceId: string, rank: number): string | null {
  if (typeof raw !== 'string') return null
  const relic = RELIC_BY_ID.get(raw)
  if (!relic) return null
  if (relic.raceId !== raceId) return null
  if (relic.unlockRank > rank) return null
  return relic.id
}
