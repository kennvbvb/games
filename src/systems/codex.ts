import { ENEMY_TRAITS, traitOf } from '../data/enemyTraits'
import { STATUSES } from '../data/statuses'
import { SETS } from '../data/sets'
import { RELICS, relicsForRace } from '../data/relics'
import { STAGE_BY_ID, STAGES } from '../data/stages'
import { ITEMS, ITEM_BY_ID } from '../data/items'
import { masteryRank } from './mastery'
import type { EnemyTrait } from '../data/enemyTraits'
import type { StatusConfig, StatusId } from '../data/statuses'
import type { SetConfig } from '../data/sets'
import type { RelicConfig } from '../data/relics'
import type { PlayerState } from '../types'

/**
 * The Codex: everything the player has actually met, and nothing else.
 *
 * Discovery is **entirely derived**. There is no `discoveredTraitIds` in the
 * save and no schema change to add one, because every answer is already
 * implied by progress the save keeps anyway: a trait is known once a stage
 * carrying it has been cleared, a status once something that inflicts it has,
 * a set once a piece of it is owned, a relic once mastery has opened it.
 *
 * That is worth the small cost of recomputing it on every open. A stored
 * discovery list is a second copy of the truth: it drifts when content is
 * renamed, it is trivially edited, and it silently mis-reports for a player
 * whose save predates the field. Deriving it means the Codex is exactly as
 * correct as the progress it reads, always, including retroactively.
 */

export interface CodexEntry<T> {
  value: T
  found: boolean
  /** Short line explaining what would reveal it; empty once found. */
  hintKey: string
}

/** Stages the player has genuinely cleared, as real stage configs. */
function clearedStages(state: PlayerState) {
  return state.stageProgress.completedStageIds
    .map((id) => STAGE_BY_ID.get(id))
    .filter((stage): stage is NonNullable<typeof stage> => stage !== undefined)
}

/**
 * Traits met in a cleared fight — including the ones a boss only wears after a
 * phase change, since the player did have to fight through them to win.
 */
export function foundTraits(state: PlayerState): Set<string> {
  const found = new Set<string>()
  for (const stage of clearedStages(state)) {
    found.add(stage.enemy.trait ?? 'straightforward')
    for (const phase of stage.enemy.boss?.phases ?? []) {
      if (phase.trait) found.add(phase.trait)
    }
  }
  return found
}

/**
 * Statuses met, from every trait and boss phase that inflicts one on a stage
 * already cleared. Beneficial statuses the player's own build applies are not
 * counted here — the Codex records what the campaign has shown them.
 */
export function foundStatuses(state: PlayerState): Set<StatusId> {
  const found = new Set<StatusId>()
  for (const stage of clearedStages(state)) {
    const trait = traitOf(stage.enemy.trait)
    if (trait.inflict) found.add(trait.inflict.id)
    for (const phase of stage.enemy.boss?.phases ?? []) {
      if (phase.inflict) found.add(phase.inflict.id)
      if (phase.trait) {
        const swapped = traitOf(phase.trait)
        if (swapped.inflict) found.add(swapped.inflict.id)
      }
    }
  }
  return found
}

/** Sets with at least one piece owned. */
export function foundSets(state: PlayerState): Set<string> {
  const found = new Set<string>()
  for (const id of state.ownedItemIds) {
    const setId = ITEM_BY_ID.get(id)?.setId
    if (setId) found.add(setId)
  }
  return found
}

export function traitEntries(state: PlayerState): CodexEntry<EnemyTrait>[] {
  const found = foundTraits(state)
  return ENEMY_TRAITS.map((trait) => ({
    value: trait,
    found: found.has(trait.id),
    hintKey: found.has(trait.id) ? '' : 'codex.hintTrait',
  }))
}

export function statusEntries(state: PlayerState): CodexEntry<StatusConfig>[] {
  const found = foundStatuses(state)
  return STATUSES.map((status) => ({
    value: status,
    found: found.has(status.id),
    hintKey: found.has(status.id) ? '' : 'codex.hintStatus',
  }))
}

export function setEntries(state: PlayerState): CodexEntry<SetConfig>[] {
  const found = foundSets(state)
  return SETS.map((set) => ({
    value: set,
    found: found.has(set.id),
    hintKey: found.has(set.id) ? '' : 'codex.hintSet',
  }))
}

/**
 * Relics of the player's own kin only.
 *
 * Listing all eighteen would be showing a player fifteen things they can never
 * have on this hero — the tree is per-kin and so is this. The locked ones that
 * *are* listed are reachable, which is what makes a locked row worth reading.
 */
export function relicEntries(state: PlayerState): CodexEntry<RelicConfig>[] {
  const rank = masteryRank(state)
  return relicsForRace(state.raceId).map((relic) => ({
    value: relic,
    found: relic.unlockRank <= rank,
    hintKey: relic.unlockRank <= rank ? '' : 'codex.hintRelic',
  }))
}

export interface CodexProgress {
  found: number
  total: number
}

/** How much of the Codex is filled in, across every category. */
export function codexProgress(state: PlayerState): CodexProgress {
  const entries = [
    ...traitEntries(state),
    ...statusEntries(state),
    ...setEntries(state),
    ...relicEntries(state),
  ]
  return { found: entries.filter((e) => e.found).length, total: entries.length }
}

/** Every trait the campaign can actually show, for the test that nothing is unreachable. */
export function traitsReachableInCampaign(): Set<string> {
  const reachable = new Set<string>()
  for (const stage of STAGES) {
    reachable.add(stage.enemy.trait ?? 'straightforward')
    for (const phase of stage.enemy.boss?.phases ?? []) {
      if (phase.trait) reachable.add(phase.trait)
    }
  }
  return reachable
}

/** Names of the pieces that make up a set, for the Codex row. */
export function setMemberNames(setId: string): string[] {
  return ITEMS.filter((item) => item.setId === setId).map((item) => item.name)
}

export { SETS, RELICS }
