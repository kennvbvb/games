import type { MessageKey } from '../i18n'

/**
 * Everything the auth screen decides *before* it talks to a server.
 *
 * Kept out of the scene so it can be tested without a browser and without
 * Supabase: the scene's job is to render this module's verdict, not to hold
 * the rules.
 */

export type AuthMode = 'signin' | 'signup' | 'forgot' | 'reset'

export interface AuthFields {
  email: string
  password: string
  confirm: string
}

/**
 * Minimum length asked of a *new* password.
 *
 * Supabase's own floor is six. Asking for eight here is a deliberate step up,
 * and it is applied only where a password is being chosen — never on sign-in.
 * Enforcing it on sign-in would lock out every account created before the rule
 * existed, which is a self-inflicted outage rather than a security measure: the
 * server is what actually decides whether the password is right.
 */
export const MIN_PASSWORD_LENGTH = 8

/**
 * Trimmed and lower-cased.
 *
 * Both halves matter. A trailing space from a phone keyboard's autocomplete is
 * the single most common reason a correct password "fails", and an address that
 * differs only in case is the same mailbox — treating them as two accounts
 * would let one person sign up twice and then lose whichever save they left in
 * the other.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

/**
 * Shape check only, and on purpose.
 *
 * The only authority on whether an address exists is the mail that gets sent to
 * it, so this rejects what cannot possibly be an address rather than trying to
 * guess what can. Anything stricter starts refusing real addresses — plus
 * signs, long TLDs, unusual local parts — which is a worse failure than letting
 * a typo through to a bounced confirmation mail.
 */
export function isValidEmail(raw: string): boolean {
  const email = normalizeEmail(raw)
  if (email.length === 0 || email.length > 254) return false
  if (/\s/.test(email)) return false
  const at = email.indexOf('@')
  if (at <= 0 || at !== email.lastIndexOf('@')) return false
  const domain = email.slice(at + 1)
  if (domain.length === 0 || !domain.includes('.')) return false
  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) return false
  return true
}

export interface FormFault {
  field: 'email' | 'password' | 'confirm'
  messageKey: MessageKey
}

/** Which fields a mode actually asks for; the scene shows exactly these. */
export function fieldsFor(mode: AuthMode): { email: boolean; password: boolean; confirm: boolean } {
  return {
    email: mode !== 'reset',
    password: mode !== 'forgot',
    confirm: mode === 'signup' || mode === 'reset',
  }
}

/**
 * The first thing wrong with the form, or null.
 *
 * First rather than all of them: one clear sentence under the form is easier to
 * act on than three, and fixing the first usually reveals whether the others
 * were real.
 */
export function validateAuthForm(mode: AuthMode, fields: AuthFields): FormFault | null {
  const asks = fieldsFor(mode)

  if (asks.email) {
    if (normalizeEmail(fields.email).length === 0) {
      return { field: 'email', messageKey: 'auth.needEmail' }
    }
    if (!isValidEmail(fields.email)) {
      return { field: 'email', messageKey: 'auth.badEmail' }
    }
  }

  if (asks.password) {
    if (fields.password.length === 0) {
      return { field: 'password', messageKey: 'auth.needPassword' }
    }
    // Length is a rule about *choosing* a password, so sign-in is exempt —
    // see MIN_PASSWORD_LENGTH.
    if (mode !== 'signin' && fields.password.length < MIN_PASSWORD_LENGTH) {
      return { field: 'password', messageKey: 'auth.shortPassword' }
    }
  }

  if (asks.confirm && fields.password !== fields.confirm) {
    return { field: 'confirm', messageKey: 'auth.mismatch' }
  }

  return null
}

/**
 * A submit is allowed when the form is valid *and* nothing is already in
 * flight.
 *
 * The busy half is not cosmetic. Two sign-ups from a double tap create one
 * account and one duplicate-email error, and two password resets send two mails
 * of which only the newer link works — so the guard has to sit in front of the
 * request rather than behind a disabled attribute the browser may not have
 * repainted yet.
 */
export function canSubmit(mode: AuthMode, fields: AuthFields, busy: boolean): boolean {
  return !busy && validateAuthForm(mode, fields) === null
}

/**
 * Turns whatever the auth backend threw into something worth reading.
 *
 * Supabase's messages are usable but occasionally leak implementation ("AuthApiError"),
 * and an empty message renders as a blank red line that looks like a bug in the
 * game rather than a rejected password.
 */
export function authErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim().length > 0) {
    return err.message.replace(/^AuthApiError:\s*/i, '')
  }
  if (typeof err === 'string' && err.trim().length > 0) return err
  return fallback
}
