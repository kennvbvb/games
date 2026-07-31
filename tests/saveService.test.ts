import { describe, it, expect, vi, beforeEach } from 'vitest'

const upsertMock = vi.fn().mockResolvedValue({ error: null })
const fromMock = vi.fn(() => ({ upsert: upsertMock }))

vi.mock('../src/services/supabaseClient', () => ({
  supabase: { from: fromMock },
  isSupabaseConfigured: true,
}))

const { saveLocal, loadLocal, clearLocal, persist, hasGuestSave } = await import('../src/services/saveService')
const { createDefaultPlayerState } = await import('../src/state/playerState')
const { SAVE_SCHEMA_VERSION } = await import('../src/types')

const GUEST_KEY = 'incremental-rpg-save-v2:guest'
const QUARANTINE_KEY = 'incremental-rpg-save-v2:quarantine'
const userKey = (id: string) => `incremental-rpg-save-v2:user:${id}`

describe('saveService', () => {
  beforeEach(() => {
    localStorage.clear()
    upsertMock.mockClear()
    fromMock.mockClear()
  })

  it('round-trips state through the guest namespace', () => {
    const state = createDefaultPlayerState('Tester')
    saveLocal(state, null)
    expect(loadLocal(null)).toMatchObject({ name: 'Tester', level: 1 })
    clearLocal(null)
    expect(loadLocal(null)).toBeNull()
  })

  it('keeps guest and each account in separate slots', async () => {
    await persist({ ...createDefaultPlayerState('Guest'), gold: 1 }, null)
    await persist({ ...createDefaultPlayerState('Alice'), gold: 100 }, 'user-a')

    // Bob signs in on the same device and must not inherit anyone's progress.
    expect(loadLocal('user-b')).toBeNull()
    expect(loadLocal('user-a')?.name).toBe('Alice')
    expect(loadLocal(null)?.name).toBe('Guest')
    expect(localStorage.getItem(userKey('user-b'))).toBeNull()
  })

  it('always writes a local mirror in the signed-in slot, not the guest slot', async () => {
    await persist(createDefaultPlayerState('Tester'), 'user-123')
    expect(localStorage.getItem(userKey('user-123'))).not.toBeNull()
    expect(localStorage.getItem(GUEST_KEY)).toBeNull()
  })

  it('upserts to the saves table with a revision when signed in', async () => {
    await persist(createDefaultPlayerState('Tester'), 'user-123')
    expect(fromMock).toHaveBeenCalledWith('saves')
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-123', revision: 1 }),
    )
  })

  it('skips the cloud call entirely for guest saves', async () => {
    await persist(createDefaultPlayerState('Tester'), null)
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('bumps the revision on every persist', async () => {
    const first = await persist(createDefaultPlayerState('Tester'), null)
    expect(first.revision).toBe(1)
    const second = await persist(first, null)
    expect(second.revision).toBe(2)
    expect(loadLocal(null)?.revision).toBe(2)
  })

  it('quarantines unreadable saves instead of throwing', () => {
    localStorage.setItem(GUEST_KEY, '{ this is not json')
    expect(() => loadLocal(null)).not.toThrow()
    expect(loadLocal(null)).toBeNull()
    expect(localStorage.getItem(QUARANTINE_KEY)).toBe('{ this is not json')
    expect(localStorage.getItem(GUEST_KEY)).toBeNull()
  })

  it('quarantines valid JSON that is not a save', () => {
    localStorage.setItem(GUEST_KEY, JSON.stringify({ totally: 'unrelated' }))
    expect(loadLocal(null)).toBeNull()
    expect(localStorage.getItem(QUARANTINE_KEY)).toContain('unrelated')
  })

  it('adopts a pre-v2 save into the guest slot exactly once', () => {
    const legacy = { name: 'Vet', level: 4, exp: 3, gold: 50, upgrades: { hp: 1, atk: 0, def: 0 } }
    localStorage.setItem('incremental-rpg-save-v1', JSON.stringify(legacy))

    expect(hasGuestSave()).toBe(true)
    const migrated = loadLocal(null)
    expect(migrated?.name).toBe('Vet')
    expect(migrated?.level).toBe(4)
    expect(migrated?.schemaVersion).toBe(SAVE_SCHEMA_VERSION)
    expect(localStorage.getItem('incremental-rpg-save-v1')).toBeNull()
  })

  it('does not let a legacy save overwrite an existing guest save', () => {
    saveLocal({ ...createDefaultPlayerState('Current'), gold: 7 }, null)
    localStorage.setItem('incremental-rpg-save-v1', JSON.stringify({ name: 'Old', level: 9 }))
    expect(loadLocal(null)?.name).toBe('Current')
  })
})
