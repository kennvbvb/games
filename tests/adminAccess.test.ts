import { describe, it, expect } from 'vitest'
import { devAdminEnabled, hasAdminClaim, isAdminGranted, resolveAdminGrant } from '../src/admin/AdminAccess'

const DEV_ON = { DEV: true, VITE_ENABLE_DEV_ADMIN: 'true' }
const DEV_OFF = { DEV: true }
const PROD_WITH_FLAG = { DEV: false, VITE_ENABLE_DEV_ADMIN: 'true' }

describe('admin access', () => {
  it('opens the dev door only in a development build that opted in', () => {
    expect(devAdminEnabled(DEV_ON)).toBe(true)
    expect(devAdminEnabled(DEV_OFF)).toBe(false)
    expect(devAdminEnabled({})).toBe(false)
  })

  it('keeps the dev door shut in production even when the flag is set', () => {
    // A .env that leaks into a deploy must not open an admin door. The flag on
    // its own is never sufficient.
    expect(devAdminEnabled(PROD_WITH_FLAG)).toBe(false)
    expect(resolveAdminGrant(null, PROD_WITH_FLAG)).toEqual({ kind: 'none' })
  })

  it('never reads a role out of user_metadata', () => {
    // Supabase lets any signed-in client write its own user_metadata, so a role
    // found there is one the user granted themselves.
    expect(hasAdminClaim({ id: 'u1', user_metadata: { user_role: 'admin' } })).toBe(false)
    expect(hasAdminClaim({ id: 'u1', user_metadata: { roles: ['admin'] } })).toBe(false)
  })

  it('accepts a role the server put in app_metadata, in either shape', () => {
    expect(hasAdminClaim({ id: 'u1', app_metadata: { user_role: 'admin' } })).toBe(true)
    expect(hasAdminClaim({ id: 'u1', app_metadata: { roles: ['support', 'admin'] } })).toBe(true)
    expect(hasAdminClaim({ id: 'u1', app_metadata: { user_role: 'player' } })).toBe(false)
    expect(hasAdminClaim({ id: 'u1', app_metadata: {} })).toBe(false)
    expect(hasAdminClaim(null)).toBe(false)
  })

  it('grants a production admin by role and nobody else', () => {
    const admin = { user: { id: 'u1', app_metadata: { user_role: 'admin' } } }
    const player = { user: { id: 'u2', app_metadata: {} } }
    const prod = { DEV: false }

    expect(resolveAdminGrant(admin, prod)).toEqual({ kind: 'role', userId: 'u1' })
    expect(resolveAdminGrant(player, prod)).toEqual({ kind: 'none' })
    expect(resolveAdminGrant(null, prod)).toEqual({ kind: 'none' })
  })

  it('refuses a role claim with no user id to attribute it to', () => {
    // Audit rows are keyed by actor. A grant with nothing to key on would write
    // rows that cannot be attributed, which is worse than no rows.
    const grant = resolveAdminGrant({ user: { app_metadata: { user_role: 'admin' } } }, { DEV: false })
    expect(grant).toEqual({ kind: 'none' })
  })

  it('lets a guest developer in without an account', () => {
    // Local development has no cloud project to sign into, so the dev grant
    // cannot depend on a session.
    expect(resolveAdminGrant(null, DEV_ON)).toEqual({ kind: 'dev' })
    expect(isAdminGranted(resolveAdminGrant(null, DEV_ON))).toBe(true)
    expect(isAdminGranted({ kind: 'none' })).toBe(false)
  })
})
