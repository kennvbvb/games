import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PlayerState } from '../src/types'

/** Stands in for the `saves` row, so a test can play the part of another device. */
let cloudRow: { state: PlayerState } | null = null

const upsertMock = vi.fn(async (row: { state: PlayerState }) => {
  cloudRow = { state: row.state }
  return { error: null }
})
const maybeSingleMock = vi.fn(async () => ({ data: cloudRow, error: null }))
const fromMock = vi.fn(() => ({
  upsert: upsertMock,
  select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
}))

vi.mock('../src/services/supabaseClient', () => ({
  getSupabase: () => Promise.resolve({ from: fromMock }),
  isSupabaseConfigured: true,
}))

const { persist, loadState, saveLocal, loadLocal, resolveConflict, conflictBackup } = await import(
  '../src/services/saveService'
)
const { createDefaultPlayerState } = await import('../src/state/playerState')

const USER = 'user-1'
const BACKUP_KEY = 'incremental-rpg-save-v2:conflict-backup'

beforeEach(() => {
  localStorage.clear()
  cloudRow = null
  upsertMock.mockClear()
  fromMock.mockClear()
})

describe('sync marker', () => {
  it('advances only when the cloud write succeeds', async () => {
    const stamped = await persist(createDefaultPlayerState('Hero'), USER)
    expect(stamped.revision).toBe(1)
    expect(stamped.syncedRevision).toBe(1)
    // And it is on disk, not just in the returned object.
    expect(loadLocal(USER)?.syncedRevision).toBe(1)
  })

  it('stays behind when the cloud write fails', async () => {
    upsertMock.mockResolvedValueOnce({ error: new Error('offline') })
    const stamped = await persist(createDefaultPlayerState('Hero'), USER)
    expect(stamped.revision).toBe(1)
    // Unsynced work: this is exactly what makes a later fork detectable.
    expect(stamped.syncedRevision).toBe(0)
  })

  it('never advances for a guest, who has no cloud to agree with', async () => {
    const stamped = await persist(createDefaultPlayerState('Hero'), null)
    expect(stamped.syncedRevision).toBe(0)
    expect(fromMock).not.toHaveBeenCalled()
  })
})

describe('loadState', () => {
  it('returns the cloud copy when this device has not played since syncing', async () => {
    const synced = await persist(createDefaultPlayerState('Hero'), USER)
    // Another device plays on and pushes a newer copy.
    cloudRow = { state: { ...synced, revision: synced.revision + 3, level: 9 } }

    const { state, conflict } = await loadState(USER)
    expect(conflict).toBeNull()
    expect(state?.level).toBe(9)
  })

  it('keeps and re-pushes local work done while the cloud was unreachable', async () => {
    const synced = await persist(createDefaultPlayerState('Hero'), USER)
    const cloudAtSync = cloudRow!.state
    // Offline play: local advances, the cloud row stays where it was.
    saveLocal({ ...synced, revision: synced.revision + 2, gold: 500 }, USER)
    cloudRow = { state: cloudAtSync }

    const { state, conflict } = await loadState(USER)
    expect(conflict).toBeNull()
    expect(state?.gold).toBe(500)
  })

  it('reports a conflict when both sides played on from the same point', async () => {
    const synced = await persist(createDefaultPlayerState('Hero'), USER)

    // This device plays offline...
    saveLocal({ ...synced, revision: synced.revision + 2, gold: 500, name: 'Phone' }, USER)
    // ...while another device pushes its own progress from the same point.
    cloudRow = { state: { ...synced, revision: synced.revision + 4, gold: 90, name: 'Laptop' } }

    const { state, conflict } = await loadState(USER)
    // Nothing is chosen: a bare revision compare would have taken the cloud's
    // 4 over the local 2 and thrown away the bigger pile of gold.
    expect(state).toBeNull()
    expect(conflict?.local.name).toBe('Phone')
    expect(conflict?.cloud.name).toBe('Laptop')
  })

  it('does not call an unreachable cloud a conflict', async () => {
    const synced = await persist(createDefaultPlayerState('Hero'), USER)
    saveLocal({ ...synced, revision: synced.revision + 2, gold: 500 }, USER)
    maybeSingleMock.mockRejectedValueOnce(new Error('offline'))

    const { state, conflict } = await loadState(USER)
    expect(conflict).toBeNull()
    expect(state?.gold).toBe(500)
  })
})

describe('resolveConflict', () => {
  it('keeps the chosen copy and backs the other one up', async () => {
    const synced = await persist(createDefaultPlayerState('Hero'), USER)
    const local: PlayerState = { ...synced, revision: 3, gold: 500, name: 'Phone' }
    const cloud: PlayerState = { ...synced, revision: 6, gold: 90, name: 'Laptop' }

    const winner = await resolveConflict(USER, local, cloud)
    expect(winner.name).toBe('Phone')
    // Stamped above both, so the other device adopts it instead of re-forking.
    expect(winner.revision).toBeGreaterThan(cloud.revision)
    expect(winner.syncedRevision).toBe(winner.revision)

    expect(conflictBackup()?.name).toBe('Laptop')
    expect(localStorage.getItem(BACKUP_KEY)).not.toBeNull()
  })

  it('settles the fork, so the next load is clean', async () => {
    const synced = await persist(createDefaultPlayerState('Hero'), USER)
    const local: PlayerState = { ...synced, revision: 3, gold: 500 }
    const cloud: PlayerState = { ...synced, revision: 6, gold: 90 }

    await resolveConflict(USER, local, cloud)
    const { state, conflict } = await loadState(USER)
    expect(conflict).toBeNull()
    expect(state?.gold).toBe(500)
  })

  it('still lets the player back in when the backup cannot be stashed', async () => {
    const synced = await persist(createDefaultPlayerState('Hero'), USER)
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('quota exceeded')
    })
    try {
      const winner = await resolveConflict(USER, { ...synced, gold: 500 }, { ...synced, gold: 90 })
      expect(winner.gold).toBe(500)
    } finally {
      setItem.mockRestore()
    }
  })
})
