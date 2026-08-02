import { resolveBattle } from './combat'
import { playerBattleInputs } from './playerBattle'
import { activeDifficulty } from './campaignModes'
import { enemyFor, rewardsFor } from '../data/difficulties'
import { PLAN_IDS } from '../data/battlePlans'
import type { PlanId } from '../data/battlePlans'
import type { BattleOutcome, PlayerState, StageConfig } from '../types'

export type DifficultyTier = 'easy' | 'fair' | 'hard'

export interface StageOutlook {
  tier: DifficultyTier
  /** Share of the hero's HP still remaining after the fight, 0..1. */
  hpRemaining: number
  willWin: boolean
  outcome: BattleOutcome
  /** How long the fight runs; breaks ties between two winning plans. */
  turns: number
}

/** Message keys for the tiers; the strings themselves live in src/i18n. */
export const DIFFICULTY_LABEL_KEYS = {
  easy: 'stages.easy',
  fair: 'stages.fair',
  hard: 'stages.hard',
} as const satisfies Record<DifficultyTier, string>

/**
 * The Prepare Battle wording for the same three tiers. Two vocabularies, one
 * source of truth — a second tiering function could drift and leave the stage
 * card and the plan picker disagreeing about the same fight.
 */
export const FORECAST_LABEL_KEYS = {
  easy: 'plan.forecastStrong',
  fair: 'plan.forecastClose',
  hard: 'plan.forecastDanger',
} as const satisfies Record<DifficultyTier, string>

/**
 * Rates a stage by simulating the fight the player would actually get, under
 * the plan they would actually use. Because combat is deterministic this is an
 * exact preview, not a heuristic: "Hard" means they genuinely lose, and the HP
 * margin separates easy from fair.
 *
 * Deliberately not memoised. A sim is a few hundred integer operations —
 * cheaper than a cache lookup — and a cache key would have to cover level,
 * every effective stat, plan and stage. Miss one and the preview starts lying,
 * which is the one thing this function must never do.
 */
export function stageOutlook(state: PlayerState, stage: StageConfig, plan?: PlanId): StageOutlook {
  const inputs = playerBattleInputs(state)
  const result = resolveBattle({
    ...inputs,
    enemy: enemyFor(stage.enemy, activeDifficulty(state)),
    rewards: rewardsFor(stage.rewards, activeDifficulty(state)),
    plan: plan ?? state.settings.battlePlan,
  })

  // Against the pool the fight was fought with, not the pre-skill one: a hero
  // whose build scales Max HP would otherwise be told it has 110% left.
  const hpRemaining =
    result.playerMaxHp > 0 ? Math.max(0, result.playerHpLeft) / result.playerMaxHp : 0
  const turns = result.log.length > 0 ? result.log[result.log.length - 1].turn : 0

  if (!result.win) return { tier: 'hard', hpRemaining, willWin: false, outcome: result.outcome, turns }
  return {
    tier: hpRemaining >= 0.6 ? 'easy' : 'fair',
    hpRemaining,
    willWin: true,
    outcome: result.outcome,
    turns,
  }
}

/** Every plan's outlook for one stage — only worth computing on Prepare Battle. */
export function planOutlooks(state: PlayerState, stage: StageConfig): Record<PlanId, StageOutlook> {
  return Object.fromEntries(PLAN_IDS.map((plan) => [plan, stageOutlook(state, stage, plan)])) as Record<
    PlanId,
    StageOutlook
  >
}

/** Above this share of HP left, the fight is not in doubt and speed matters more. */
const COMFORTABLE = 0.6

/**
 * The plan to suggest. Returns null when nothing clears the stage — crowning
 * the least-bad option would imply a path that does not exist.
 *
 * Ranking by survival alone would never recommend an aggressive plan: measured
 * across the whole plausible stat range, hitting harder never turns a loss into
 * a win, it only ends a fight sooner. So when at least one plan wins
 * comfortably, the useful advice is the fastest of those; when every win is
 * close, it goes back to whichever leaves the most health.
 */
export function recommendPlan(
  state: PlayerState,
  stage: StageConfig,
): { plan: PlanId; outlook: StageOutlook } | null {
  const outlooks = planOutlooks(state, stage)
  const winners = PLAN_IDS.filter((plan) => outlooks[plan].willWin)
  if (winners.length === 0) return null

  const comfortable = winners.filter((plan) => outlooks[plan].hpRemaining >= COMFORTABLE)
  const pool = comfortable.length > 0 ? comfortable : winners
  const bySpeed = comfortable.length > 0

  const best = pool.reduce((a, b) => {
    const left = outlooks[a]
    const right = outlooks[b]
    if (bySpeed) {
      if (left.turns !== right.turns) return left.turns < right.turns ? a : b
      return left.hpRemaining >= right.hpRemaining ? a : b
    }
    if (left.hpRemaining !== right.hpRemaining) return left.hpRemaining > right.hpRemaining ? a : b
    if (left.turns !== right.turns) return left.turns < right.turns ? a : b
    return a
  })
  return { plan: best, outlook: outlooks[best] }
}
