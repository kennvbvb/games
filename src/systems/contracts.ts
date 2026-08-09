import {
  CONTRACTS_PER_WEEK,
  CONTRACTS_TO_CLEAR,
  CONTRACT_GRACE_WEEKS,
  CONTRACT_REWARD,
  contractWeek,
  contractsForWeek,
} from '../data/contracts'
import { isTowerStageId } from '../data/tower'
import { isRemixStageId } from '../data/bossRemix'
import { isBossStage } from '../data/stages'
import { applyExp } from './leveling'
import type { ContractConfig } from '../data/contracts'
import type { PlanId } from '../data/battlePlans'
import type { BattleResult, ContractProgress, PlayerState, StageConfig } from '../types'

/**
 * Weekly Contracts.
 *
 * Progress genuinely cannot be derived — nothing in the save records that ten
 * fights were won under one plan — so this is the fifth and last stored block,
 * alongside the tower record, the rift week, the ascension count and equipment
 * mastery. It is bounded the same way they are: counters clamp to their own
 * targets, the week is clamped to the current one, and the unclaimed queue is
 * both length-capped and age-capped.
 *
 * The bound that matters here is different in kind, though. The reward is gold
 * and EXP, both of which idle farming already hands out without limit, so a
 * save that forges a finished week gains nothing it could not have got by
 * waiting. That is the same reasoning that keeps the Realm Rift's reward
 * deliberately cheap, and it is why no stronger defence is needed.
 */

export interface ContractView {
  config: ContractConfig
  count: number
  done: boolean
}

export function emptyContracts(week = contractWeek()): ContractProgress {
  return { week, counts: [], unclaimed: [] }
}

/** This week's block, resetting the counters if they belong to an older week. */
export function currentContracts(state: PlayerState, now = Date.now()): ContractProgress {
  const week = contractWeek(now)
  if (state.contracts.week === week) return state.contracts
  return { week, counts: [], unclaimed: state.contracts.unclaimed }
}

export function contractViews(state: PlayerState, now = Date.now()): ContractView[] {
  const block = currentContracts(state, now)
  return contractsForWeek(block.week).map((config, i) => {
    const count = Math.min(config.target, block.counts[i] ?? 0)
    return { config, count, done: count >= config.target }
  })
}

export function clearedThisWeek(state: PlayerState, now = Date.now()): number {
  return contractViews(state, now).filter((view) => view.done).length
}

export function weekComplete(state: PlayerState, now = Date.now()): boolean {
  return clearedThisWeek(state, now) >= CONTRACTS_TO_CLEAR
}

/** Finished weeks still waiting to be paid, oldest first. */
export function claimableWeeks(state: PlayerState, now = Date.now()): number[] {
  const week = contractWeek(now)
  return state.contracts.unclaimed
    .filter((w) => w <= week && w > week - CONTRACT_GRACE_WEEKS)
    .sort((a, b) => a - b)
}

/** Whether one fight satisfies one contract. */
function satisfies(
  config: ContractConfig,
  stage: StageConfig,
  result: BattleResult,
  plan: PlanId,
): boolean {
  switch (config.kind) {
    case 'winsWithPlan':
      return plan === config.plan
    case 'towerFloors':
      return isTowerStageId(stage.id)
    case 'remixWins':
      return isRemixStageId(stage.id)
    case 'beatTrait':
      // The trait the enemy *opened* on. A boss that swaps into it partway is
      // not what the contract asked for, and counting it would make the job
      // impossible to aim at.
      return stage.enemy.trait === config.trait
    case 'bossHealthy':
      return (
        (isBossStage(stage) || isRemixStageId(stage.id)) &&
        result.playerHpLeft >= result.playerMaxHp * (config.healthAbove ?? 0.4)
      )
  }
}

/**
 * Records a won fight against this week's three contracts.
 *
 * Called from the one place a fight finishes, so the tower, the rift, the remix
 * and the campaign all feed it without four separate call sites to keep in
 * step. A loss is not offered here at all — every contract in the pool is
 * phrased as something you did, not something you attempted.
 */
export function recordContractWin(
  state: PlayerState,
  stage: StageConfig,
  result: BattleResult,
  plan: PlanId,
  now = Date.now(),
): PlayerState {
  if (!result.win) return state
  const block = currentContracts(state, now)
  const configs = contractsForWeek(block.week)

  const counts = Array.from({ length: CONTRACTS_PER_WEEK }, (_, i) => {
    const config = configs[i]
    const current = Math.min(config?.target ?? 0, block.counts[i] ?? 0)
    if (!config || current >= config.target) return current
    return satisfies(config, stage, result, plan) ? current + 1 : current
  })

  const next: ContractProgress = { ...block, counts }
  const done = counts.filter((count, i) => configs[i] && count >= configs[i].target).length
  // Queued the moment it is earned, not when the screen is next opened — a
  // reward that only exists while you are looking at it is a reward you lose by
  // closing the game, which is the exact thing the grace period is for.
  if (done >= CONTRACTS_TO_CLEAR && !next.unclaimed.includes(block.week)) {
    next.unclaimed = [...next.unclaimed, block.week]
  }
  return { ...state, contracts: next }
}

/** Pays every week that is owed, and clears the queue of them. */
export function claimContracts(state: PlayerState, now = Date.now()): PlayerState {
  const owed = claimableWeeks(state, now)
  if (owed.length === 0) return state
  const paid = applyExp(
    {
      ...state,
      gold: state.gold + CONTRACT_REWARD.gold * owed.length,
      lifetime: {
        ...state.lifetime,
        goldEarned: state.lifetime.goldEarned + CONTRACT_REWARD.gold * owed.length,
      },
    },
    CONTRACT_REWARD.exp * owed.length,
  )
  const block = currentContracts(paid, now)
  return {
    ...paid,
    contracts: { ...block, unclaimed: block.unclaimed.filter((w) => !owed.includes(w)) },
  }
}

/** Coerces an untrusted contract block into range. */
export function sanitizeContracts(raw: unknown, now = Date.now()): ContractProgress {
  const week = contractWeek(now)
  if (typeof raw !== 'object' || raw === null) return emptyContracts(week)
  const record = raw as Record<string, unknown>

  // A block from the future would let an edited clock bank weeks in advance;
  // reading it as the current week costs an honest player nothing.
  const claimed = typeof record.week === 'number' && Number.isFinite(record.week) ? Math.floor(record.week) : week
  const stampedWeek = Math.min(Math.max(0, claimed), week)

  const configs = contractsForWeek(stampedWeek)
  const rawCounts = Array.isArray(record.counts) ? record.counts : []
  const counts = configs.map((config, i) => {
    const value = rawCounts[i]
    if (typeof value !== 'number' || Number.isNaN(value)) return 0
    return Math.min(config.target, Math.max(0, Math.floor(value)))
  })

  const rawUnclaimed = Array.isArray(record.unclaimed) ? record.unclaimed : []
  const unclaimed = [
    ...new Set(
      rawUnclaimed
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
        .map((value) => Math.floor(value))
        .filter((w) => w <= week && w > week - CONTRACT_GRACE_WEEKS),
    ),
  ]
    .sort((a, b) => a - b)
    .slice(-CONTRACT_GRACE_WEEKS)

  return { week: stampedWeek, counts, unclaimed }
}
