import { DEFAULT_DIFFICULTY, normalizeDifficulty } from '../data/difficulties'
import { STAGES } from '../data/stages'
import { parsePlayerState } from '../state/validate'
import { statsForLevel } from '../systems/leveling'
import type { DifficultyId } from '../data/difficulties'
import type { PlayerState } from '../types'

/**
 * A scratch copy of the save for the Test Lab to scribble on.
 *
 * The one rule that makes this safe is structural rather than procedural: this
 * module imports nothing from `services/`, so there is no reachable path from
 * an edit here to a write on disk or in the cloud. Getting a test state back
 * into the real save requires calling `toSavePayload` with the confirmation
 * token below, and the caller then has to persist it themselves.
 */
export interface AdminTestState {
  enabled: boolean
  /** A deep clone. Never the same object as the live save. */
  player: PlayerState
  selectedStageId: string
  difficulty: DifficultyId
  /** Simulation-only: the hero cannot drop below 1 HP. */
  invincible: boolean
  /** Simulation-only multiplier on player damage, for probing thresholds. */
  damageMultiplier: number
  /** Playback speed for a lab battle; combat maths are unaffected. */
  animationSpeed: number
}

/**
 * Plain-JSON deep clone. `PlayerState` is exactly what gets written to
 * localStorage, so it is JSON by construction — no Dates, Maps or class
 * instances to lose. `structuredClone` would work too, but a round trip
 * through JSON also proves the clone is serialisable.
 */
function deepClone(state: PlayerState): PlayerState {
  return JSON.parse(JSON.stringify(state)) as PlayerState
}

export function createTestState(source: PlayerState): AdminTestState {
  // Open on the stage the save is actually up to. Defaulting to stage 1 would
  // put the simulator on a fight nobody is asking about, and every session
  // would start by stepping the picker forward by hand.
  const order = Math.min(Math.max(source.stageProgress.highestUnlocked, 1), STAGES.length)
  return {
    enabled: true,
    player: deepClone(source),
    selectedStageId: STAGES[order - 1].id,
    difficulty: DEFAULT_DIFFICULTY,
    invincible: false,
    damageMultiplier: 1,
    animationSpeed: 1,
  }
}

/**
 * Edits the test player through the same derivation the real game uses, so a
 * hand-set level always carries the stats that level implies. Editing `stats`
 * directly is deliberately not offered: they are derived everywhere else, and
 * a lab that could desynchronise them would be testing a state the game can
 * never actually be in.
 */
export function updateTestPlayer(
  test: AdminTestState,
  patch: Partial<PlayerState>,
): AdminTestState {
  const player = { ...test.player, ...patch }
  return { ...test, player: { ...player, stats: statsForLevel(player.level, player.raceId) } }
}

/**
 * Guards the one operation that leaves the lab. A boolean argument would be
 * satisfied by any stray `true`; a named token means the call site had to be
 * written on purpose, and it reads as a confirmation at the call site too.
 */
export const APPLY_CONFIRMATION = 'apply-test-state-to-save' as const

/**
 * Converts a test state into something safe to persist, or null if the caller
 * did not confirm.
 *
 * The result goes through `parsePlayerState` rather than out as-is: every
 * bound, every unknown id and every derived field is re-checked, so no sequence
 * of lab edits can produce a save the game would refuse to load. The revision
 * is carried over untouched, so applying test state looks like an ordinary
 * edit to the sync layer rather than a fork.
 */
export function toSavePayload(test: AdminTestState, confirmation: string): PlayerState | null {
  if (confirmation !== APPLY_CONFIRMATION) return null
  return parsePlayerState(test.player)
}

export function normalizeTestState(test: AdminTestState): AdminTestState {
  return {
    ...test,
    difficulty: normalizeDifficulty(test.difficulty),
    damageMultiplier: clamp(test.damageMultiplier, 0.1, 10),
    animationSpeed: clamp(test.animationSpeed, 0.25, 8),
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}
