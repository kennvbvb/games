import type { ModifierSource } from '../systems/combatModifiers'
import type { ItemKind } from '../types'

/**
 * Affixes are **derived from the item id**, never rolled and stored.
 *
 * The handoff asks for a deterministic item seed. Deriving from the id goes one
 * step further and needs no seed field at all: the same item is the same item
 * on every device, in every save, forever — which is what lets the stage
 * preview stay an exact simulation and lets a wiki page about an item be true.
 *
 * The cost of that choice is honest and worth stating: there is no reforging
 * and no hunting for a better roll, because there is only ever one roll. What
 * is bought is exactly what was shown.
 */

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const

export type Rarity = (typeof RARITIES)[number]

/** How many affixes each rarity carries, on top of the item's base stats. */
export const AFFIX_COUNT: Record<Rarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
}

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#9b8aa6',
  uncommon: '#3faf6e',
  rare: '#4a90d9',
  epic: '#a78bfa',
  legendary: '#d98e04',
}

export const RARITY_LABEL_KEYS = {
  common: 'rarity.common',
  uncommon: 'rarity.uncommon',
  rare: 'rarity.rare',
  epic: 'rarity.epic',
  legendary: 'rarity.legendary',
} as const satisfies Record<Rarity, string>

export interface AffixConfig {
  id: string
  name: string
  /** Rendered with {value} substituted. */
  description: string
  /** Slot kinds this affix can appear on; empty means all of them. */
  kinds: ItemKind[]
  /** Value at the weakest rarity that can carry it, and the step per rarity. */
  base: number
  step: number
  /** Turns a rolled value into the modifier it contributes. */
  build(value: number): ModifierSource
  /** How the value reads: a raw number, or a percentage. */
  format: 'percent' | 'flat'
}

/**
 * The pool. Restricted per item kind so a build reads the way its silhouette
 * suggests — boots are where evasion lives, weapons are where combo damage
 * lives — rather than every slot being a lottery for the same effects.
 */
export const AFFIXES: AffixConfig[] = [
  {
    id: 'sharpness',
    name: 'Sharpness',
    description: '+{value}% damage dealt',
    kinds: ['weapon', 'accessory'],
    base: 3,
    step: 2,
    format: 'percent',
    build: (v) => ({ outgoing: 1 + v / 100 }),
  },
  {
    id: 'combo-edge',
    name: 'Combo Edge',
    description: 'every 4th blow lands at +{value}%',
    kinds: ['weapon'],
    base: 20,
    step: 10,
    format: 'percent',
    build: (v) => ({ comboEvery: 4, combo: 1 + v / 100 }),
  },
  {
    id: 'giantslayer',
    name: 'Giantslayer',
    description: '+{value}% damage to bosses',
    kinds: ['weapon', 'accessory'],
    base: 6,
    step: 3,
    format: 'percent',
    build: (v) => ({ bossDamage: 1 + v / 100 }),
  },
  {
    id: 'executioner',
    name: 'Executioner',
    description: 'below {value}% enemy health, deal 50% more',
    kinds: ['weapon'],
    base: 8,
    step: 3,
    format: 'percent',
    build: (v) => ({ execute: 1.5, executeBelow: v / 100 }),
  },
  {
    id: 'toughness',
    name: 'Toughness',
    description: '+{value}% max health',
    kinds: ['body', 'head'],
    base: 4,
    step: 2,
    format: 'percent',
    build: (v) => ({ hpScale: 1 + v / 100 }),
  },
  {
    id: 'plating',
    name: 'Plating',
    description: '-{value}% damage taken',
    kinds: ['body', 'head', 'boots'],
    base: 3,
    step: 1.5,
    format: 'percent',
    build: (v) => ({ incoming: 1 - v / 100 }),
  },
  {
    id: 'warding',
    name: 'Warding',
    description: 'start each fight behind a {value}% shield',
    kinds: ['body', 'accessory'],
    base: 5,
    step: 3,
    format: 'percent',
    build: (v) => ({ shield: v / 100 }),
  },
  {
    id: 'evasion',
    name: 'Evasion',
    description: 'slip past every {value}th blow',
    kinds: ['boots'],
    base: 12,
    step: -2,
    format: 'flat',
    build: (v) => ({ dodgeEvery: Math.max(3, Math.round(v)) }),
  },
  {
    id: 'riposte',
    name: 'Riposte',
    description: 'a dodge answers back for {value}% of a hit',
    kinds: ['boots', 'weapon'],
    base: 30,
    step: 15,
    format: 'percent',
    build: (v) => ({ counter: v / 100 }),
  },
  {
    id: 'mending',
    name: 'Mending',
    description: 'mend {value}% of health every 4th attack',
    kinds: ['accessory', 'head', 'body'],
    base: 2,
    step: 1,
    format: 'percent',
    build: (v) => ({ heal: v / 100, healEvery: 4 }),
  },
  {
    id: 'barrier',
    name: 'Barrier',
    description: 'overhealing becomes shield, and mend {value}% every 4th attack',
    kinds: ['accessory'],
    base: 2,
    step: 1,
    format: 'percent',
    build: (v) => ({ barrier: true, heal: v / 100, healEvery: 4 }),
  },
  {
    id: 'swiftness',
    name: 'Swiftness',
    description: 'the first blow that lands hits +{value}% harder',
    kinds: ['boots', 'head'],
    base: 15,
    step: 8,
    format: 'percent',
    build: (v) => ({ firstStrike: 1 + v / 100 }),
  },
]

export const AFFIX_BY_ID = new Map(AFFIXES.map((affix) => [affix.id, affix]))

/**
 * FNV-1a over the item id. Any stable hash would do; what matters is that it is
 * a pure function of the id, so the same item derives the same affixes in the
 * client, in a test, and in the balance simulator.
 */
function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

export interface RolledAffix {
  config: AffixConfig
  value: number
  text: string
}

const RARITY_RANK: Record<Rarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
}

/** Small deterministic PRNG, the same one the scenery painter uses. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * The affixes an item carries.
 *
 * The pool is shuffled deterministically and the first N taken, so an item can
 * never draw the same affix twice — two copies of "+3% damage" would read as a
 * bug and would fold into one number anyway.
 *
 * An earlier version walked the pool with a stride from the hash, on the claim
 * that the stride was coprime with the pool length. It was not: a stride of 2
 * across a pool of 4 visits two entries and stops, so every legendary body
 * piece quietly shipped with two affixes instead of four. A shuffle has no such
 * failure mode at any pool size.
 */
export function affixesFor(itemId: string, kind: ItemKind, rarity: Rarity): RolledAffix[] {
  const count = AFFIX_COUNT[rarity]
  if (count === 0) return []

  const pool = AFFIXES.filter((affix) => affix.kinds.includes(kind))
  if (pool.length === 0) return []

  const seed = hash(itemId)
  const rank = RARITY_RANK[rarity]
  const random = mulberry32(seed)

  const order = [...pool]
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }

  return order.slice(0, Math.min(count, pool.length)).map((config, i) => {
    // Rarity sets the magnitude; the hash nudges it so two items of the same
    // rarity are not the same item printed twice.
    const jitter = ((seed >>> (4 + i * 3)) % 3) - 1
    const value = Math.round((config.base + config.step * (rank + jitter * 0.25)) * 10) / 10
    return {
      config,
      value,
      text: config.description.replace('{value}', formatValue(value, config.format)),
    }
  })
}

function formatValue(value: number, format: AffixConfig['format']): string {
  const rounded = Math.round(value * 10) / 10
  return format === 'percent' ? String(rounded) : String(Math.round(rounded))
}

export function affixModifiers(affixes: RolledAffix[]): ModifierSource[] {
  return affixes.map((affix) => affix.config.build(affix.value))
}
