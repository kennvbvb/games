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

const LABELS: Record<DifficultyTier, string> = { easy: 'Easy', fair: 'Fair', hard: 'Hard' }

export function difficultyLabel(tier: DifficultyTier): string {
  return LABELS[tier]
}

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
