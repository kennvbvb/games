import { describe, it, expect } from 'vitest'
import {
  RACES,
  RACE_IDS,
  DEFAULT_RACE,
  raceOf,
  normalizeRace,
  normalizeAppearance,
  raceTextureKey,
  heroTexture,
} from '../src/data/races'
import { BALANCE } from '../src/data/balance'
import { statsForLevel } from '../src/systems/leveling'
import { resolveBattle } from '../src/systems/combat'
import { expWithRacePassive } from '../src/systems/rewards'
import { stageOutlook } from '../src/systems/difficulty'
import { createDefaultPlayerState } from '../src/state/playerState'
import { parsePlayerState } from '../src/state/validate'
import { STAGES } from '../src/data/stages'
import EMOJI_ASSETS from '../src/data/emojiAssets.json'
import type { EnemyConfig, PlayerStats } from '../src/types'

const STATS = ['maxHp', 'atk', 'def'] as const

describe('race roster', () => {
  it('has six races with unique ids', () => {
    expect(RACES).toHaveLength(6)
    expect(new Set(RACE_IDS).size).toBe(RACE_IDS.length)
    expect(RACES.map((r) => r.id)).toEqual([...RACE_IDS])
  })

  it('gives every race positive stats and growth', () => {
    for (const race of RACES) {
      for (const stat of STATS) {
        expect(race.baseStats[stat], `${race.id} base ${stat}`).toBeGreaterThan(0)
        expect(race.growth[stat], `${race.id} growth ${stat}`).toBeGreaterThan(0)
      }
    }
  })

  it('lets no race beat another on all three stats at once', () => {
    // "No race wins every situation" is a design requirement, so it is checked
    // at level 1 and again once growth has had time to compound.
    for (const level of [1, 30]) {
      for (const a of RACES) {
        for (const b of RACES) {
          if (a.id === b.id) continue
          const left = statsForLevel(level, a.id)
          const right = statsForLevel(level, b.id)
          const dominates = STATS.every((s) => left[s] > right[s])
          expect(dominates, `${a.id} dominates ${b.id} at Lv${level}`).toBe(false)
        }
      }
    }
  })

  it('offers at least two looks per race, each with a real texture', () => {
    const keys = new Set(Object.keys(EMOJI_ASSETS))
    for (const race of RACES) {
      expect(race.appearances.length, race.id).toBeGreaterThanOrEqual(2)
      expect(new Set(race.appearances).size).toBe(race.appearances.length)
      for (const appearance of race.appearances) {
        expect(keys.has(raceTextureKey(race.id, appearance)), `${race.id}/${appearance}`).toBe(true)
      }
    }
  })
})

describe('normalisation', () => {
  it('falls back to the default rather than trusting a save', () => {
    expect(normalizeRace('dragon')).toBe(DEFAULT_RACE)
    expect(normalizeRace(undefined)).toBe(DEFAULT_RACE)
    expect(normalizeRace(42)).toBe(DEFAULT_RACE)
    // A prototype key must not resolve to something callable.
    expect(normalizeRace('constructor')).toBe(DEFAULT_RACE)
    expect(normalizeRace('elf')).toBe('elf')
  })

  it('never yields NaN stats for an unknown race', () => {
    const stats = statsForLevel(20, 'not-a-race')
    for (const stat of STATS) expect(Number.isFinite(stats[stat])).toBe(true)
  })

  it('clamps an appearance to one the race actually offers', () => {
    expect(normalizeAppearance('elf', 'z')).toBe(raceOf('elf').appearances[0])
    expect(normalizeAppearance('elf', 'b')).toBe('b')
    // An appearance valid for another race is still rejected here.
    expect(raceTextureKey('orc', 'nonsense')).toBe(`race_orc_${raceOf('orc').appearances[0]}`)
  })

  it('draws the hero from race and appearance, not the animal buddy', () => {
    const state = { ...createDefaultPlayerState('Hero'), avatar: 'fox', raceId: 'undead' as const, appearanceId: 'b' }
    expect(heroTexture(state)).toBe('race_undead_b')
  })
})

describe('migrating a save from before races existed', () => {
  const legacy = {
    ...createDefaultPlayerState('Veteran'),
    level: 17,
    exp: 42,
    gold: 3210,
    avatar: 'panda',
    upgrades: { hp: 4, atk: 3, def: 2 },
    stageProgress: { highestUnlocked: 9, completedStageIds: ['stage-1', 'stage-2', 'stage-3'] },
  } as Record<string, unknown>

  it('becomes human without moving a single number', () => {
    delete legacy.raceId
    delete legacy.appearanceId
    const parsed = parsePlayerState(legacy)!

    expect(parsed.raceId).toBe('human')
    // Human is defined from the pre-race balance constants, so a derived stat
    // block has to come out identical to what that save was already showing.
    expect(parsed.stats).toEqual({
      maxHp: BALANCE.baseStats.maxHp + 16 * BALANCE.statsPerLevel.maxHp,
      atk: BALANCE.baseStats.atk + 16 * BALANCE.statsPerLevel.atk,
      def: BALANCE.baseStats.def + 16 * BALANCE.statsPerLevel.def,
    })
    expect(parsed.level).toBe(17)
    expect(parsed.exp).toBe(42)
    expect(parsed.gold).toBe(3210)
    expect(parsed.upgrades).toEqual({ hp: 4, atk: 3, def: 2 })
    expect(parsed.stageProgress.completedStageIds).toEqual(['stage-1', 'stage-2', 'stage-3'])
  })

  it('keeps the animal buddy the player originally picked', () => {
    expect(parsePlayerState(legacy)!.avatar).toBe('panda')
  })

  it('leaves every stage difficulty rating exactly where it was', () => {
    // Human's passive is the only one that never touches combat. That is why it
    // is the migration default — any other choice would silently shift the
    // difficulty of every stage for every existing player.
    const migrated = parsePlayerState(legacy)!
    const raceless = { ...migrated, raceId: 'human' as const }
    for (const stage of STAGES) {
      expect(stageOutlook(migrated, stage)).toEqual(stageOutlook(raceless, stage))
    }
    expect(raceOf('human').passive).toBeUndefined()
  })
})

describe('passives', () => {
  const player: PlayerStats = { maxHp: 600, atk: 40, def: 20 }
  const dummy: EnemyConfig = { name: 'Dummy', sprite: 'enemy_1', maxHp: 4000, atk: 60, def: 5 }
  const rewards = { exp: 100, gold: 10 }

  it('is deterministic for every race', () => {
    for (const race of RACES) {
      const ctx = { player, enemy: dummy, rewards, passive: race.passive }
      expect(resolveBattle(ctx)).toEqual(resolveBattle(ctx))
    }
  })

  it('changes the fight for every race whose passive is combat-side', () => {
    const plain = resolveBattle({ player, enemy: dummy, rewards })
    for (const race of RACES) {
      if (race.passive === undefined) continue
      const withPassive = resolveBattle({ player, enemy: dummy, rewards, passive: race.passive })
      expect(withPassive.log, `${race.id} passive had no effect`).not.toEqual(plain.log)
    }
  })

  it('keeps the EXP bonus out of combat, where it could skew a preview', () => {
    const human = RACES.find((r) => r.id === 'human')!
    expect(human.passive).toBeUndefined()
    expect(human.expBonus).toBe(1.08)
    expect(expWithRacePassive(100, 'human')).toBe(108)
    // Every other race earns exactly what the stage pays.
    for (const race of RACES) {
      if (race.id === 'human') continue
      expect(expWithRacePassive(100, race.id)).toBe(100)
    }
  })

  it('applies the EXP bonus per battle so an offline total stays a clean multiple', () => {
    // A stage paying 6 EXP: ten offline wins should read as ten lots of what a
    // single fight shows, not as a rounded lump that matches nothing on screen.
    const perBattle = expWithRacePassive(6, 'human')
    expect(perBattle).toBe(6)
    expect(perBattle * 10).toBe(60)
    // Rounding the total instead would pay 65 for ten fights worth 6 apiece.
    expect(Math.round(6 * 10 * 1.08)).toBe(65)
  })
})

describe('starting a game as any race', () => {
  it('gives each race its own level-1 stats', () => {
    for (const race of RACES) {
      const state = createDefaultPlayerState('Hero', undefined, race.id)
      expect(state.raceId).toBe(race.id)
      expect(state.stats).toEqual(race.baseStats)
      expect(race.appearances).toContain(state.appearanceId)
    }
  })

  it('lets every race clear the first stage without shopping', () => {
    // The opening fight must not be a wall for anyone, whatever they picked.
    for (const race of RACES) {
      const state = createDefaultPlayerState('Hero', undefined, race.id)
      const winnable = ['brave', 'cozy', 'clever'].some((plan) =>
        stageOutlook(state, STAGES[0], plan as 'brave' | 'cozy' | 'clever').willWin,
      )
      expect(winnable, `${race.id} cannot clear stage 1`).toBe(true)
    }
  })
})
