import { describe, it, expect } from 'vitest'
import { parsePlayerState, MAX_LEVEL, MAX_UPGRADE_COUNT } from '../src/state/validate'
import { createDefaultPlayerState } from '../src/state/playerState'
import { STAGES } from '../src/data/stages'
import { SAVE_SCHEMA_VERSION } from '../src/types'

describe('parsePlayerState', () => {
  it('accepts a current save unchanged in its meaningful fields', () => {
    const state = { ...createDefaultPlayerState('Hero'), level: 5, gold: 42, revision: 3 }
    const parsed = parsePlayerState(state)
    expect(parsed).toMatchObject({ name: 'Hero', level: 5, gold: 42, revision: 3 })
  })

  it('rejects values that are not save objects', () => {
    for (const bad of [null, undefined, 42, 'save', [], { totally: 'unrelated' }]) {
      expect(parsePlayerState(bad)).toBeNull()
    }
  })

  it('clamps non-finite and out-of-range numbers', () => {
    const parsed = parsePlayerState({
      name: 'Broken',
      level: Number.POSITIVE_INFINITY,
      exp: Number.NaN,
      gold: -500,
      upgrades: { hp: 1e30, atk: -3, def: Number.NaN },
    })
    expect(parsed).not.toBeNull()
    expect(parsed!.level).toBe(MAX_LEVEL)
    expect(parsed!.exp).toBe(0)
    expect(parsed!.gold).toBe(0)
    expect(parsed!.upgrades).toEqual({ hp: MAX_UPGRADE_COUNT, atk: 0, def: 0 })
    expect(Number.isFinite(parsed!.stats.maxHp)).toBe(true)
  })

  it('drops unknown item ids and keeps real ones', () => {
    const parsed = parsePlayerState({
      name: 'Collector',
      level: 5,
      ownedItemIds: ['wooden-sword', 'not-a-real-item', 'wooden-sword', 42],
    })
    expect(parsed!.ownedItemIds).toEqual(['wooden-sword'])
  })

  it('drops unknown stage ids and clamps stage unlock progress', () => {
    const parsed = parsePlayerState({
      name: 'Explorer',
      level: 3,
      stageProgress: { highestUnlocked: 9999, completedStageIds: ['stage-1', 'stage-999', null] },
    })
    expect(parsed!.stageProgress.highestUnlocked).toBe(STAGES.length)
    expect(parsed!.stageProgress.completedStageIds).toEqual(['stage-1'])
  })

  it('derives stats from level so tampered stat blocks cannot stick', () => {
    const parsed = parsePlayerState({
      name: 'Cheater',
      level: 1,
      stats: { maxHp: 999999, atk: 999999, def: 999999 },
    })
    expect(parsed!.stats).toEqual(createDefaultPlayerState().stats)
  })

  it('migrates a v1 save, including the legacy emoji avatar', () => {
    const v1 = {
      name: 'Vet',
      avatar: '🦊',
      level: 4,
      exp: 10,
      gold: 60,
      stats: { maxHp: 86, atk: 19, def: 7 },
      upgrades: { hp: 2, atk: 1, def: 0 },
      stageProgress: { highestUnlocked: 3, completedStageIds: ['stage-1', 'stage-2'] },
    }
    const parsed = parsePlayerState(v1)!
    expect(parsed.schemaVersion).toBe(SAVE_SCHEMA_VERSION)
    expect(parsed.avatar).toBe('fox')
    expect(parsed.level).toBe(4)
    expect(parsed.ownedItemIds).toEqual([])
    expect(parsed.revision).toBe(0)
    expect(typeof parsed.updatedAt).toBe('string')
  })

  it('trims overlong names and falls back for blank ones', () => {
    expect(parsePlayerState({ name: '  '.repeat(3), level: 1 })!.name).toBe('Hero')
    expect(parsePlayerState({ name: 'x'.repeat(50), level: 1 })!.name).toHaveLength(14)
  })
})
