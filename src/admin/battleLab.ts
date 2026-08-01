import { enemyFor, rewardsFor } from '../data/difficulties'
import { PLAN_IDS } from '../data/battlePlans'
import { RACE_IDS, raceOf } from '../data/races'
import { resolveBattle } from '../systems/combat'
import { effectiveStats } from '../systems/upgrades'
import { statsForLevel } from '../systems/leveling'
import { expWithRacePassive } from '../systems/rewards'
import type { DifficultyId } from '../data/difficulties'
import type { PlanId } from '../data/battlePlans'
import type { RaceId } from '../data/races'
import type { BattleResult, PlayerState, StageConfig } from '../types'

/**
 * Headless battle simulation.
 *
 * Everything here runs the *same* `resolveBattle` the game does — a second
 * implementation tuned for speed would be a simulator of a game nobody plays.
 * Measurements are read back off the returned log rather than instrumented into
 * combat, so adding a metric here can never change a fight's outcome.
 */

export interface LabMetrics {
  outcome: BattleResult['outcome']
  win: boolean
  turns: number
  damageDealt: number
  damageTaken: number
  healedByPlayer: number
  healedByEnemy: number
  playerDodges: number
  enemyDodges: number
  playerHpLeft: number
  playerMaxHp: number
  enemyHpLeft: number
  enemyMaxHp: number
  /** EXP and gold actually banked, race bonus and difficulty included. */
  exp: number
  gold: number
  /** Why the fight was lost, or null when it was won. */
  lossReason: LossReason | null
}

/**
 * A loss diagnosis, taken from what actually happened rather than from a
 * heuristic on the stat block. "Add more attack" is advice a player can already
 * guess; "you got it to 8% and ran out of health" is the thing they cannot see.
 */
export type LossReason = 'stalemate' | 'damage' | 'survivability' | 'narrow'

/** Message keys for the diagnoses; the strings live in src/i18n. */
export const LOSS_REASON_KEYS = {
  stalemate: 'loss.stalemate',
  damage: 'loss.damage',
  survivability: 'loss.survivability',
  narrow: 'loss.narrow',
} as const satisfies Record<LossReason, string>

/** Enemy health still standing above this share means damage was the problem. */
const DAMAGE_PROBLEM_ABOVE = 0.5
/** Below this, the fight was very nearly won and a small change would flip it. */
const NARROW_BELOW = 0.15

export function diagnoseLoss(result: BattleResult, enemyMaxHp: number): LossReason | null {
  if (result.win) return null
  if (result.outcome === 'timeout') return 'stalemate'
  const left = enemyMaxHp > 0 ? result.enemyHpLeft / enemyMaxHp : 1
  if (left <= NARROW_BELOW) return 'narrow'
  if (left >= DAMAGE_PROBLEM_ABOVE) return 'damage'
  return 'survivability'
}

export function measure(
  result: BattleResult,
  playerMaxHp: number,
  enemyMaxHp: number,
  raceId: RaceId | string | undefined,
): LabMetrics {
  let damageDealt = 0
  let damageTaken = 0
  let healedByPlayer = 0
  let healedByEnemy = 0
  let playerDodges = 0
  let enemyDodges = 0

  for (const event of result.log) {
    if (event.attacker === 'player') {
      damageDealt += event.damage
      healedByPlayer += event.healed ?? 0
      // A dodged *player* attack is the enemy dodging, and vice versa. Counting
      // by who evaded rather than by who swung is what a reader expects.
      if (event.dodged) enemyDodges += 1
    } else {
      damageTaken += event.damage
      healedByEnemy += event.healed ?? 0
      if (event.dodged) playerDodges += 1
    }
  }

  return {
    outcome: result.outcome,
    win: result.win,
    turns: result.log.length > 0 ? result.log[result.log.length - 1].turn : 0,
    damageDealt,
    damageTaken,
    healedByPlayer,
    healedByEnemy,
    playerDodges,
    enemyDodges,
    playerHpLeft: result.playerHpLeft,
    playerMaxHp,
    enemyHpLeft: result.enemyHpLeft,
    enemyMaxHp,
    exp: expWithRacePassive(result.rewards.exp, raceId),
    gold: result.rewards.gold,
    lossReason: diagnoseLoss(result, enemyMaxHp),
  }
}

export interface LabRun {
  player: PlayerState
  stage: StageConfig
  plan?: PlanId
  difficulty?: DifficultyId
  /** Overrides the player's own race, for the compare-all-races view. */
  raceId?: RaceId
}

/**
 * Runs one fight and reports on it.
 *
 * Overriding the race re-derives stats from level rather than keeping the
 * player's, because a race's stat block *is* most of what distinguishes it —
 * comparing races while holding stats fixed would compare only the passives.
 */
export function runLab(run: LabRun): { result: BattleResult; metrics: LabMetrics } {
  const raceId = run.raceId ?? run.player.raceId
  const base =
    run.raceId && run.raceId !== run.player.raceId
      ? { ...run.player, raceId: run.raceId, stats: statsForLevel(run.player.level, run.raceId) }
      : run.player
  const stats = effectiveStats(base)
  const enemy = enemyFor(run.stage.enemy, run.difficulty)

  const result = resolveBattle({
    player: stats,
    enemy,
    rewards: rewardsFor(run.stage.rewards, run.difficulty),
    plan: run.plan ?? base.settings.battlePlan,
    passive: raceOf(raceId).passive,
  })

  return { result, metrics: measure(result, stats.maxHp, enemy.maxHp, raceId) }
}

/** Every plan against one stage — the comparison the Prepare screen shows. */
export function comparePlans(run: Omit<LabRun, 'plan'>): Record<PlanId, LabMetrics> {
  return Object.fromEntries(
    PLAN_IDS.map((plan) => [plan, runLab({ ...run, plan }).metrics]),
  ) as Record<PlanId, LabMetrics>
}

/** Every race against one stage, each at the player's level with its own stats. */
export function compareRaces(run: Omit<LabRun, 'raceId'>): Record<RaceId, LabMetrics> {
  return Object.fromEntries(
    RACE_IDS.map((raceId) => [raceId, runLab({ ...run, raceId }).metrics]),
  ) as Record<RaceId, LabMetrics>
}

/**
 * Repeats a run N times to prove it is reproducible.
 *
 * Combat is deterministic today, so this must return exactly one distinct
 * result — which is the assertion worth having. If randomness is ever
 * introduced, this becomes the win-rate sampler the handoff asks for without
 * the call sites changing.
 */
export function repeat(run: LabRun, times: number): { distinct: number; sample: LabMetrics } {
  const seen = new Set<string>()
  let sample: LabMetrics | null = null
  for (let i = 0; i < times; i++) {
    const { metrics } = runLab(run)
    seen.add(JSON.stringify(metrics))
    sample ??= metrics
  }
  return { distinct: seen.size, sample: sample! }
}

const CSV_COLUMNS: (keyof LabMetrics)[] = [
  'outcome',
  'turns',
  'damageDealt',
  'damageTaken',
  'healedByPlayer',
  'healedByEnemy',
  'playerDodges',
  'enemyDodges',
  'playerHpLeft',
  'playerMaxHp',
  'enemyHpLeft',
  'enemyMaxHp',
  'exp',
  'gold',
  'lossReason',
]

/** Labelled rows to CSV. Values are numbers and known words, so no quoting is needed. */
export function toCsv(rows: Record<string, LabMetrics>): string {
  const header = ['label', ...CSV_COLUMNS].join(',')
  const body = Object.entries(rows).map(([label, metrics]) =>
    [label, ...CSV_COLUMNS.map((key) => String(metrics[key] ?? ''))].join(','),
  )
  return [header, ...body].join('\n')
}
