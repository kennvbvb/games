import { describe, it, expect, vi, beforeEach } from 'vitest'

const upsertMock = vi.fn().mockResolvedValue({ error: null })
const fromMock = vi.fn(() => ({ upsert: upsertMock }))

vi.mock('../src/services/supabaseClient', () => ({
  supabase: { from: fromMock },
  isSupabaseConfigured: true,
}))

const { saveLocal, loadLocal, clearLocal, persist } = await import('../src/services/saveService')
const { createDefaultPlayerState } = await import('../src/state/playerState')

describe('saveService', () => {
  beforeEach(() => {
    localStorage.clear()
    upsertMock.mockClear()
    fromMock.mockClear()
  })

  it('round-trips state through localStorage', () => {
    const state = createDefaultPlayerState('Tester')
    saveLocal(state)
    expect(loadLocal()).toEqual(state)
    clearLocal()
    expect(loadLocal()).toBeNull()
  })

  it('always writes a local mirror even when signed in', async () => {
    const state = createDefaultPlayerState('Tester')
    await persist(state, 'user-123')
    expect(loadLocal()).toEqual(state)
  })

  it('upserts to the saves table when a userId is present', async () => {
    const state = createDefaultPlayerState('Tester')
    await persist(state, 'user-123')
    expect(fromMock).toHaveBeenCalledWith('saves')
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'user-123', state }))
  })

  it('skips the cloud call entirely for guest saves', async () => {
    const state = createDefaultPlayerState('Tester')
    await persist(state, null)
    expect(fromMock).not.toHaveBeenCalled()
  })
})
