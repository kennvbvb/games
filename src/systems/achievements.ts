import { ACHIEVEMENTS, ACHIEVEMENT_BY_ID } from '../data/achievements'
import type { Achievement } from '../data/achievements'
import type { PlayerState } from '../types'

export interface AchievementStatus {
  achievement: Achievement
  current: number
  /** Progress towards the target, 0..1. */
  ratio: number
  complete: boolean
  claimed: boolean
  /** Complete but not yet claimed — the only state with an action attached. */
  claimable: boolean
}

export function achievementStatus(state: PlayerState, achievement: Achievement): AchievementStatus {
  const current = Math.max(0, achievement.progress(state))
  const complete = current >= achievement.target
  const claimed = state.claimedAchievementIds.includes(achievement.id)
  return {
    achievement,
    current: Math.min(current, achievement.target),
    ratio: achievement.target > 0 ? Math.min(1, current / achievement.target) : 0,
    complete,
    claimed,
    claimable: complete && !claimed,
  }
}

/** Claimable first, then in-progress, then claimed — the useful order to read. */
export function achievementList(state: PlayerState): AchievementStatus[] {
  const rank = (s: AchievementStatus) => (s.claimable ? 0 : s.claimed ? 2 : 1)
  return ACHIEVEMENTS.map((a) => achievementStatus(state, a)).sort(
    (a, b) => rank(a) - rank(b) || b.ratio - a.ratio,
  )
}

export function claimableCount(state: PlayerState): number {
  return ACHIEVEMENTS.reduce((n, a) => n + (achievementStatus(state, a).claimable ? 1 : 0), 0)
}

/** Pays out an achievement's reward once. Returns null if it isn't claimable. */
export function claimAchievement(state: PlayerState, id: string): PlayerState | null {
  const achievement = ACHIEVEMENT_BY_ID.get(id)
  if (!achievement) return null
  if (!achievementStatus(state, achievement).claimable) return null
  return {
    ...state,
    gold: state.gold + achievement.reward,
    // Claim rewards count as earned, so they feed the wealth achievement too.
    lifetime: { ...state.lifetime, goldEarned: state.lifetime.goldEarned + achievement.reward },
    claimedAchievementIds: [...state.claimedAchievementIds, id],
  }
}
