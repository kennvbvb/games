import { ITEM_BY_ID } from '../data/items'
import { STAGE_BY_ID, STAGES_PER_WORLD } from '../data/stages'
import { worldOfStage } from '../data/worlds'
import type { PlayerState, StageConfig } from '../types'

/**
 * Per-item mastery, earned by winning fights while the piece is worn.
 *
 * ## Why this one is stored
 *
 * Almost everything in this save is derived rather than written down — stats
 * from level and kin, skill points from levels and bosses, kin mastery from
 * cleared stages, codex discovery from progress. That discipline is what makes
 * an edited save unable to keep what it claims.
 *
 * A per-item win count cannot be derived. Nothing in the save records *which
 * pieces were worn* for a fight that has already happened, and keeping that
 * history would grow the save without bound. So this joins `tower.bestFloor`,
 * `rift.clearedWeek` and `ascension.count` as a stored exception — and, like
 * them, it is bounded rather than trusted:
 *
 * - every count is clamped to `WINS_FOR_MAX`, so no save can claim more
 *   progress than the track has to give;
 * - every count is clamped to `lifetime.battlesWon`, because a piece cannot
 *   have been worn for more wins than the hero has ever won. That single bound
 *   is what stops a fresh save arriving with everything mastered;
 * - unknown item ids are dropped entirely.
 *
 * What is left to gain by editing is at most +6% of a worn item's own stat
 * line, which is the ceiling the design wants anyway (see below).
 *
 * ## Why the numbers are deliberately small
 *
 * The expansion plan is explicit that mastery must not make a player afraid to
 * try new gear, and that high ranks should lean cosmetic. So only two of the
 * five ranks pay anything mechanical at all, and what they pay is a percentage
 * of *that item's own bonus* — +3% at rank 2, +6% at rank 4. On a legendary
 * +110 HP chestpiece, full mastery is worth about seven health. It is a goal
 * attached to a piece, not a reason to keep wearing it.
 *
 * Ranks 3 and 5 grant nothing but the rank itself, which the Equipment screen
 * and the Collection Book show.
 */

/** Cumulative wins needed to reach each rank; index 0 is rank 1. */
export const RANK_WINS = [0, 10, 30, 75, 150] as const

export const MAX_EQUIP_RANK = RANK_WINS.length

export const WINS_FOR_MAX = RANK_WINS[RANK_WINS.length - 1]

/** Multiplier on the item's own stat bonus, by rank. Ranks 3 and 5 are cosmetic. */
const RANK_STAT_SCALE = [1, 1.03, 1.03, 1.06, 1.06] as const

/**
 * How far below the frontier a stage still teaches something.
 *
 * The plan asks that farming Stage 1 at the end of the game earn nothing. A
 * band rather than a single stage, because "only the newest fight counts" would
 * make mastery hostage to whichever stage happens to be next, and re-clearing
 * the world you are actually standing in is normal play.
 */
export const FRONTIER_BAND = 2

/** Wins credited per fight to a piece that has fallen behind the player's best. */
export const CATCH_UP_MULTIPLIER = 2

export function winsFor(state: PlayerState, itemId: string): number {
  return state.equipmentMastery[itemId] ?? 0
}

export function rankForWins(wins: number): number {
  let rank = 1
  for (let i = 1; i < RANK_WINS.length; i += 1) {
    if (wins >= RANK_WINS[i]) rank = i + 1
  }
  return rank
}

export function equipRank(state: PlayerState, itemId: string): number {
  return rankForWins(winsFor(state, itemId))
}

/** Wins still needed for the next rank, or null at the top. */
export function winsToNextRank(wins: number): number | null {
  const rank = rankForWins(wins)
  if (rank >= MAX_EQUIP_RANK) return null
  return RANK_WINS[rank] - wins
}

export function statScaleForRank(rank: number): number {
  const index = Math.min(Math.max(Math.floor(rank), 1), MAX_EQUIP_RANK) - 1
  return RANK_STAT_SCALE[index]
}

/** The multiplier a worn piece's stat line is scaled by, from its own mastery. */
export function masteryStatScale(state: PlayerState, itemId: string): number {
  return statScaleForRank(equipRank(state, itemId))
}

/**
 * Whether a fight is worth mastery at all.
 *
 * Tower floors and rifts always are: both scale to the player rather than
 * sitting at a fixed depth, so there is no such thing as grinding an easy one.
 * A campaign stage has to be within `FRONTIER_BAND` worlds of where the player
 * has actually reached.
 */
export function creditsMastery(state: PlayerState, stage: StageConfig): boolean {
  const campaign = STAGE_BY_ID.get(stage.id)
  if (!campaign) return true
  const reachedWorld = Math.ceil(state.stageProgress.highestUnlocked / STAGES_PER_WORLD)
  return worldOfStage(campaign).index >= reachedWorld - FRONTIER_BAND
}

/**
 * Highest win count on any piece the player owns — the bar a new piece is
 * measured against for catch-up.
 */
export function bestOwnedWins(state: PlayerState): number {
  return state.ownedItemIds.reduce((best, id) => Math.max(best, winsFor(state, id)), 0)
}

/**
 * Records a win for every worn piece.
 *
 * Deliberately *not* wired into `applyRewards`, which is also what offline
 * farming pays through. An eight-hour offline session settles hundreds of
 * fights at once and would take every worn piece to full mastery in a single
 * collection — the track would finish itself while the game was closed. Mastery
 * is credited for fights the player turned up for.
 */
export function recordFightWon(state: PlayerState, stage: StageConfig): PlayerState {
  if (!creditsMastery(state, stage)) return state
  const worn = new Set(Object.values(state.equipped).filter((id): id is string => id !== null))
  if (worn.size === 0) return state

  // Read once, before anything moves: a piece that catches up mid-loop must not
  // change the bar for the piece after it, or the result would depend on slot
  // order rather than on what the player is wearing.
  const bar = bestOwnedWins(state)
  const next = { ...state.equipmentMastery }
  for (const id of worn) {
    const current = next[id] ?? 0
    const step = current < bar ? CATCH_UP_MULTIPLIER : 1
    next[id] = Math.min(WINS_FOR_MAX, current + step)
  }
  return { ...state, equipmentMastery: next }
}

/**
 * Coerces an untrusted mastery block into range.
 *
 * `battlesWon` is the hard ceiling: no piece can have been worn for more wins
 * than the hero has ever had. It is why this bound is applied here, where the
 * lifetime tally is already known, rather than inside the record function.
 */
export function sanitizeEquipmentMastery(raw: unknown, battlesWon: number): Record<string, number> {
  if (typeof raw !== 'object' || raw === null) return {}
  const ceiling = Math.min(WINS_FOR_MAX, Math.max(0, Math.floor(battlesWon)))
  const clean: Record<string, number> = {}
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!ITEM_BY_ID.has(id)) continue
    if (typeof value !== 'number' || Number.isNaN(value)) continue
    const wins = Math.min(ceiling, Math.max(0, Math.floor(value)))
    if (wins > 0) clean[id] = wins
  }
  return clean
}
