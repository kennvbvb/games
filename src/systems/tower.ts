import { TOWER_FIRST_FLOOR, TOWER_UNLOCK_WORLDS, towerFloor } from '../data/tower'
import { worldsCleared } from './campaignModes'
import type { StageConfig, PlayerState } from '../types'

/**
 * How far a save is allowed to claim it has climbed.
 *
 * Unlike stages and skills, a tower record cannot be derived from anything —
 * there is no list of cleared floors to count, and keeping one would grow the
 * save without bound. So `bestFloor` is stored, and the defence is different in
 * kind: it is bounded here, and it buys nothing but the right to *start* a
 * fight the tower has already made harder than the claim.
 *
 * That is the real protection. Floor health compounds at 7.5% a floor, so a
 * save that lies its way to floor 500 meets an enemy with roughly 10^15 health
 * and loses in one turn, having been paid nothing. Editing the number forward
 * skips content rather than unlocking it.
 */
export const MAX_TOWER_FLOOR = 9999

export function towerUnlocked(state: PlayerState): boolean {
  return worldsCleared(state) >= TOWER_UNLOCK_WORLDS
}

/** The deepest floor beaten; 0 before the first climb. */
export function bestFloor(state: PlayerState): number {
  return state.tower.bestFloor
}

/**
 * The floor a run resumes on: one past the deepest beaten, capped.
 *
 * Resuming rather than restarting is deliberate. An endless mode that made the
 * player re-clear forty floors to reach the one that stopped them is an endless
 * mode nobody opens twice, and every one of those forty is a fight already
 * proven won — replaying them tests nothing.
 */
export function nextFloor(state: PlayerState): number {
  return Math.min(MAX_TOWER_FLOOR, Math.max(TOWER_FIRST_FLOOR, state.tower.bestFloor + 1))
}

/** Any floor up to and including the next unbeaten one, for re-runs. */
export function canAttempt(state: PlayerState, floor: number): boolean {
  if (!towerUnlocked(state)) return false
  return floor >= TOWER_FIRST_FLOOR && floor <= nextFloor(state)
}

export function floorConfig(floor: number): StageConfig {
  return towerFloor(floor)
}

/**
 * Records a win. Only ever moves forward, so re-running an old floor for gold
 * cannot walk the record backwards, and a win on a floor the save should not
 * have reached still only advances by one.
 */
export function recordFloorCleared(state: PlayerState, floor: number): PlayerState {
  if (floor <= state.tower.bestFloor) return state
  return {
    ...state,
    tower: { bestFloor: Math.min(MAX_TOWER_FLOOR, Math.max(TOWER_FIRST_FLOOR, Math.floor(floor))) },
  }
}

/** Coerces an untrusted tower block into range. */
export function sanitizeTower(raw: unknown): { bestFloor: number } {
  const record = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const value = record.bestFloor
  if (typeof value !== 'number' || Number.isNaN(value)) return { bestFloor: 0 }
  return { bestFloor: Math.min(MAX_TOWER_FLOOR, Math.max(0, Math.floor(value))) }
}
