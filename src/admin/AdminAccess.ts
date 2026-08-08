/**
 * Who may open the Admin Test Lab.
 *
 * Two grants, deliberately unequal:
 *
 * - **dev** — a build-time flag, available only in a development build. It
 *   cannot exist in a production bundle because `import.meta.env.DEV` is
 *   statically false there and the check is dead-code eliminated.
 * - **role** — a role claim the Supabase *server* put into the access token.
 *   Read from `app_metadata`, which only a trusted backend or the dashboard can
 *   write. `user_metadata` is deliberately never consulted: any signed-in user
 *   can write their own, so trusting it would make "admin" self-service.
 *
 * ## What this gate is and is not
 *
 * Hiding a button is not security, and this module does not pretend otherwise.
 * The honest position is that the Test Lab has no privileged server surface to
 * protect: it clones the player's *own* save into memory, runs the same pure
 * combat functions the game already runs, and can only ever write back through
 * the ordinary save path — which RLS already scopes to `auth.uid()`. A user who
 * patched the bundle to force the lab open would gain nothing they could not
 * get by editing their own localStorage, which the save validator already
 * assumes they can do.
 *
 * What the role check *does* buy is real, though:
 *
 *  1. Audit rows are insertable only by a verified role (see supabase/schema.sql),
 *     so a forged client cannot forge history.
 *  2. Any future action that is genuinely server-authoritative already has the
 *     check in the correct place — on the server — rather than needing one
 *     retrofitted.
 */

export type AdminGrant =
  | { kind: 'none' }
  /** Local development build with the opt-in flag set. */
  | { kind: 'dev' }
  /** Signed in with a server-issued admin role claim. */
  | { kind: 'role'; userId: string }

/** The slice of `import.meta.env` this module reads; injectable so it can be tested both ways. */
export interface AdminEnv {
  DEV?: boolean
  VITE_ENABLE_DEV_ADMIN?: string
}

export const ADMIN_ROLE = 'admin'

/**
 * True only in a development build that also opted in. Both halves matter: the
 * flag alone would ship an admin door in production if a `.env` leaked into a
 * deploy, and `DEV` alone would open the lab for every developer unasked.
 */
export function devAdminEnabled(env: AdminEnv = import.meta.env): boolean {
  return env.DEV === true && env.VITE_ENABLE_DEV_ADMIN === 'true'
}

/** The shape of a Supabase user this module cares about. */
export interface AdminClaims {
  id?: unknown
  app_metadata?: unknown
  user_metadata?: unknown
}

function hasAdminRole(metadata: unknown): boolean {
  if (typeof metadata !== 'object' || metadata === null) return false
  const meta = metadata as Record<string, unknown>
  // Either a single claim (Custom Access Token Hook style) or a list (a
  // `user_roles` join flattened into the token). Both are server-written.
  if (meta.user_role === ADMIN_ROLE) return true
  return Array.isArray(meta.roles) && meta.roles.includes(ADMIN_ROLE)
}

/**
 * Reads the admin role from a signed-in user's *server-controlled* metadata.
 *
 * `user_metadata` is never read. Supabase lets any authenticated client write
 * its own `user_metadata` via `updateUser`, so a role found there would be a
 * role the user granted themselves.
 */
export function hasAdminClaim(user: AdminClaims | null | undefined): boolean {
  if (!user) return false
  return hasAdminRole(user.app_metadata)
}

/**
 * The grant in force. `session` is whatever `getSession()` returned; passing
 * null (guest, or cloud accounts unconfigured) still allows the dev grant,
 * because local development has no account to sign into.
 */
export function resolveAdminGrant(
  session: { user?: AdminClaims } | null | undefined,
  env: AdminEnv = import.meta.env,
): AdminGrant {
  if (devAdminEnabled(env)) return { kind: 'dev' }
  const user = session?.user
  if (user && hasAdminClaim(user) && typeof user.id === 'string') {
    return { kind: 'role', userId: user.id }
  }
  return { kind: 'none' }
}

export function isAdminGranted(grant: AdminGrant): boolean {
  return grant.kind !== 'none'
}
