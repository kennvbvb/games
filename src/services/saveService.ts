import type { PlayerState } from '../types'
import { parsePlayerState } from '../state/validate'
import { getSupabase } from './supabaseClient'
import { setSyncStatus } from './syncStatus'
import { flushAnalytics, setAnalyticsEnabled, shouldFlush } from './analytics'
import { detectConflict } from '../systems/conflict'
import { setReducedMotionPreference } from '../ui/motion'
import { setLocale } from '../i18n'

// Saves are namespaced so signing in or out can never surface another
// profile's progress: the guest slot and each account's slot are separate keys
// and are never read across namespaces automatically.
const KEY_PREFIX = 'incremental-rpg-save-v2'
const LEGACY_KEY = 'incremental-rpg-save-v1'
const QUARANTINE_KEY = `${KEY_PREFIX}:quarantine`
/** Holds the copy the player rejected the last time two saves forked. */
const CONFLICT_BACKUP_KEY = `${KEY_PREFIX}:conflict-backup`

function localKey(userId: string | null): string {
  return userId ? `${KEY_PREFIX}:user:${userId}` : `${KEY_PREFIX}:guest`
}

/** Pre-v2 saves lived in a single shared key; adopt them into the guest slot once. */
function migrateLegacyKey(): void {
  const legacy = localStorage.getItem(LEGACY_KEY)
  if (legacy === null) return
  if (localStorage.getItem(localKey(null)) === null) {
    localStorage.setItem(localKey(null), legacy)
  }
  localStorage.removeItem(LEGACY_KEY)
}

export function saveLocal(state: PlayerState, userId: string | null): void {
  localStorage.setItem(localKey(userId), JSON.stringify(state))
}

/**
 * Reads a namespaced local save. Corrupted or unrecognisable data is moved to
 * a quarantine key (kept for manual recovery) instead of crashing the game.
 */
export function loadLocal(userId: string | null): PlayerState | null {
  migrateLegacyKey()
  const key = localKey(userId)
  const raw = localStorage.getItem(key)
  if (raw === null) return null
  let parsed: PlayerState | null = null
  try {
    parsed = parsePlayerState(JSON.parse(raw))
  } catch {
    parsed = null
  }
  if (parsed === null) {
    console.warn(`Save in ${key} was unreadable; moved to ${QUARANTINE_KEY}`)
    localStorage.setItem(QUARANTINE_KEY, raw)
    localStorage.removeItem(key)
    return null
  }
  // Persist the upgraded shape straight away so an older blob isn't re-migrated
  // on every load, and so what's on disk always matches the current schema.
  const canonical = JSON.stringify(parsed)
  if (canonical !== raw) localStorage.setItem(key, canonical)
  // UI code reads this synchronously while building scenes, so apply it here
  // rather than making every scene reach into the save.
  setReducedMotionPreference(parsed.settings.reducedMotion)
  setLocale(parsed.settings.locale)
  setAnalyticsEnabled(parsed.settings.analytics)
  return parsed
}

export function clearLocal(userId: string | null): void {
  localStorage.removeItem(localKey(userId))
}

/** True if a guest save exists that a freshly signed-in account could import. */
export function hasGuestSave(): boolean {
  migrateLegacyKey()
  return localStorage.getItem(localKey(null)) !== null
}

async function saveCloud(userId: string, state: PlayerState): Promise<void> {
  const pending = getSupabase()
  if (!pending) throw new Error('Cloud accounts are not configured')
  const { error } = await (await pending)
    .from('saves')
    .upsert({ user_id: userId, state, revision: state.revision, updated_at: new Date().toISOString() })
  if (error) throw error
}

async function loadCloud(userId: string): Promise<PlayerState | null> {
  const pending = getSupabase()
  if (!pending) throw new Error('Cloud accounts are not configured')
  const { data, error } = await (await pending)
    .from('saves')
    .select('state')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.state === undefined ? null : parsePlayerState(data.state)
}

/**
 * Persist immediately: bumps the revision, always mirrors to the caller's own
 * namespace in localStorage, and best-effort syncs to the cloud when signed in.
 * Returns the stamped state so callers can keep the new revision in memory.
 */
export async function persist(state: PlayerState, userId: string | null): Promise<PlayerState> {
  let stamped: PlayerState = {
    ...state,
    revision: state.revision + 1,
    updatedAt: new Date().toISOString(),
  }
  saveLocal(stamped, userId)
  if (userId) {
    setSyncStatus('saving')
    try {
      await saveCloud(userId, stamped)
      // Record the point at which the two copies agree. Everything after this
      // is unsynced local work, which is what makes a fork detectable later.
      stamped = { ...stamped, syncedRevision: stamped.revision }
      saveLocal(stamped, userId)
      setSyncStatus('synced')
    } catch (err) {
      console.error('Cloud save failed, progress is still safe on this device', err)
      setSyncStatus('error')
    }
  } else {
    setSyncStatus('guest')
  }
  // Analytics ride along with saves rather than on their own timer: persist is
  // already called after everything worth measuring, and a batch that fails
  // must never be able to delay or break the save above it.
  if (shouldFlush()) void flushAnalytics(userId)
  return stamped
}

export interface LoadResult {
  /** The save to play, or null when there is nothing yet — or a choice to make. */
  state: PlayerState | null
  /** Set only when both copies moved independently; the player must pick one. */
  conflict: { local: PlayerState; cloud: PlayerState } | null
}

/**
 * Loads the state for one namespace only — a signed-in user never falls back
 * to the guest slot (see importGuestSave for the explicit path).
 *
 * When local and cloud have both changed since they last agreed, this returns
 * a conflict instead of choosing: see systems/conflict.
 */
export async function loadState(userId: string | null): Promise<LoadResult> {
  const local = loadLocal(userId)
  if (!userId) {
    setSyncStatus('guest')
    return { state: local, conflict: null }
  }

  let cloud: PlayerState | null = null
  let cloudFailed = false
  try {
    cloud = await loadCloud(userId)
  } catch (err) {
    console.error('Cloud load failed, using this device\'s copy', err)
    cloudFailed = true
  }

  // An unreachable cloud is not a fork — there is nothing to compare against,
  // so play on locally and let the next successful save sort it out.
  if (cloudFailed) {
    setSyncStatus('error')
    return { state: local, conflict: null }
  }

  const resolution = detectConflict(local, cloud)
  if (resolution.kind === 'conflict') {
    setSyncStatus('error')
    return { state: null, conflict: { local: local!, cloud: cloud! } }
  }

  if (resolution.source === 'local' && local) {
    // This device is ahead (e.g. an earlier cloud write failed); push it back up.
    if (cloud || local.revision > 0) void persist(local, userId)
    return { state: local, conflict: null }
  }
  setSyncStatus('synced')
  return { state: cloud ?? null, conflict: null }
}

/**
 * Commits the player's choice. The rejected copy is kept in a backup key
 * rather than dropped — a mis-tap here would otherwise cost real progress —
 * and the winner is stamped above both revisions so it wins everywhere next
 * time instead of re-forking on the other device.
 */
export async function resolveConflict(
  userId: string,
  keep: PlayerState,
  discard: PlayerState,
): Promise<PlayerState> {
  try {
    localStorage.setItem(CONFLICT_BACKUP_KEY, JSON.stringify(discard))
  } catch (err) {
    // A full quota must not block the player from getting back into the game.
    console.warn('Could not stash the discarded save', err)
  }
  const winner: PlayerState = { ...keep, revision: Math.max(keep.revision, discard.revision) }
  return persist(winner, userId)
}

/** The copy set aside by the last conflict resolution, if any. */
export function conflictBackup(): PlayerState | null {
  const raw = localStorage.getItem(CONFLICT_BACKUP_KEY)
  if (raw === null) return null
  try {
    return parsePlayerState(JSON.parse(raw))
  } catch {
    return null
  }
}

/** Copies the guest save into an account's namespace (guest copy is kept). */
export async function importGuestSave(userId: string): Promise<PlayerState | null> {
  const guest = loadLocal(null)
  if (!guest) return null
  return persist(guest, userId)
}
