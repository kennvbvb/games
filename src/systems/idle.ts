import { BALANCE } from '../data/balance'
import { STAGES } from '../data/stages'
import { resolveBattle } from './combat'
import { effectiveStats } from './upgrades'
import type { PlayerState, StageRewards } from '../types'

export interface OfflineReport {
  /** Real elapsed time, before the cap is applied. */
  elapsedMs: number
  /** Time actually paid out, i.e. elapsed clamped to the cap. */
  creditedMs: number
  /** True when the player was away longer than the cap. */
  capped: boolean
  stageName: string
  battles: number
  rewards: StageRewards
}

/**
 * Works out what the hero earned while the game was closed.
 *
 * The hero keeps auto-fighting the stage they were last farming, so we only
 * pay out if they can actually still win it — an idle game shouldn't reward
 * a stage the player has outgrown downwards, and it must never hand out
 * progress for a fight that would be lost.
 */
export function computeOfflineRewards(state: PlayerState, now: number): OfflineReport | null {
  const stageId = state.idle.farmingStageId
  if (!stageId) return null

  const stage = STAGES.find((s) => s.id === stageId)
  if (!stage) return null

  const elapsedMs = now - state.idle.lastSeenAt
  if (!Number.isFinite(elapsedMs) || elapsedMs < BALANCE.idle.minRewardMs) return null

  const creditedMs = Math.min(elapsedMs, BALANCE.idle.maxOfflineMs)
  // Offline fights use the plan the player last committed to, not whichever
  // plan happens to win — otherwise the payout contradicts every forecast they
  // were shown before closing the tab.
  const outcome = resolveBattle({
    player: effectiveStats(state),
    enemy: stage.enemy,
    rewards: stage.rewards,
    plan: state.settings.battlePlan,
  })
  if (!outcome.win) return null

  const battles = Math.floor(creditedMs / BALANCE.idle.msPerBattle)
  if (battles <= 0) return null

  return {
    elapsedMs,
    creditedMs,
    capped: elapsedMs > BALANCE.idle.maxOfflineMs,
    stageName: stage.name,
    battles,
    rewards: {
      exp: stage.rewards.exp * battles,
      gold: stage.rewards.gold * battles,
    },
  }
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  return `${Math.max(1, minutes)}m`
}
