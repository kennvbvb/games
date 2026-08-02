import { SAVE_SCHEMA_VERSION } from '../types'
import type { PlayerState } from '../types'
import type { RaceId } from '../data/races'
import { statsForLevel } from '../systems/leveling'
import { EMPTY_EQUIPMENT } from '../systems/upgrades'
import { DEFAULT_AVATAR } from '../data/avatars'
import { DEFAULT_PLAN } from '../data/battlePlans'
import { DEFAULT_DIFFICULTY } from '../data/difficulties'
import { DEFAULT_RACE, raceOf } from '../data/races'
import { systemPrefersReducedMotion } from '../platform/prefers'
import { detectLocale } from '../i18n'

export function createDefaultPlayerState(
  name = 'Hero',
  avatar: string = DEFAULT_AVATAR,
  raceId: RaceId = DEFAULT_RACE,
  appearanceId: string = raceOf(DEFAULT_RACE).appearances[0],
): PlayerState {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    revision: 0,
    syncedRevision: 0,
    updatedAt: new Date().toISOString(),
    name,
    avatar,
    raceId,
    appearanceId,
    level: 1,
    exp: 0,
    gold: 0,
    stats: statsForLevel(1, raceId),
    upgrades: { hp: 0, atk: 0, def: 0 },
    ownedItemIds: [],
    equipped: { ...EMPTY_EQUIPMENT },
    unlockedSkillIds: [],
    loadout: [],
    equippedRelicId: null,
    stageProgress: { highestUnlocked: 1, completedStageIds: [] },
    settings: {
      battleSpeed: 1,
      skipCleared: false,
      autoRepeat: false,
      autoAdvance: false,
      // Honour the OS preference for a brand new hero.
      reducedMotion: systemPrefersReducedMotion(),
      locale: detectLocale(),
      analytics: false,
      battlePlan: DEFAULT_PLAN,
      difficulty: DEFAULT_DIFFICULTY,
    },
    idle: { farmingStageId: null, lastSeenAt: Date.now() },
    tutorialStep: 0,
    lifetime: { battlesWon: 0, goldEarned: 0 },
    claimedAchievementIds: [],
  }
}
