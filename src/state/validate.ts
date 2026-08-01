import { SAVE_SCHEMA_VERSION, TUTORIAL_DONE } from '../types'
import type { Equipment, PlayerState } from '../types'
import { ITEM_BY_ID } from '../data/items'
import { ACHIEVEMENT_BY_ID } from '../data/achievements'
import { EQUIP_SLOTS, bestOwnedPerSlot } from '../systems/upgrades'
import { STAGES } from '../data/stages'
import { normalizeAvatar } from '../data/avatars'
import { normalizePlan } from '../data/battlePlans'
import { normalizeDifficulty } from '../data/difficulties'
import { normalizeAppearance, normalizeRace } from '../data/races'
import { statsForLevel } from '../systems/leveling'
import { POINTS_PER_BOSS, POINTS_PER_LEVEL, sanitizeLoadout, sanitizeSkills } from '../systems/skills'
import { BOSS_STAGE_IDS } from '../data/worlds'
import { systemPrefersReducedMotion } from '../platform/prefers'
import { detectLocale, isLocale } from '../i18n'

export const MAX_LEVEL = 500
export const MAX_UPGRADE_COUNT = 999

/**
 * Coerces untrusted numbers into [min, max]. Overflowed values (±Infinity, most
 * often from runaway arithmetic rather than tampering) clamp to the bound they
 * ran towards so progress survives; NaN carries no direction, so it resets.
 */
function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  if (value === Number.POSITIVE_INFINITY) return max
  if (value === Number.NEGATIVE_INFINITY) return min
  return Math.min(max, Math.max(min, Math.floor(value)))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Turns untrusted save data (localStorage, cloud, older schema versions) into a
 * valid current-schema PlayerState. Fails closed: anything that is not a
 * recognisable save object at all returns null; recognisable saves get every
 * field coerced into safe bounds and unknown ids dropped.
 */
export function parsePlayerState(raw: unknown): PlayerState | null {
  if (!isRecord(raw)) return null
  // Require at least one signature field so arbitrary objects don't "recover"
  // into a fresh save and silently overwrite whatever was there.
  if (typeof raw.name !== 'string' && typeof raw.level !== 'number') return null

  const level = clampInt(raw.level, 1, MAX_LEVEL, 1)
  const revision = clampInt(raw.revision, 0, Number.MAX_SAFE_INTEGER, 0)
  // Must be resolved before stats are derived below: an unrecognised race would
  // otherwise mean undefined growth, NaN stats, and a battle loop that only
  // ends when it hits the turn cap. Pre-v11 saves become human, whose numbers
  // are identical to the pre-race balance, so nobody's stats move.
  const raceId = normalizeRace(raw.raceId)
  const upgradesRaw = isRecord(raw.upgrades) ? raw.upgrades : {}
  const progressRaw = isRecord(raw.stageProgress) ? raw.stageProgress : {}

  const ownedItemIds = Array.isArray(raw.ownedItemIds)
    ? [...new Set(raw.ownedItemIds.filter((id): id is string => typeof id === 'string' && ITEM_BY_ID.has(id)))]
    : []

  const validStageIds = new Set(STAGES.map((s) => s.id))
  const completedStageIds = Array.isArray(progressRaw.completedStageIds)
    ? [...new Set(progressRaw.completedStageIds.filter((id): id is string => typeof id === 'string' && validStageIds.has(id)))]
    : []

  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 14) : 'Hero'

  // Pre-v4 saves have no `equipped` block. Rather than silently stripping the
  // stats those players already had, fill each slot with the best thing they own.
  const equippedRaw = isRecord(raw.equipped) ? raw.equipped : null
  const equipped = equippedRaw
    ? EQUIP_SLOTS.reduce((acc, slot) => {
        const id = equippedRaw[slot]
        // Only keep an equipped id the player actually owns and that fits the slot.
        acc[slot] =
          typeof id === 'string' && ownedItemIds.includes(id) && ITEM_BY_ID.get(id)?.slot === slot ? id : null
        return acc
      }, { weapon: null, armor: null, charm: null } as Equipment)
    : bestOwnedPerSlot(ownedItemIds)

  const lifetimeRaw = isRecord(raw.lifetime) ? raw.lifetime : {}

  // Skills come after progress because their budget is derived from it. A
  // pre-v12 save has neither field and simply starts with an empty tree, which
  // is exactly what a player who never spent a point would have.
  const bossesCleared = completedStageIds.filter((id) => BOSS_STAGE_IDS.includes(id)).length
  const skillBudget = (level - 1) * POINTS_PER_LEVEL + bossesCleared * POINTS_PER_BOSS
  const unlockedSkillIds = sanitizeSkills(raw.unlockedSkillIds, raceId, skillBudget)
  const loadout = sanitizeLoadout(raw.loadout, unlockedSkillIds)

  // v2 saves predate settings/idle; absent blocks fall back to defaults.
  const settingsRaw = isRecord(raw.settings) ? raw.settings : {}
  const idleRaw = isRecord(raw.idle) ? raw.idle : {}
  const speed = settingsRaw.battleSpeed
  const farmingStageId =
    typeof idleRaw.farmingStageId === 'string' && validStageIds.has(idleRaw.farmingStageId)
      ? idleRaw.farmingStageId
      : null
  // A future timestamp would mint free offline rewards, so never trust one.
  const lastSeenAt = clampInt(idleRaw.lastSeenAt, 0, Date.now(), Date.now())

  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    revision,
    // Pre-v9 saves have no sync marker. Defaulting it to the current revision
    // means "assume in sync", so upgrading cannot manufacture a conflict out of
    // a device that was perfectly up to date; a real divergence after this
    // point still moves both sides past it. Never trust a marker from the
    // future either — that would hide a genuine conflict.
    syncedRevision: Math.min(clampInt(raw.syncedRevision, 0, Number.MAX_SAFE_INTEGER, revision), revision),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    name,
    avatar: normalizeAvatar(raw.avatar),
    raceId,
    appearanceId: normalizeAppearance(raceId, raw.appearanceId),
    level,
    exp: clampInt(raw.exp, 0, Number.MAX_SAFE_INTEGER, 0),
    gold: clampInt(raw.gold, 0, Number.MAX_SAFE_INTEGER, 0),
    stats: statsForLevel(level, raceId),
    upgrades: {
      hp: clampInt(upgradesRaw.hp, 0, MAX_UPGRADE_COUNT, 0),
      atk: clampInt(upgradesRaw.atk, 0, MAX_UPGRADE_COUNT, 0),
      def: clampInt(upgradesRaw.def, 0, MAX_UPGRADE_COUNT, 0),
    },
    ownedItemIds,
    equipped,
    unlockedSkillIds,
    loadout,
    stageProgress: {
      highestUnlocked: clampInt(progressRaw.highestUnlocked, 1, STAGES.length, 1),
      completedStageIds,
    },
    settings: {
      battleSpeed: speed === 2 || speed === 4 ? speed : 1,
      skipCleared: settingsRaw.skipCleared === true,
      autoRepeat: settingsRaw.autoRepeat === true,
      autoAdvance: settingsRaw.autoAdvance === true,
      // Absent in pre-v5 saves: inherit the OS preference rather than forcing motion on.
      reducedMotion:
        typeof settingsRaw.reducedMotion === 'boolean' ? settingsRaw.reducedMotion : systemPrefersReducedMotion(),
      // Absent in pre-v6 saves: fall back to the browser's languages.
      locale: isLocale(settingsRaw.locale) ? settingsRaw.locale : detectLocale(),
      // Consent is never inherited: anything but an explicit true is off.
      analytics: settingsRaw.analytics === true,
      // Absent in pre-v10 saves. Brave Rush is the plan whose multipliers are
      // closest to plain trading blows, so an upgraded save fights roughly the
      // way it did before there were plans.
      battlePlan: normalizePlan(settingsRaw.battlePlan),
      // Absent in pre-v12 saves. Normal is the campaign as it was balanced, so
      // an upgraded save keeps fighting exactly the numbers it always did.
      difficulty: normalizeDifficulty(settingsRaw.difficulty),
    },
    idle: { farmingStageId, lastSeenAt },
    tutorialStep: clampInt(raw.tutorialStep, 0, TUTORIAL_DONE, 0),
    lifetime: {
      battlesWon: clampInt(lifetimeRaw.battlesWon, 0, Number.MAX_SAFE_INTEGER, 0),
      goldEarned: clampInt(lifetimeRaw.goldEarned, 0, Number.MAX_SAFE_INTEGER, 0),
    },
    claimedAchievementIds: Array.isArray(raw.claimedAchievementIds)
      ? [...new Set(raw.claimedAchievementIds.filter((id): id is string => typeof id === 'string' && ACHIEVEMENT_BY_ID.has(id)))]
      : [],
  }
}
