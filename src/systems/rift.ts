import { RIFT_UNLOCK_WORLDS, WEEK_MS, riftFor, weekIndex, weekStart } from '../data/rifts'
import { worldsCleared } from './campaignModes'
import type { Rift } from '../data/rifts'
import type { PlayerState, RiftProgress } from '../types'

export function riftUnlocked(state: PlayerState): boolean {
  return worldsCleared(state) >= RIFT_UNLOCK_WORLDS
}

/**
 * This week's rift as *this save* fights it: same boon, same bane, same look,
 * with the numbers scaled off the worlds already cleared. See data/rifts.
 */
export function currentRift(state: PlayerState, now: number = Date.now()): Rift {
  return riftFor(weekIndex(now), worldsCleared(state))
}

export function riftCleared(state: PlayerState, now: number = Date.now()): boolean {
  return state.rift.clearedWeek === weekIndex(now)
}

/**
 * Whether this week's rift is still worth fighting for its payout.
 *
 * Losing does not consume the week — a rift the player cannot beat yet should
 * stay open so they can come back with a better build, which is the whole
 * reason the pre-fight forecast exists.
 */
export function riftAvailable(state: PlayerState, now: number = Date.now()): boolean {
  return riftUnlocked(state) && !riftCleared(state, now)
}

/**
 * Records this week's clear. A second win in the same week is a no-op, so
 * re-running the rift for practice cannot be farmed for a second payout — the
 * reward itself is suppressed at the call site by `riftAvailable`.
 */
export function recordRiftCleared(state: PlayerState, now: number = Date.now()): PlayerState {
  const week = weekIndex(now)
  if (state.rift.clearedWeek === week) return state
  return { ...state, rift: { clearedWeek: week } }
}

/** Milliseconds until the rift rotates. */
export function msUntilNextRift(now: number = Date.now()): number {
  return weekStart(weekIndex(now) + 1) - now
}

/**
 * Coerces an untrusted rift block.
 *
 * A week from the future is clamped to the current one rather than kept:
 * left alone it would mark the rift cleared for every week up to that point,
 * which is the one way an edited save could lock itself out of content instead
 * of granting itself some.
 */
export function sanitizeRift(raw: unknown, now: number = Date.now()): RiftProgress {
  const record = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const value = record.clearedWeek
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) return { clearedWeek: -1 }
  return { clearedWeek: Math.min(Math.floor(value), weekIndex(now)) }
}

export { WEEK_MS, weekIndex }
