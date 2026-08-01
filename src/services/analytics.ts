import { getSupabase } from './supabaseClient'

/**
 * Opt-in gameplay analytics.
 *
 * Three rules shape everything here:
 *
 * 1. **Off unless asked.** `enabled` starts false and only a Settings toggle
 *    turns it on. Nothing is recorded — not even buffered — while it is off.
 * 2. **No identity of our own.** There is no device id, no session id, no
 *    fingerprint. Rows are attributed by the Supabase user id the player
 *    already has, which means guests are never uploaded at all.
 * 3. **Only what is listed below.** Payloads pass through an allowlist per
 *    event, so a future call site cannot leak a hero name or a free-text field
 *    by accident. See PRIVACY.md for the same list in plain language.
 */

export type AnalyticsEvent =
  | { name: 'stage_attempt'; stage: number; boss: boolean; win: boolean; turns: number }
  | { name: 'purchase'; kind: 'gear' | 'treat'; stage: number; level: number }
  | { name: 'achievement_claimed'; achievement: string; level: number }
  | { name: 'offline_collected'; battles: number; hours: number }

export type AnalyticsEventName = AnalyticsEvent['name']

/** The only keys that may leave the device, per event. */
const ALLOWED_FIELDS: Record<AnalyticsEventName, readonly string[]> = {
  stage_attempt: ['stage', 'boss', 'win', 'turns'],
  purchase: ['kind', 'stage', 'level'],
  achievement_claimed: ['achievement', 'level'],
  offline_collected: ['battles', 'hours'],
}

interface QueuedEvent {
  name: AnalyticsEventName
  /** Minute-resolution epoch ms; finer timing is not worth the extra precision. */
  at: number
  props: Record<string, string | number | boolean>
}

/** Dropped oldest-first, so a long offline session cannot grow without bound. */
const MAX_QUEUE = 200
/** Upload once this many events are waiting, not on every single one. */
const FLUSH_AT = 20

let enabled = false
let queue: QueuedEvent[] = []

export function setAnalyticsEnabled(value: boolean): void {
  enabled = value
  // Turning it off discards whatever was waiting — an opt-out is not a request
  // to send one last batch.
  if (!value) queue = []
}

export function isAnalyticsEnabled(): boolean {
  return enabled
}

/** Test seam; also used when a save is replaced by a different profile. */
export function resetAnalytics(): void {
  enabled = false
  queue = []
}

export function pendingEvents(): readonly QueuedEvent[] {
  return queue
}

function sanitize(event: AnalyticsEvent): QueuedEvent {
  const allowed = ALLOWED_FIELDS[event.name]
  const props: Record<string, string | number | boolean> = {}
  for (const key of allowed) {
    const value = (event as Record<string, unknown>)[key]
    if (typeof value === 'string') props[key] = value.slice(0, 40)
    else if (typeof value === 'number') props[key] = Number.isFinite(value) ? Math.round(value * 100) / 100 : 0
    else if (typeof value === 'boolean') props[key] = value
  }
  return { name: event.name, at: Math.floor(Date.now() / 60_000) * 60_000, props }
}

export function recordEvent(event: AnalyticsEvent): void {
  if (!enabled) return
  queue.push(sanitize(event))
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE)
}

export function shouldFlush(): boolean {
  return enabled && queue.length >= FLUSH_AT
}

/**
 * Uploads and clears the queue. Signed-in players only: without an account
 * there is nothing to attribute a row to, and inventing an id to fill that gap
 * is exactly what this module refuses to do. Failure is silent and the events
 * are dropped — analytics must never cost the player a save or a frame.
 */
export async function flushAnalytics(userId: string | null): Promise<number> {
  if (!enabled || !userId || queue.length === 0) return 0
  const pending = getSupabase()
  if (!pending) return 0

  const batch = queue
  queue = []
  try {
    const client = await pending
    const { error } = await client.from('analytics_events').insert(
      batch.map((event) => ({ user_id: userId, name: event.name, props: event.props, occurred_at: new Date(event.at).toISOString() })),
    )
    if (error) throw error
    return batch.length
  } catch (err) {
    console.warn('Analytics upload failed; events dropped', err)
    return 0
  }
}
