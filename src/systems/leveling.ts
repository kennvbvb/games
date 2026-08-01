import { BALANCE } from '../data/balance'
import { raceOf } from '../data/races'
import type { RaceId } from '../data/races'
import type { PlayerState, PlayerStats } from '../types'

export function expToNext(level: number): number {
  return Math.round(BALANCE.baseExpToLevel * Math.pow(level, BALANCE.expCurveExponent))
}

/**
 * Stats are a function of level and race, never read from the save. That is
 * what stops an edited stat block from sticking, and it means rebalancing a
 * race applies retroactively to everyone with no migration.
 *
 * `raceOf` fails closed to human, so an unrecognised race can never produce
 * undefined growth and NaN stats.
 */
export function statsForLevel(level: number, raceId?: RaceId | string): PlayerStats {
  const { baseStats, growth } = raceOf(raceId)
  const levelsGained = level - 1
  return {
    maxHp: baseStats.maxHp + levelsGained * growth.maxHp,
    atk: baseStats.atk + levelsGained * growth.atk,
    def: baseStats.def + levelsGained * growth.def,
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

  return { ...state, level, exp, stats: statsForLevel(level, state.raceId) }
}
