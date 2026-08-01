import { getSupabase } from '../services/supabaseClient'
import type { AdminGrant } from './AdminAccess'

/**
 * A record of the Test Lab actions that leave the lab.
 *
 * Only the ones that touch real data are worth logging: opening the lab or
 * running a simulation changes nothing, so logging those would bury the two
 * entries anybody would ever go looking for.
 */
export type AdminAction = 'apply-to-save' | 'import-save' | 'reset-campaign'

/** Field allowlist per action, mirroring services/analytics — nothing free-text. */
const ALLOWED_DETAILS: Record<AdminAction, readonly string[]> = {
  'apply-to-save': ['level', 'highestUnlocked', 'gold', 'raceId'],
  'import-save': ['accepted', 'schemaVersion'],
  'reset-campaign': ['previousHighest'],
}

export interface AuditDetails {
  [key: string]: string | number | boolean
}

function pick(action: AdminAction, details: AuditDetails): AuditDetails {
  const allowed = ALLOWED_DETAILS[action]
  return Object.fromEntries(Object.entries(details).filter(([key]) => allowed.includes(key)))
}

/**
 * Writes one audit row, best effort.
 *
 * A dev grant has no server to write to and nothing to be accountable for, so
 * it logs to the console instead. A role grant writes to `admin_audit_log`,
 * whose insert policy re-checks the role server-side — which is what makes the
 * row worth anything. A failure here must never block the action it describes:
 * the alternative is a lab that stops working when the network does.
 */
export async function recordAdminAction(
  grant: AdminGrant,
  action: AdminAction,
  details: AuditDetails = {},
): Promise<void> {
  const safe = pick(action, details)
  if (grant.kind !== 'role') {
    if (grant.kind === 'dev') console.info('[admin]', action, safe)
    return
  }
  const pending = getSupabase()
  if (!pending) return
  try {
    const { error } = await (await pending)
      .from('admin_audit_log')
      .insert({ actor_id: grant.userId, action, details: safe })
    if (error) throw error
  } catch (err) {
    console.warn('Admin audit write failed', err)
  }
}
