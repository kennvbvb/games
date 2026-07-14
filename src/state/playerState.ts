import type { PlayerState } from '../types'
import { statsForLevel } from '../systems/leveling'

export function createDefaultPlayerState(name = 'Hero', avatar = '🐱'): PlayerState {
  return {
    name,
    avatar,
    level: 1,
    exp: 0,
    gold: 0,
    stats: statsForLevel(1),
    upgrades: { hp: 0, atk: 0, def: 0 },
    ownedItemIds: [],
    stageProgress: { highestUnlocked: 1, completedStageIds: [] },
  }
}

/** Fills in fields missing from saves written by older versions of the game. */
export function normalizePlayerState(raw: Partial<PlayerState>): PlayerState {
  const defaults = createDefaultPlayerState(raw.name)
  const merged: PlayerState = {
    ...defaults,
    ...raw,
    upgrades: { ...defaults.upgrades, ...raw.upgrades },
    ownedItemIds: Array.isArray(raw.ownedItemIds) ? raw.ownedItemIds : [],
    stageProgress: { ...defaults.stageProgress, ...raw.stageProgress },
    stats: defaults.stats,
  }
  merged.stats = statsForLevel(merged.level)
  return merged
}
