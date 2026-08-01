import { BALANCE } from './balance'
import type { RaceCombatPassive } from '../systems/combat'
import type { MessageKey } from '../i18n'
import type { PlayerStats } from '../types'

/** Race ids double as the `race_<id>_<appearance>` texture key prefix. */
export const RACE_IDS = ['human', 'elf', 'dwarf', 'orc', 'fae', 'undead'] as const

export type RaceId = (typeof RACE_IDS)[number]

export const DEFAULT_RACE: RaceId = 'human'

export interface RaceConfig {
  id: RaceId
  nameKey: MessageKey
  descriptionKey: MessageKey
  passiveNameKey: MessageKey
  passiveDescriptionKey: MessageKey
  baseStats: PlayerStats
  /** Added per level after the first. */
  growth: PlayerStats
  /** Combat hooks; absent for a race whose passive is reward-side. */
  passive?: RaceCombatPassive
  /** Multiplier on EXP earned. Kept out of combat so it cannot skew a preview. */
  expBonus?: number
  /** Texture key suffixes; the first is the default. At least two per race. */
  appearances: string[]
}

/**
 * Human is deliberately identical to the pre-race balance constants. Every save
 * written before races existed migrates to this race, and stats are derived
 * from level rather than read from disk — so any other numbers here would
 * silently move every existing player's stats on their next load.
 *
 * Its passive is also the only one that never touches combat, which means those
 * players' stage difficulty ratings stay numerically identical too.
 */
const HUMAN_BASE: PlayerStats = { ...BALANCE.baseStats }
const HUMAN_GROWTH: PlayerStats = { ...BALANCE.statsPerLevel }

export const RACES: RaceConfig[] = [
  {
    id: 'human',
    nameKey: 'race.human',
    descriptionKey: 'race.humanHint',
    passiveNameKey: 'race.humanPassive',
    passiveDescriptionKey: 'race.humanPassiveHint',
    baseStats: HUMAN_BASE,
    growth: HUMAN_GROWTH,
    expBonus: 1.08,
    appearances: ['a', 'b'],
  },
  {
    id: 'elf',
    nameKey: 'race.elf',
    descriptionKey: 'race.elfHint',
    passiveNameKey: 'race.elfPassive',
    passiveDescriptionKey: 'race.elfPassiveHint',
    baseStats: { maxHp: 42, atk: 13, def: 3 },
    growth: { maxHp: 9, atk: 4, def: 1 },
    passive: { firstStrike: 1.3 },
    appearances: ['a', 'b'],
  },
  {
    id: 'dwarf',
    nameKey: 'race.dwarf',
    descriptionKey: 'race.dwarfHint',
    passiveNameKey: 'race.dwarfPassive',
    passiveDescriptionKey: 'race.dwarfPassiveHint',
    baseStats: { maxHp: 64, atk: 8, def: 7 },
    growth: { maxHp: 15, atk: 2, def: 2 },
    passive: { damageTaken: 0.95 },
    appearances: ['a', 'b'],
  },
  {
    id: 'orc',
    nameKey: 'race.orc',
    descriptionKey: 'race.orcHint',
    passiveNameKey: 'race.orcPassive',
    passiveDescriptionKey: 'race.orcPassiveHint',
    baseStats: { maxHp: 56, atk: 14, def: 2 },
    growth: { maxHp: 13, atk: 4, def: 1 },
    passive: { lowHp: 1.12, lowHpBelow: 0.5 },
    appearances: ['a', 'b'],
  },
  {
    id: 'fae',
    nameKey: 'race.fae',
    descriptionKey: 'race.faeHint',
    passiveNameKey: 'race.faePassive',
    passiveDescriptionKey: 'race.faePassiveHint',
    baseStats: { maxHp: 48, atk: 12, def: 4 },
    growth: { maxHp: 10, atk: 3, def: 1 },
    passive: { dodgeEvery: 6 },
    appearances: ['a', 'b'],
  },
  {
    id: 'undead',
    nameKey: 'race.undead',
    descriptionKey: 'race.undeadHint',
    passiveNameKey: 'race.undeadPassive',
    passiveDescriptionKey: 'race.undeadPassiveHint',
    baseStats: { maxHp: 58, atk: 9, def: 5 },
    growth: { maxHp: 14, atk: 3, def: 1 },
    passive: { heal: 0.03, healEvery: 3 },
    appearances: ['a', 'b'],
  },
]

export const RACE_BY_ID = new Map(RACES.map((race) => [race.id, race]))

/** Fails closed, so a hand-edited save cannot invent a race with no stats. */
export function normalizeRace(value: unknown): RaceId {
  if (typeof value !== 'string') return DEFAULT_RACE
  return (RACE_IDS as readonly string[]).includes(value) ? (value as RaceId) : DEFAULT_RACE
}

export function raceOf(id: RaceId | string | undefined): RaceConfig {
  return RACE_BY_ID.get(normalizeRace(id))!
}

/** Clamped to the race's own list, so a stale appearance never leaves a blank sprite. */
export function normalizeAppearance(raceId: unknown, value: unknown): string {
  const race = raceOf(normalizeRace(raceId))
  return typeof value === 'string' && race.appearances.includes(value) ? value : race.appearances[0]
}

export function raceTextureKey(raceId: RaceId | string, appearanceId: string): string {
  const id = normalizeRace(raceId)
  return `race_${id}_${normalizeAppearance(id, appearanceId)}`
}

/** The sprite that represents the player, everywhere the hero is drawn. */
export function heroTexture(state: { raceId: RaceId; appearanceId: string }): string {
  return raceTextureKey(state.raceId, state.appearanceId)
}
