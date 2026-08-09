import {
  REMIX_TIERS,
  REMIX_TIER_BY_ID,
  relicForRemix,
  remixStage,
  parseRemixStageId,
} from '../data/bossRemix'
import { WORLDS } from '../data/worlds'
import { ITEM_BY_ID } from '../data/items'
import { worldsCleared } from './campaignModes'
import type { RemixTier, RemixTierId } from '../data/bossRemix'
import type { PlayerState, StageConfig } from '../types'

/**
 * Boss Remix, entirely derived.
 *
 * Every question this mode has to answer already has an answer in the save:
 * which bosses are open comes from cleared stages, which tiers are open comes
 * from worlds cleared, and which relics are still to win comes from what the
 * player owns. So there is no remix block in the save, no schema bump, and no
 * new bound to defend — see data/bossRemix for why that was the goal rather
 * than a happy accident.
 */

/** Bosses whose remix is open: the ones already beaten in the campaign. */
export function unlockedRemixWorlds(state: PlayerState): number[] {
  return WORLDS.filter((world) => state.stageProgress.completedStageIds.includes(world.boss.id)).map(
    (world) => world.index,
  )
}

export function remixUnlocked(state: PlayerState): boolean {
  return unlockedRemixWorlds(state).length > 0
}

export function tierUnlocked(state: PlayerState, tier: RemixTier): boolean {
  return worldsCleared(state) >= tier.unlockWorlds
}

export function unlockedTiers(state: PlayerState): RemixTier[] {
  return REMIX_TIERS.filter((tier) => tierUnlocked(state, tier))
}

export function canFightRemix(state: PlayerState, world: number, tierId: RemixTierId): boolean {
  const tier = REMIX_TIER_BY_ID.get(tierId)
  if (!tier) return false
  return unlockedRemixWorlds(state).includes(world) && tierUnlocked(state, tier)
}

export function remixConfig(world: number, tierId: RemixTierId): StageConfig {
  return remixStage(world, tierId)
}

/**
 * The relic a remix still owes the player, or undefined.
 *
 * "Still owes" rather than "pays": ownership *is* the first-clear record here,
 * so a relic already won stops being a reason to come back and the list stops
 * advertising it.
 */
export function pendingRemixRelic(
  state: PlayerState,
  world: number,
  tierId: RemixTierId,
): string | undefined {
  const itemId = relicForRemix(world, tierId)
  if (!itemId || state.ownedItemIds.includes(itemId)) return undefined
  return itemId
}

/** Hands over a remix's relic, if it has one and the player does not. */
export function grantRemixRelic(state: PlayerState, stageId: string): PlayerState {
  const parsed = parseRemixStageId(stageId)
  if (!parsed) return state
  const itemId = pendingRemixRelic(state, parsed.world, parsed.tier)
  if (!itemId || !ITEM_BY_ID.has(itemId)) return state
  return { ...state, ownedItemIds: [...state.ownedItemIds, itemId] }
}

/** How many of the six remix relics are already in the bag. */
export function remixRelicsWon(state: PlayerState): number {
  return WORLDS.reduce((total, world) => {
    const itemId = relicForRemix(world.index, 'mythic')
    return total + (itemId && state.ownedItemIds.includes(itemId) ? 1 : 0)
  }, 0)
}
