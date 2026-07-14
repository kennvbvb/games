import type { PlayerState, BattleResult } from '../types'
import { applyExp } from './leveling'

export function applyRewards(state: PlayerState, result: BattleResult): PlayerState {
  if (!result.win) return state
  return applyExp({ ...state, gold: state.gold + result.rewards.gold }, result.rewards.exp)
}
