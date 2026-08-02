import { raceOf } from '../data/races'
import { effectiveStats, gearModifiers } from './upgrades'
import { skillModifiers } from './skills'
import { masteryModifiers } from './mastery'
import type { BattleContext } from './combat'
import type { PlayerState } from '../types'

/**
 * Everything about the *player* that a fight depends on, in one place.
 *
 * Four call sites resolve battles — the battle scene, the stage preview,
 * offline farming and the test lab — and they have to agree exactly, or the
 * preview stops being a preview. Assembling the player's half here means a new
 * source of combat power (skills today, gear affixes tomorrow) reaches all four
 * at once instead of three of them and a bug report.
 */
export function playerBattleInputs(
  state: PlayerState,
): Pick<BattleContext, 'player' | 'passive' | 'modifiers'> {
  return {
    player: effectiveStats(state),
    passive: raceOf(state.raceId).passive,
    modifiers: [...skillModifiers(state), ...gearModifiers(state), ...masteryModifiers(state)],
  }
}
