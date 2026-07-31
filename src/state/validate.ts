import { SAVE_SCHEMA_VERSION } from '../types'
import type { PlayerState } from '../types'
import { ITEM_BY_ID } from '../data/items'
import { STAGES } from '../data/stages'
import { normalizeAvatar } from '../data/avatars'
import { statsForLevel } from '../systems/leveling'

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

  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    revision: clampInt(raw.revision, 0, Number.MAX_SAFE_INTEGER, 0),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    name,
    avatar: normalizeAvatar(raw.avatar),
    level,
    exp: clampInt(raw.exp, 0, Number.MAX_SAFE_INTEGER, 0),
    gold: clampInt(raw.gold, 0, Number.MAX_SAFE_INTEGER, 0),
    stats: statsForLevel(level),
    upgrades: {
      hp: clampInt(upgradesRaw.hp, 0, MAX_UPGRADE_COUNT, 0),
      atk: clampInt(upgradesRaw.atk, 0, MAX_UPGRADE_COUNT, 0),
      def: clampInt(upgradesRaw.def, 0, MAX_UPGRADE_COUNT, 0),
    },
    ownedItemIds,
    stageProgress: {
      highestUnlocked: clampInt(progressRaw.highestUnlocked, 1, STAGES.length, 1),
      completedStageIds,
    },
  }
}
