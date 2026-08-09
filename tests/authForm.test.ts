import { describe, it, expect } from 'vitest'
import {
  MIN_PASSWORD_LENGTH,
  authErrorMessage,
  canSubmit,
  fieldsFor,
  isValidEmail,
  normalizeEmail,
  validateAuthForm,
} from '../src/services/authForm'
import type { AuthFields, AuthMode } from '../src/services/authForm'

const LONG = 'x'.repeat(MIN_PASSWORD_LENGTH)

function fields(patch: Partial<AuthFields> = {}): AuthFields {
  return { email: 'player@example.com', password: LONG, confirm: LONG, ...patch }
}

describe('email normalisation', () => {
  it('trims, because a trailing space is the commonest reason a login "fails"', () => {
    expect(normalizeEmail('  player@example.com ')).toBe('player@example.com')
    expect(normalizeEmail('\tplayer@example.com\n')).toBe('player@example.com')
  })

  it('lower-cases, because one mailbox must not become two accounts', () => {
    expect(normalizeEmail('Player@Example.COM')).toBe('player@example.com')
  })

  it('is idempotent, so signing up and signing in agree', () => {
    const once = normalizeEmail(' Player@Example.com ')
    expect(normalizeEmail(once)).toBe(once)
  })
})

describe('email validation', () => {
  it('accepts the shapes real addresses take', () => {
    for (const email of [
      'a@b.co',
      'player+tag@example.com',
      'first.last@sub.domain.example',
      'PLAYER@EXAMPLE.COM',
      '  player@example.com  ',
      "o'brien@example.ie",
      'player@example.technology',
    ]) {
      expect(isValidEmail(email), email).toBe(true)
    }
  })

  it('rejects what cannot be an address at all', () => {
    for (const email of [
      '',
      '   ',
      'player',
      '@example.com',
      'player@',
      'player@example',
      'player@@example.com',
      'player@.com',
      'player@example.',
      'player@exa..mple.com',
      'play er@example.com',
      `${'a'.repeat(250)}@example.com`,
    ]) {
      expect(isValidEmail(email), JSON.stringify(email)).toBe(false)
    }
  })
})

describe('which fields each mode asks for', () => {
  it('asks for exactly what that mode needs', () => {
    expect(fieldsFor('signin')).toEqual({ email: true, password: true, confirm: false })
    expect(fieldsFor('signup')).toEqual({ email: true, password: true, confirm: true })
    expect(fieldsFor('forgot')).toEqual({ email: true, password: false, confirm: false })
    // Reset arrives through a mail link, so the address is already proven.
    expect(fieldsFor('reset')).toEqual({ email: false, password: true, confirm: true })
  })
})

describe('form validation', () => {
  it('passes a well-filled form in every mode', () => {
    for (const mode of ['signin', 'signup', 'forgot', 'reset'] as AuthMode[]) {
      expect(validateAuthForm(mode, fields()), mode).toBeNull()
    }
  })

  it('names the empty field rather than just refusing', () => {
    expect(validateAuthForm('signin', fields({ email: '' }))).toEqual({
      field: 'email',
      messageKey: 'auth.needEmail',
    })
    expect(validateAuthForm('signin', fields({ password: '' }))).toEqual({
      field: 'password',
      messageKey: 'auth.needPassword',
    })
  })

  it('treats a whitespace-only address as empty, not as malformed', () => {
    expect(validateAuthForm('signin', fields({ email: '   ' }))?.messageKey).toBe('auth.needEmail')
  })

  it('rejects a malformed address before anything is sent', () => {
    expect(validateAuthForm('signup', fields({ email: 'nope' }))).toEqual({
      field: 'email',
      messageKey: 'auth.badEmail',
    })
  })

  it('requires the two passwords to match wherever one is being chosen', () => {
    for (const mode of ['signup', 'reset'] as AuthMode[]) {
      expect(validateAuthForm(mode, fields({ confirm: `${LONG}!` })), mode).toEqual({
        field: 'confirm',
        messageKey: 'auth.mismatch',
      })
    }
  })

  it('ignores the confirm box entirely when signing in', () => {
    expect(validateAuthForm('signin', fields({ confirm: 'anything at all' }))).toBeNull()
  })

  it('never applies the length rule to sign-in', () => {
    // The rule that matters most here: enforcing a new minimum on sign-in would
    // lock out every account created before the minimum existed.
    const short = 'abc123'
    expect(short.length).toBeLessThan(MIN_PASSWORD_LENGTH)
    expect(validateAuthForm('signin', fields({ password: short, confirm: short }))).toBeNull()
    expect(validateAuthForm('signup', fields({ password: short, confirm: short }))).toEqual({
      field: 'password',
      messageKey: 'auth.shortPassword',
    })
    expect(validateAuthForm('reset', fields({ password: short, confirm: short }))?.messageKey).toBe(
      'auth.shortPassword',
    )
  })

  it('reports the first fault only, so the message stays actionable', () => {
    const broken = { email: 'nope', password: '', confirm: 'different' }
    expect(validateAuthForm('signup', broken)?.field).toBe('email')
  })
})

describe('double submit', () => {
  it('refuses while a request is already out', () => {
    expect(canSubmit('signin', fields(), false)).toBe(true)
    expect(canSubmit('signin', fields(), true)).toBe(false)
  })

  it('refuses an invalid form whether busy or not', () => {
    const bad = fields({ email: '' })
    expect(canSubmit('signin', bad, false)).toBe(false)
    expect(canSubmit('signin', bad, true)).toBe(false)
  })
})

describe('error messages', () => {
  it('uses the backend message when there is one', () => {
    expect(authErrorMessage(new Error('Invalid login credentials'), 'fallback')).toBe(
      'Invalid login credentials',
    )
  })

  it('strips the class name Supabase sometimes prefixes', () => {
    expect(authErrorMessage(new Error('AuthApiError: Email not confirmed'), 'fallback')).toBe(
      'Email not confirmed',
    )
  })

  it('falls back rather than rendering a blank red line', () => {
    for (const junk of [new Error(''), new Error('   '), null, undefined, {}, 0]) {
      expect(authErrorMessage(junk, 'fallback')).toBe('fallback')
    }
  })

  it('accepts a bare string, which some libraries still throw', () => {
    expect(authErrorMessage('Network request failed', 'fallback')).toBe('Network request failed')
  })
})
