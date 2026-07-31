import { describe, it, expect } from 'vitest'
import { parsePlayerState } from '../src/state/validate'
import { createDefaultPlayerState } from '../src/state/playerState'
import { SAVE_SCHEMA_VERSION, TUTORIAL_DONE } from '../src/types'

describe('settings validation', () => {
  it('defaults a save with no settings block', () => {
    const parsed = parsePlayerState({ name: 'Old', level: 3 })!
    expect(parsed.settings.battleSpeed).toBe(1)
    expect(parsed.settings.skipCleared).toBe(false)
    expect(parsed.settings.autoAdvance).toBe(false)
    expect(typeof parsed.settings.reducedMotion).toBe('boolean')
    expect(parsed.schemaVersion).toBe(SAVE_SCHEMA_VERSION)
  })

  it('keeps only valid battle speeds', () => {
    for (const speed of [1, 2, 4]) {
      expect(parsePlayerState({ name: 'S', level: 1, settings: { battleSpeed: speed } })!.settings.battleSpeed).toBe(speed)
    }
    for (const bad of [3, 0, -1, 999, 'fast', null]) {
      expect(parsePlayerState({ name: 'S', level: 1, settings: { battleSpeed: bad } })!.settings.battleSpeed).toBe(1)
    }
  })

  it('treats non-boolean toggles as off', () => {
    const parsed = parsePlayerState({
      name: 'S',
      level: 1,
      settings: { skipCleared: 'yes', autoRepeat: 1, autoAdvance: {} },
    })!
    expect(parsed.settings.skipCleared).toBe(false)
    expect(parsed.settings.autoRepeat).toBe(false)
    expect(parsed.settings.autoAdvance).toBe(false)
  })

  it('respects an explicitly saved reduced-motion choice either way', () => {
    expect(parsePlayerState({ name: 'S', level: 1, settings: { reducedMotion: true } })!.settings.reducedMotion).toBe(true)
    expect(parsePlayerState({ name: 'S', level: 1, settings: { reducedMotion: false } })!.settings.reducedMotion).toBe(false)
  })
})

describe('tutorial progress', () => {
  it('starts a new hero at step 0', () => {
    expect(createDefaultPlayerState().tutorialStep).toBe(0)
  })

  it('defaults missing progress to the start', () => {
    expect(parsePlayerState({ name: 'Old', level: 3 })!.tutorialStep).toBe(0)
  })

  it('clamps out-of-range progress', () => {
    expect(parsePlayerState({ name: 'S', level: 1, tutorialStep: 99 })!.tutorialStep).toBe(TUTORIAL_DONE)
    expect(parsePlayerState({ name: 'S', level: 1, tutorialStep: -5 })!.tutorialStep).toBe(0)
    expect(parsePlayerState({ name: 'S', level: 1, tutorialStep: 'two' })!.tutorialStep).toBe(0)
  })

  it('preserves a mid-tutorial step', () => {
    expect(parsePlayerState({ name: 'S', level: 1, tutorialStep: 2 })!.tutorialStep).toBe(2)
  })
})
