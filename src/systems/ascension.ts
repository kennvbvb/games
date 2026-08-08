import { STAGES } from '../data/stages'
import { EMPTY_EQUIPMENT } from './upgrades'
import type { ModifierSource } from './combatModifiers'
import type { AscensionProgress, PlayerState } from '../types'

/**
 * Ascension: finish the campaign, give it all back, keep something permanent.
 *
 * ## What resets and what does not
 *
 * The rule is that anything *earned inside a run* goes, and anything that is
 * either the player's identity or a record of something they did **outside**
 * the campaign stays. So level, gold, gear, skills and stage progress reset;
 * name, kin, look, settings, achievements, the tower record and the rift week
 * do not. Wiping a tower record on ascension would punish the player for using
 * the feature ascension exists to feed.
 *
 * ## Why the count is stored
 *
 * Same reason the tower's is: nothing else in the save implies it. A reset
 * campaign looks exactly like a campaign never played, so the only evidence an
 * ascension happened is the counter itself. It is bounded, and — unlike the
 * tower, where a forged number only unlocks a fight you lose — a forged
 * ascension count *does* hand out real power. That is accepted for the same
 * reason the rest of the save is: a player editing their own localStorage is
 * changing their own single-player game, and the validator's job is to keep the
 * game coherent rather than to win an argument it cannot win. What the bound
 * buys is that it stays coherent.
 */
export const MAX_ASCENSIONS = 99

/**
 * Ascensions that still increase the bonus. Past this the counter keeps
 * climbing as a record, but the power stops — an uncapped multiplier turns
 * every later run into a formality, and the tower into a number that only ever
 * goes up.
 */
export const BONUS_CAP = 10

/** Per-ascension permanent gains, up to BONUS_CAP of them. */
export const OUTGOING_PER_ASCENSION = 0.1
export const HP_PER_ASCENSION = 0.07

export function ascensionCount(state: PlayerState): number {
  return state.ascension.count
}

export function bonusAscensions(state: PlayerState): number {
  return Math.min(state.ascension.count, BONUS_CAP)
}

/** Ascending needs the campaign genuinely finished, every stage of it. */
export function canAscend(state: PlayerState): boolean {
  if (state.ascension.count >= MAX_ASCENSIONS) return false
  const cleared = new Set(state.stageProgress.completedStageIds)
  return STAGES.every((stage) => cleared.has(stage.id))
}

/**
 * The permanent bonus, additive in the count and then applied as a multiplier.
 * At the cap that is +100% damage dealt and +70% health.
 *
 * What that buys was measured rather than guessed. Walking the campaign and
 * then climbing the tower until it walls, per ascension count:
 *
 *   0 ascensions  ->  floor 40-60
 *   1             ->  floor 40-80
 *   2             ->  floor 40-90
 *   5             ->  floor 60-100
 *   10 (the cap)  ->  floor 80-100
 *
 * So an ascension is worth roughly five floors, or one boss gate per two of
 * them. That is the shape wanted: enough that the reset is clearly paid for,
 * not so much that the campaign it costs becomes a formality.
 */
export function ascensionModifiers(state: PlayerState): ModifierSource[] {
  const n = bonusAscensions(state)
  if (n === 0) return []
  return [{ outgoing: 1 + OUTGOING_PER_ASCENSION * n, hpScale: 1 + HP_PER_ASCENSION * n }]
}

/**
 * Performs the reset. Returns the state unchanged when the campaign is not
 * finished, so a caller that forgot to check `canAscend` cannot wipe a save.
 */
export function ascend(state: PlayerState): PlayerState {
  if (!canAscend(state)) return state
  return {
    ...state,
    level: 1,
    exp: 0,
    gold: 0,
    upgrades: { hp: 0, atk: 0, def: 0 },
    ownedItemIds: [],
    equipped: { ...EMPTY_EQUIPMENT },
    unlockedSkillIds: [],
    loadout: [],
    // The relic goes with the tree. Mastery rank survives — see systems/mastery
    // for why a finished campaign is banked rather than forgotten — so the same
    // relic can be picked straight back up.
    equippedRelicId: null,
    stageProgress: { highestUnlocked: 1, completedStageIds: [] },
    // Farming a stage that is no longer unlocked would pay for a fight the
    // player cannot reach.
    idle: { ...state.idle, farmingStageId: null },
    ascension: { count: state.ascension.count + 1 },
  }
}

export function sanitizeAscension(raw: unknown): AscensionProgress {
  const record = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const value = record.count
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) return { count: 0 }
  return { count: Math.min(MAX_ASCENSIONS, Math.floor(value)) }
}
