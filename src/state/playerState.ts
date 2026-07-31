import { SAVE_SCHEMA_VERSION } from '../types'
import type { PlayerState } from '../types'
import { statsForLevel } from '../systems/leveling'
import { DEFAULT_AVATAR } from '../data/avatars'
import { systemPrefersReducedMotion } from '../platform/prefers'
import { detectLocale } from '../i18n'

export function createDefaultPlayerState(name = 'Hero', avatar: string = DEFAULT_AVATAR): PlayerState {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    revision: 0,
    updatedAt: new Date().toISOString(),
    name,
    avatar,
    level: 1,
    exp: 0,
    gold: 0,
    stats: statsForLevel(1),
    upgrades: { hp: 0, atk: 0, def: 0 },
    ownedItemIds: [],
    equipped: { weapon: null, armor: null, charm: null },
    stageProgress: { highestUnlocked: 1, completedStageIds: [] },
    settings: {
      battleSpeed: 1,
      skipCleared: false,
      autoRepeat: false,
      autoAdvance: false,
      // Honour the OS preference for a brand new hero.
      reducedMotion: systemPrefersReducedMotion(),
      locale: detectLocale(),
    },
    idle: { farmingStageId: null, lastSeenAt: Date.now() },
    tutorialStep: 0,
  }
}
