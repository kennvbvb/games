import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  APPLY_CONFIRMATION,
  createTestState,
  normalizeTestState,
  toSavePayload,
  updateTestPlayer,
} from '../src/admin/AdminTestState'
import { ADMIN_PRESETS, PRESET_BY_ID } from '../src/admin/presets'
import { createDefaultPlayerState } from '../src/state/playerState'
import { statsForLevel } from '../src/systems/leveling'
import { STAGES } from '../src/data/stages'
import { MAX_LEVEL } from '../src/state/validate'

describe('admin test state', () => {
  it('clones the save rather than aliasing it', () => {
    const save = createDefaultPlayerState('Real')
    const test = createTestState(save)

    expect(test.player).not.toBe(save)
    expect(test.player.stageProgress).not.toBe(save.stageProgress)
    expect(test.player.settings).not.toBe(save.settings)

    // Mutating the clone in place — the crude way a UI might — must not reach
    // the live save through a shared nested object.
    test.player.stageProgress.completedStageIds.push('stage-1')
    test.player.gold = 99999
    expect(save.stageProgress.completedStageIds).toEqual([])
    expect(save.gold).toBe(0)
  })

  it('has no import path that could reach the save layer', () => {
    // The guarantee that lab edits never persist is structural, not a promise:
    // there is no reachable code path from this module to a write. Asserting on
    // the imports is the only way to keep a future edit from adding one
    // silently — every other test would still pass if it did.
    const source = readFileSync(resolve(process.cwd(), 'src/admin/AdminTestState.ts'), 'utf8')
    // Comments discuss persistence at length; only executable code counts.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    const imports = [...code.matchAll(/from '([^']+)'/g)].map((m) => m[1])
    expect(imports.some((path) => path.includes('services/'))).toBe(false)
    expect(code).not.toMatch(/\bpersist\s*\(/)
    expect(code).not.toContain('localStorage')
  })

  it('re-derives stats whenever level or race is edited', () => {
    const test = createTestState(createDefaultPlayerState())
    const leveled = updateTestPlayer(test, { level: 20 })
    expect(leveled.player.stats).toEqual(statsForLevel(20, 'human'))

    // Changing race has to move the stat block too, or the lab would be testing
    // a hero the game can never produce.
    const orc = updateTestPlayer(leveled, { raceId: 'orc' })
    expect(orc.player.stats).toEqual(statsForLevel(20, 'orc'))
    expect(orc.player.stats).not.toEqual(leveled.player.stats)
  })

  it('refuses to hand back a save payload without the confirmation token', () => {
    const test = updateTestPlayer(createTestState(createDefaultPlayerState()), { gold: 500 })
    expect(toSavePayload(test, '')).toBeNull()
    expect(toSavePayload(test, 'yes')).toBeNull()
    expect(toSavePayload(test, 'true')).toBeNull()
    expect(toSavePayload(test, APPLY_CONFIRMATION)?.gold).toBe(500)
  })

  it('re-validates on the way out, so no sequence of edits can write a bad save', () => {
    const test = createTestState(createDefaultPlayerState())
    // Everything a slider or a text field could plausibly get wrong.
    test.player.level = 10_000
    test.player.gold = -50
    test.player.raceId = 'dragon' as never
    test.player.ownedItemIds = ['no-such-item']
    test.player.stageProgress.highestUnlocked = 9999

    const applied = toSavePayload(test, APPLY_CONFIRMATION)!
    expect(applied.level).toBe(MAX_LEVEL)
    expect(applied.gold).toBe(0)
    expect(applied.raceId).toBe('human')
    expect(applied.ownedItemIds).toEqual([])
    expect(applied.stageProgress.highestUnlocked).toBe(STAGES.length)
    // And the stats that came back are the ones that level implies, not the
    // ones the lab happened to be carrying.
    expect(applied.stats).toEqual(statsForLevel(MAX_LEVEL, 'human'))
  })

  it('carries the revision across unchanged so applying is an edit, not a fork', () => {
    const save = { ...createDefaultPlayerState(), revision: 42, syncedRevision: 42 }
    const test = updateTestPlayer(createTestState(save), { gold: 10 })
    const applied = toSavePayload(test, APPLY_CONFIRMATION)!
    expect(applied.revision).toBe(42)
    expect(applied.syncedRevision).toBe(42)
  })

  it('clamps the simulation knobs', () => {
    const test = createTestState(createDefaultPlayerState())
    const wild = normalizeTestState({
      ...test,
      damageMultiplier: 1e9,
      animationSpeed: Number.NaN,
      difficulty: 'impossible' as never,
    })
    expect(wild.damageMultiplier).toBe(10)
    expect(wild.animationSpeed).toBe(0.25)
    expect(wild.difficulty).toBe('normal')
  })
})

describe('admin presets', () => {
  it('has unique ids and produces states that survive validation', () => {
    expect(new Set(ADMIN_PRESETS.map((p) => p.id)).size).toBe(ADMIN_PRESETS.length)
    const base = createDefaultPlayerState()
    for (const preset of ADMIN_PRESETS) {
      const state = preset.apply(base)
      const applied = toSavePayload({ ...createTestState(state) }, APPLY_CONFIRMATION)
      expect(applied, `${preset.id} produced an unloadable save`).not.toBeNull()
      // Nothing the validator would strip: every owned item real, every
      // completed stage real, unlock inside the campaign.
      expect(applied!.ownedItemIds.length).toBe(state.ownedItemIds.length)
      expect(applied!.stageProgress.completedStageIds.length).toBe(
        state.stageProgress.completedStageIds.length,
      )
    }
  })

  it('orders the progression presets by how far through they are', () => {
    const base = createDefaultPlayerState()
    const order = (id: string) => PRESET_BY_ID.get(id)!.apply(base).stageProgress.highestUnlocked
    expect(order('new-player')).toBeLessThan(order('early-game'))
    expect(order('early-game')).toBeLessThan(order('mid-game'))
    expect(order('mid-game')).toBeLessThan(order('late-game'))
    expect(order('endgame-ready')).toBe(STAGES.length)
  })

  it('makes Underpowered genuinely underpowered for where it sits', () => {
    const base = createDefaultPlayerState()
    const under = PRESET_BY_ID.get('underpowered')!.apply(base)
    const late = PRESET_BY_ID.get('late-game')!.apply(base)
    expect(under.stageProgress.highestUnlocked).toBe(late.stageProgress.highestUnlocked)
    expect(under.level).toBeLessThan(late.level)
    expect(under.ownedItemIds.length).toBeLessThan(late.ownedItemIds.length)
  })

  it('gives the two build presets opposite shapes', () => {
    const base = createDefaultPlayerState()
    const cannon = PRESET_BY_ID.get('glass-cannon')!.apply(base)
    const tank = PRESET_BY_ID.get('tank')!.apply(base)
    expect(cannon.upgrades.atk).toBeGreaterThan(tank.upgrades.atk)
    expect(tank.upgrades.hp).toBeGreaterThan(cannon.upgrades.hp)
    expect(tank.upgrades.def).toBeGreaterThan(cannon.upgrades.def)
  })
})
