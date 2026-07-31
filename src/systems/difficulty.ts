import { resolveBattle } from './combat'
import { effectiveStats } from './upgrades'
import type { PlayerState, StageConfig } from '../types'

export type DifficultyTier = 'easy' | 'fair' | 'hard'

export interface StageOutlook {
  tier: DifficultyTier
  /** Share of the hero's HP still remaining after the fight, 0..1. */
  hpRemaining: number
  willWin: boolean
}

/** Message keys for the tiers; the strings themselves live in src/i18n. */
export const DIFFICULTY_LABEL_KEYS = {
  easy: 'stages.easy',
  fair: 'stages.fair',
  hard: 'stages.hard',
} as const satisfies Record<DifficultyTier, string>

/**
 * Rates a stage by simulating the fight the player would actually get.
 * Because combat is deterministic this is an exact preview, not a heuristic:
 * "Hard" means they genuinely lose, and the HP margin separates easy from fair.
 */
export function stageOutlook(state: PlayerState, stage: StageConfig): StageOutlook {
  const stats = effectiveStats(state)
  const result = resolveBattle(stats, stage.enemy, stage.rewards)

  let hpLeft = stats.maxHp
  for (const event of result.log) {
    if (event.attacker === 'enemy') hpLeft = event.targetHpAfter
  }
  const hpRemaining = stats.maxHp > 0 ? Math.max(0, hpLeft) / stats.maxHp : 0

  if (!result.win) return { tier: 'hard', hpRemaining, willWin: false }
  return { tier: hpRemaining >= 0.6 ? 'easy' : 'fair', hpRemaining, willWin: true }
}
