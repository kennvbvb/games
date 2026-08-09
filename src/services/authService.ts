import type { Session, SupabaseClient, User } from '@supabase/supabase-js'
import { getSupabase, isSupabaseConfigured } from './supabaseClient'
import { normalizeEmail } from './authForm'

export { isSupabaseConfigured }

/** Resolves the lazily-loaded client, or null when cloud accounts are off. */
function client(): Promise<SupabaseClient> | null {
  return getSupabase()
}

export async function getSession(): Promise<Session | null> {
  const pending = client()
  if (!pending) return null
  const { data } = await (await pending).auth.getSession()
  return data.session
}

/**
 * Every address is normalised on the way out, not just validated.
 *
 * Sign-up and sign-in have to agree on what an address *is*, or an account
 * created from a phone keyboard that appended a space becomes an account that
 * cannot be signed into from a desktop that did not. Normalising in one place
 * here means no caller can forget.
 */
export async function signUp(email: string, password: string): Promise<Session | null> {
  const pending = client()
  if (!pending) throw new Error('Cloud accounts are not configured')
  const { data, error } = await (await pending).auth.signUp({
    email: normalizeEmail(email),
    password,
  })
  if (error) throw error
  return data.session
}

export async function signIn(email: string, password: string): Promise<Session | null> {
  const pending = client()
  if (!pending) throw new Error('Cloud accounts are not configured')
  const { data, error } = await (await pending).auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
  })
  if (error) throw error
  return data.session
}

/**
 * Where the confirmation and recovery links come back to.
 *
 * The running origin rather than a configured URL: this game is served from a
 * preview deployment, a production domain and localhost, and a hard-coded
 * redirect would send a player who signed up on one to the sign-in page of
 * another. Supabase still checks it against its own allow-list, so this widens
 * nothing.
 */
function redirectTo(): string | undefined {
  if (typeof window === 'undefined') return undefined
  return window.location.origin + window.location.pathname
}

/** Sends a recovery mail. Resolves either way — see below on why. */
export async function requestPasswordReset(email: string): Promise<void> {
  const pending = client()
  if (!pending) throw new Error('Cloud accounts are not configured')
  const { error } = await (await pending).auth.resetPasswordForEmail(normalizeEmail(email), {
    redirectTo: redirectTo(),
  })
  if (error) throw error
}

/**
 * Sets a new password for the session the recovery link opened.
 *
 * There is no "old password" argument because there is no old password to
 * check: arriving here at all means the player proved control of the mailbox,
 * which is the whole point of the link.
 */
export async function updatePassword(password: string): Promise<User | null> {
  const pending = client()
  if (!pending) throw new Error('Cloud accounts are not configured')
  const { data, error } = await (await pending).auth.updateUser({ password })
  if (error) throw error
  return data.user
}

/** Re-sends the sign-up confirmation mail. */
export async function resendConfirmation(email: string): Promise<void> {
  const pending = client()
  if (!pending) throw new Error('Cloud accounts are not configured')
  const { error } = await (await pending).auth.resend({
    type: 'signup',
    email: normalizeEmail(email),
    options: { emailRedirectTo: redirectTo() },
  })
  if (error) throw error
}

export type AuthChange = 'signed-in' | 'signed-out' | 'recovery'

/**
 * Watches the session for changes the game has to react to.
 *
 * Three of them matter. **recovery** is how a password-reset link is noticed at
 * all — the link lands on the game's own URL with a token in the fragment, and
 * without this the player would be silently signed in and see the main menu
 * instead of the form they were sent there to fill in. **signed-out** catches a
 * session ending somewhere this tab did not do it: expiry, or a sign-out in
 * another tab. **signed-in** catches the same in reverse.
 *
 * Returns an unsubscribe. Callers must use it — a scene that restarts without
 * unsubscribing accumulates listeners that all fire on the next change.
 */
export function onAuthStateChange(handler: (change: AuthChange, session: Session | null) => void): () => void {
  const pending = client()
  if (!pending) return () => {}
  let unsubscribe: (() => void) | null = null
  let cancelled = false

  void pending.then((supabase) => {
    if (cancelled) return
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') handler('recovery', session)
      else if (event === 'SIGNED_OUT') handler('signed-out', session)
      else if (event === 'SIGNED_IN') handler('signed-in', session)
    })
    unsubscribe = () => data.subscription.unsubscribe()
  })

  return () => {
    cancelled = true
    unsubscribe?.()
  }
}

/**
 * Ends the session, and says whether it worked.
 *
 * The old version swallowed the error and returned void, which made a failed
 * sign-out indistinguishable from a successful one — the player was returned to
 * the sign-in screen still holding a live session, and the next visit resumed
 * straight back into the account they had just left. Returning the failure lets
 * the caller decide, and the caller does not clear local state on a failure.
 */
export async function signOut(): Promise<{ ok: true } | { ok: false; error: Error }> {
  const pending = client()
  if (!pending) return { ok: true }
  try {
    const { error } = await (await pending).auth.signOut()
    if (error) return { ok: false, error }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err : new Error(String(err)) }
  }
}
