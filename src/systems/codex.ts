import { ENEMY_TRAITS, traitOf } from '../data/enemyTraits'
import { STATUSES } from '../data/statuses'
import { SETS } from '../data/sets'
import { RELICS, relicsForRace } from '../data/relics'
import { STAGE_BY_ID, STAGES } from '../data/stages'
import { ITEMS, ITEM_BY_ID } from '../data/items'
import { masteryRank } from './mastery'
import { equipRank } from './equipmentMastery'
import { buildOf } from '../data/builds'
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

/**
 * Every piece of gear in the game, owned or not — the Collection Book half of
 * the Codex.
 *
 * Owning it is the discovery rule, and it is the only rule that could be: a
 * piece has no other trace in the save. Which means the shelf doubles as the
 * completion track the expansion plan asks for, without a second list to keep
 * in step with the first.
 *
 * Locked rows still say where the piece comes from rather than hiding it. A
 * collection that conceals what is missing cannot tell you how much is left,
 * which is most of the reason anyone opens one.
 */
export function itemEntries(state: PlayerState): CodexEntry<(typeof ITEMS)[number]>[] {
  const owned = new Set(state.ownedItemIds)
  return ITEMS.map((item) => ({
    value: item,
    found: owned.has(item.id),
    hintKey: owned.has(item.id)
      ? ''
      : item.source === 'tower'
        ? 'codex.hintTower'
        : item.source === 'remix'
          ? 'codex.hintRemix'
          : 'codex.hintShop',
  }))
}

/** The one line a collected piece shows: what it is for, and how far it has come. */
export function itemSummary(state: PlayerState, item: (typeof ITEMS)[number]): string {
  const parts: string[] = [buildOf(item.buildTag).id]
  const rank = equipRank(state, item.id)
  if (rank > 1) parts.push(`★${rank}`)
  if (item.effect) parts.push(item.effect.description)
  return parts.join(' · ')
}

export interface CodexProgress {
  found: number
  total: number
}

/**
 * Completion milestones, as fractions of the whole book.
 *
 * The expansion plan attaches an appearance, a title, a frame and a backdrop to
 * these. None of those systems exists yet, and inventing four of them to hang
 * off a percentage would be building the reward before the thing it rewards. So
 * the milestones ship as what they already are — a stated target and the count
 * still needed — and the cosmetics wait until there is somewhere to put them.
 */
export const CODEX_MILESTONES = [0.25, 0.5, 0.75, 1] as const

export interface CodexMilestone {
  /** The fraction itself, e.g. 0.5. */
  at: number
  /** Entries still needed to reach it; 0 once it is passed. */
  remaining: number
}

/** The next milestone not yet reached, or null once the book is complete. */
export function nextMilestone(progress: CodexProgress): CodexMilestone | null {
  for (const at of CODEX_MILESTONES) {
    const needed = Math.ceil(progress.total * at)
    if (progress.found < needed) return { at, remaining: needed - progress.found }
  }
  return null
}

/** How much of the Codex is filled in, across every category. */
export function codexProgress(state: PlayerState): CodexProgress {
  const entries = [
    ...itemEntries(state),
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
