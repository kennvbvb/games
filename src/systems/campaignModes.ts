import { DIFFICULTIES, normalizeDifficulty } from '../data/difficulties'
import { WORLDS, worldCleared } from '../data/worlds'
import type { DifficultyId, DifficultyMode } from '../data/difficulties'
import type { PlayerState } from '../types'

/**
 * How many worlds the player has cleared outright.
 *
 * Gating on *fully cleared worlds* rather than on the furthest unlocked stage
 * is deliberate: unlocking runs one stage ahead of clearing, so a player who
 * lost to a boss would otherwise open a harder mode on the strength of a fight
 * they did not win.
 */
export function worldsCleared(state: PlayerState): number {
  return WORLDS.filter((world) => worldCleared(state, world) === world.stages.length).length
}

export function isDifficultyUnlocked(state: PlayerState, mode: DifficultyMode): boolean {
  return worldsCleared(state) >= mode.unlockAfterWorlds
}

export function unlockedDifficulties(state: PlayerState): DifficultyMode[] {
  return DIFFICULTIES.filter((mode) => isDifficultyUnlocked(state, mode))
}

/**
 * The mode actually in force. A save can name a mode it has not earned — by a
 * hand edit, or by a cloud copy from a device that had cleared more — so the
 * setting is re-checked against progress on every read rather than trusted from
 * the moment it was written.
 */
export function activeDifficulty(state: PlayerState): DifficultyId {
  const wanted = normalizeDifficulty(state.settings.difficulty)
  const mode = DIFFICULTIES.find((m) => m.id === wanted)
  if (mode && isDifficultyUnlocked(state, mode)) return wanted
  return 'normal'
}
