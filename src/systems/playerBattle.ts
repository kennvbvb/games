import { raceOf } from '../data/races'
import { effectiveStats, gearModifiers } from './upgrades'
import { skillModifiers } from './skills'
import { masteryModifiers } from './mastery'
import { ascensionModifiers } from './ascension'
import { boonForStageId } from '../data/rifts'
import { mutatorForStageId } from '../data/towerMutators'
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
  // The tower's band rule arrives the same way, and for the same reason. Read
  // off the floor's own id rather than from the player's position, so a floor
  // fights under one rule whether it is being previewed, fought or replayed.
  const mutator = stage ? mutatorForStageId(stage.id) : undefined

  // Charmless is the one rule that cannot be expressed as a modifier: it has to
  // remove gear, because what it takes away is stats, affixes, set membership
  // and a relic's named effect all at once. Fighting under a state with the
  // accessories unequipped says exactly that, and every one of those four
  // consequences falls out of it rather than having to be listed.
  const fighting =
    mutator?.silenceAccessories === true
      ? { ...state, equipped: { ...state.equipped, accessory1: null, accessory2: null } }
      : state

  return {
    player: effectiveStats(fighting),
    passive: raceOf(fighting.raceId).passive,
    modifiers: [
      ...skillModifiers(fighting),
      ...gearModifiers(fighting),
      ...masteryModifiers(fighting),
      ...ascensionModifiers(fighting),
      ...(boon ? [boon.mods] : []),
      ...(mutator?.mods ? [mutator.mods] : []),
    ],
  }
}
