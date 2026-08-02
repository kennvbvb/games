import { raceOf } from '../data/races'
import { effectiveStats, gearModifiers } from './upgrades'
import { skillModifiers } from './skills'
import { masteryModifiers } from './mastery'
import { boonForStageId } from '../data/rifts'
import type { BattleContext } from './combat'
import type { PlayerState, StageConfig } from '../types'

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
  stage?: StageConfig,
): Pick<BattleContext, 'player' | 'passive' | 'modifiers'> {
  // The Realm Rift lends the player a boon for that one fight. It arrives here
  // rather than at the four call sites for the same reason everything else
  // does: a source of power the preview does not know about is a preview that
  // lies. The boon comes off the stage's own id, never the clock — see
  // data/rifts.
  const boon = stage ? boonForStageId(stage.id) : undefined
  return {
    player: effectiveStats(state),
    passive: raceOf(state.raceId).passive,
    modifiers: [
      ...skillModifiers(state),
      ...gearModifiers(state),
      ...masteryModifiers(state),
      ...(boon ? [boon.mods] : []),
    ],
  }
}
