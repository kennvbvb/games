import { describe, it, expect } from 'vitest'
import { detectConflict, summarize, suggestedSource } from '../src/systems/conflict'
import { createDefaultPlayerState } from '../src/state/playerState'
import { parsePlayerState } from '../src/state/validate'
import { STAGES } from '../src/data/stages'
import type { PlayerState } from '../src/types'

/** A save at `revision`, last known to match the cloud at `syncedRevision`. */
function at(revision: number, syncedRevision: number, over: Partial<PlayerState> = {}): PlayerState {
  return { ...createDefaultPlayerState('Hero'), revision, syncedRevision, ...over }
}

describe('detectConflict', () => {
  it('uses whichever copy exists when only one does', () => {
    expect(detectConflict(at(5, 5), null)).toEqual({ kind: 'use', source: 'local' })
    expect(detectConflict(null, at(5, 5))).toEqual({ kind: 'use', source: 'cloud' })
    expect(detectConflict(null, null)).toEqual({ kind: 'use', source: 'cloud' })
  })

  it('takes the cloud when only the cloud moved', () => {
    // This device synced at 5 and has not played since; another device did.
    expect(detectConflict(at(5, 5), at(9, 5))).toEqual({ kind: 'use', source: 'cloud' })
  })

  it('takes local when only this device moved', () => {
    // Played offline: local ran ahead, the cloud still holds the synced point.
    expect(detectConflict(at(9, 5), at(5, 5))).toEqual({ kind: 'use', source: 'local' })
  })

  it('flags a conflict when both moved past the point they agreed', () => {
    // The case a bare revision counter cannot see: local 9 vs cloud 7 looks
    // like "local is ahead", but both forked from revision 5.
    expect(detectConflict(at(9, 5), at(7, 5))).toEqual({ kind: 'conflict' })
    expect(detectConflict(at(7, 5), at(9, 5))).toEqual({ kind: 'conflict' })
  })

  it('does not flag a conflict when nothing has diverged', () => {
    expect(detectConflict(at(5, 5), at(5, 5))).toEqual({ kind: 'use', source: 'cloud' })
  })

  it('falls back to the higher revision when the ancestor says nothing', () => {
    // An upgraded save whose marker equals its revision, against a cloud copy
    // that is behind: no fork, this device is simply ahead.
    expect(detectConflict(at(9, 9), at(4, 4))).toEqual({ kind: 'use', source: 'local' })
    expect(detectConflict(at(4, 4), at(9, 9))).toEqual({ kind: 'use', source: 'cloud' })
  })

  it('never reports a conflict for a freshly upgraded save', () => {
    // v8 saves carry no marker; the validator assumes they were in sync, so
    // the upgrade itself must not pop a dialog for anyone.
    const legacyLocal = parsePlayerState({ ...createDefaultPlayerState('Hero'), revision: 12, syncedRevision: undefined })!
    const cloud = at(30, 30)
    expect(legacyLocal.syncedRevision).toBe(12)
    expect(detectConflict(legacyLocal, cloud)).toEqual({ kind: 'use', source: 'cloud' })
  })

  it('clamps a marker that claims to have synced a revision that never existed', () => {
    // Nothing downstream reads a marker above the revision differently, but an
    // impossible value has no business surviving a load.
    const parsed = parsePlayerState({ ...createDefaultPlayerState('Hero'), revision: 5, syncedRevision: 999 })!
    expect(parsed.syncedRevision).toBe(5)
  })

  it('sees the fork once this device plays on past its sync point', () => {
    const parsed = parsePlayerState({ ...createDefaultPlayerState('Hero'), revision: 8, syncedRevision: 5 })!
    expect(detectConflict(parsed, at(9, 5))).toEqual({ kind: 'conflict' })
  })
})

describe('summarize', () => {
  it('reports what the player needs to tell two saves apart', () => {
    const state = at(3, 1, {
      name: 'Somchai',
      level: 7,
      gold: 250,
      stageProgress: { highestUnlocked: 4, completedStageIds: ['stage-1', 'stage-2'] },
      updatedAt: '2026-08-01T00:00:00.000Z',
    })
    expect(summarize(state)).toMatchObject({ name: 'Somchai', level: 7, gold: 250, stagesCleared: 2 })
    expect(summarize(state).updatedAt).toBe(Date.parse('2026-08-01T00:00:00.000Z'))
  })

  it('survives an unparseable timestamp', () => {
    expect(summarize(at(1, 0, { updatedAt: 'not a date' })).updatedAt).toBe(0)
  })
})

describe('suggestedSource', () => {
  it('prefers more stages cleared over a higher level', () => {
    const local = at(2, 1, { level: 3, stageProgress: { highestUnlocked: 6, completedStageIds: STAGES.slice(0, 5).map((s) => s.id) } })
    const cloud = at(2, 1, { level: 20, stageProgress: { highestUnlocked: 2, completedStageIds: ['stage-1'] } })
    expect(suggestedSource(local, cloud)).toBe('local')
  })

  it('falls back to the more recent save when progress ties', () => {
    const older = at(2, 1, { updatedAt: '2026-07-01T00:00:00.000Z' })
    const newer = at(2, 1, { updatedAt: '2026-08-01T00:00:00.000Z' })
    expect(suggestedSource(older, newer)).toBe('cloud')
    expect(suggestedSource(newer, older)).toBe('local')
  })
})
