import { BALANCE } from '../data/balance'
import type { PlayerState, PlayerStats } from '../types'

export function expToNext(level: number): number {
  return Math.round(BALANCE.baseExpToLevel * Math.pow(level, BALANCE.expCurveExponent))
}

export function statsForLevel(level: number): PlayerStats {
  const levelsGained = level - 1
  return {
    maxHp: BALANCE.baseStats.maxHp + levelsGained * BALANCE.statsPerLevel.maxHp,
    atk: BALANCE.baseStats.atk + levelsGained * BALANCE.statsPerLevel.atk,
    def: BALANCE.baseStats.def + levelsGained * BALANCE.statsPerLevel.def,
  }
}

export function applyExp(state: PlayerState, gainedExp: number): PlayerState {
  let level = state.level
  let exp = state.exp + gainedExp
  let threshold = expToNext(level)

  while (exp >= threshold) {
    exp -= threshold
    level += 1
    threshold = expToNext(level)
  }

  return { ...state, level, exp, stats: statsForLevel(level) }
}
