import type { PlayerState } from '../types'

export type ResolutionSource = 'local' | 'cloud'

export type SaveResolution =
  /** Only one copy exists, or only one moved since the last sync. */
  | { kind: 'use'; source: ResolutionSource }
  /** Both copies moved since they last agreed; only the player can pick. */
  | { kind: 'conflict' }

/**
 * Decides what to do with a local and a cloud save.
 *
 * `revision` alone cannot distinguish "the cloud is simply behind" from "both
 * devices played independently" — in both cases one number is larger. What
 * separates them is `syncedRevision`, the last revision at which this device
 * confirmed it matched the cloud. If both sides have moved past that shared
 * ancestor, the histories have genuinely forked and picking a winner by size
 * silently throws away whichever pile of progress happens to be smaller.
 */
export function detectConflict(local: PlayerState | null, cloud: PlayerState | null): SaveResolution {
  if (!local) return { kind: 'use', source: 'cloud' }
  if (!cloud) return { kind: 'use', source: 'local' }

  const base = local.syncedRevision
  if (local.revision > base && cloud.revision > base) return { kind: 'conflict' }

  // Only one side moved — or neither did, in which case an upgraded save has
  // no useful ancestor and the old higher-revision rule is the best guess left.
  return { kind: 'use', source: local.revision > cloud.revision ? 'local' : 'cloud' }
}

/** A short, comparable summary of a save, for showing two side by side. */
export interface SaveSummary {
  name: string
  avatar: string
  level: number
  gold: number
  stagesCleared: number
  updatedAt: number
}

export function summarize(state: PlayerState): SaveSummary {
  const updatedAt = Date.parse(state.updatedAt)
  return {
    name: state.name,
    avatar: state.avatar,
    level: state.level,
    gold: state.gold,
    stagesCleared: state.stageProgress.completedStageIds.length,
    updatedAt: Number.isNaN(updatedAt) ? 0 : updatedAt,
  }
}

/**
 * Which copy is further along, used only to suggest a default — the player
 * still chooses. Deliberately not a merge: combining two divergent saves would
 * invent a state neither device ever had.
 */
export function suggestedSource(local: PlayerState, cloud: PlayerState): ResolutionSource {
  const score = (s: PlayerState) =>
    s.stageProgress.completedStageIds.length * 1000 + s.level * 10 + Math.min(9, Math.floor(s.gold / 1000))
  const diff = score(local) - score(cloud)
  if (diff !== 0) return diff > 0 ? 'local' : 'cloud'
  return summarize(local).updatedAt >= summarize(cloud).updatedAt ? 'local' : 'cloud'
}
