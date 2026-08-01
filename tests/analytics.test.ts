import { describe, it, expect, beforeEach, vi } from 'vitest'

const insertMock = vi.fn().mockResolvedValue({ error: null })
const fromMock = vi.fn(() => ({ insert: insertMock }))

vi.mock('../src/services/supabaseClient', () => ({
  getSupabase: () => Promise.resolve({ from: fromMock }),
  isSupabaseConfigured: true,
}))

const {
  recordEvent,
  flushAnalytics,
  setAnalyticsEnabled,
  isAnalyticsEnabled,
  resetAnalytics,
  pendingEvents,
  shouldFlush,
} = await import('../src/services/analytics')
const { parsePlayerState } = await import('../src/state/validate')
const { createDefaultPlayerState } = await import('../src/state/playerState')

const attempt = { name: 'stage_attempt', stage: 3, boss: false, win: true, turns: 7 } as const

describe('consent', () => {
  beforeEach(() => {
    resetAnalytics()
    insertMock.mockClear()
    fromMock.mockClear()
  })

  it('is off until switched on', () => {
    expect(isAnalyticsEnabled()).toBe(false)
    recordEvent(attempt)
    expect(pendingEvents()).toHaveLength(0)
  })

  it('records nothing at all while off — not even buffered', () => {
    for (let i = 0; i < 50; i++) recordEvent(attempt)
    expect(pendingEvents()).toHaveLength(0)
    // Switching on later must not resurrect the events from before consent.
    setAnalyticsEnabled(true)
    expect(pendingEvents()).toHaveLength(0)
  })

  it('discards anything queued when switched off', () => {
    setAnalyticsEnabled(true)
    recordEvent(attempt)
    expect(pendingEvents()).toHaveLength(1)
    setAnalyticsEnabled(false)
    expect(pendingEvents()).toHaveLength(0)
  })

  it('defaults to off on a new save', () => {
    expect(createDefaultPlayerState('Hero').settings.analytics).toBe(false)
  })

  it('never inherits consent from an older save', () => {
    // A v7 save has no analytics field; it must not become an opt-in.
    const legacy = { ...createDefaultPlayerState('Hero'), settings: { locale: 'en' } }
    expect(parsePlayerState(legacy)?.settings.analytics).toBe(false)
    // Nor does a truthy-but-not-true value count as consent.
    const sneaky = { ...createDefaultPlayerState('Hero'), settings: { analytics: 'yes' } }
    expect(parsePlayerState(sneaky)?.settings.analytics).toBe(false)
  })

  it('keeps an explicit opt-in through a save round-trip', () => {
    const opted = createDefaultPlayerState('Hero')
    opted.settings.analytics = true
    expect(parsePlayerState(opted)?.settings.analytics).toBe(true)
  })
})

describe('payload', () => {
  beforeEach(() => {
    resetAnalytics()
    setAnalyticsEnabled(true)
    insertMock.mockClear()
  })

  it('carries only the allowlisted fields', () => {
    // A call site that grows an extra field must not leak it.
    recordEvent({ ...attempt, name: 'stage_attempt', heroName: 'Somchai' } as never)
    const [event] = pendingEvents()
    expect(Object.keys(event.props).sort()).toEqual(['boss', 'stage', 'turns', 'win'])
    expect(JSON.stringify(event)).not.toContain('Somchai')
  })

  it('rounds timestamps to the minute', () => {
    recordEvent(attempt)
    expect(pendingEvents()[0].at % 60_000).toBe(0)
  })

  it('caps the queue instead of growing forever', () => {
    for (let i = 0; i < 500; i++) recordEvent(attempt)
    expect(pendingEvents().length).toBeLessThanOrEqual(200)
  })

  it('coerces a non-finite number rather than sending it', () => {
    recordEvent({ name: 'offline_collected', battles: Number.NaN, hours: Number.POSITIVE_INFINITY })
    expect(pendingEvents()[0].props).toEqual({ battles: 0, hours: 0 })
  })
})

describe('upload', () => {
  beforeEach(() => {
    resetAnalytics()
    setAnalyticsEnabled(true)
    insertMock.mockClear()
    fromMock.mockClear()
  })

  it('never uploads for a guest', async () => {
    recordEvent(attempt)
    expect(await flushAnalytics(null)).toBe(0)
    expect(fromMock).not.toHaveBeenCalled()
    // The events stay queued rather than being silently thrown away.
    expect(pendingEvents()).toHaveLength(1)
  })

  it('never uploads while opted out', async () => {
    setAnalyticsEnabled(false)
    expect(await flushAnalytics('user-1')).toBe(0)
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('sends the batch under the signed-in user and clears it', async () => {
    recordEvent(attempt)
    recordEvent({ name: 'purchase', kind: 'gear', stage: 4, level: 6 })
    expect(await flushAnalytics('user-1')).toBe(2)

    expect(fromMock).toHaveBeenCalledWith('analytics_events')
    const rows = insertMock.mock.calls[0][0]
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ user_id: 'user-1', name: 'stage_attempt' })
    expect(pendingEvents()).toHaveLength(0)
  })

  it('drops the batch when the upload fails, and says nothing to the caller', async () => {
    insertMock.mockResolvedValueOnce({ error: new Error('offline') })
    recordEvent(attempt)
    await expect(flushAnalytics('user-1')).resolves.toBe(0)
    expect(pendingEvents()).toHaveLength(0)
  })

  it('only asks to flush once a batch has built up', () => {
    for (let i = 0; i < 19; i++) recordEvent(attempt)
    expect(shouldFlush()).toBe(false)
    recordEvent(attempt)
    expect(shouldFlush()).toBe(true)
  })
})
