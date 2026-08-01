import type { PlayerState, BattleResult } from '../types'
import { applyExp } from './leveling'
import { raceOf } from '../data/races'
import type { RaceId } from '../data/races'

/**
 * A race's EXP bonus lives here rather than in the turn loop, so it cannot
 * change a fight's outcome and therefore cannot skew the stage preview.
 *
 * Applied per battle, so an offline payout is a clean multiple of what a single
 * fight shows rather than a rounded lump.
 */
export function expWithRacePassive(exp: number, raceId: RaceId | string | undefined): number {
  const bonus = raceOf(raceId).expBonus
  return bonus === undefined ? exp : Math.round(exp * bonus)
}

export function applyRewards(state: PlayerState, result: BattleResult): PlayerState {
  if (!result.win) return state
  return applyExp(
    {
      ...state,
      gold: state.gold + result.rewards.gold,
      lifetime: {
        battlesWon: state.lifetime.battlesWon + 1,
        goldEarned: state.lifetime.goldEarned + result.rewards.gold,
      },
    },
    expWithRacePassive(result.rewards.exp, state.raceId),
  )
}
