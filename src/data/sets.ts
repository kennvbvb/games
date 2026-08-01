import { ITEMS } from './items'
import type { ModifierSource } from '../systems/combatModifiers'

/**
 * Set bonuses, at two and four pieces.
 *
 * Every set spans four different *kinds*, so assembling one costs four of the
 * six worn slots. That is the price the bonus is paid for: a set is a
 * commitment to a way of fighting rather than a free extra on top of whatever
 * was already best in slot.
 *
 * The bonuses are mechanics, not numbers, for the same reason the skill
 * branches are — a set that gave +10% damage would only ever compete on
 * arithmetic, and would win or lose by a spreadsheet rather than by a fight.
 */
export interface SetConfig {
  id: string
  name: string
  twoPiece: { description: string; mods: ModifierSource }
  fourPiece: { description: string; mods: ModifierSource }
}

export const SETS: SetConfig[] = [
  {
    id: 'ironclad',
    name: 'Ironclad',
    twoPiece: { description: 'Take 6% less from every hit', mods: { incoming: 0.94 } },
    fourPiece: {
      description: 'Start each fight behind a 20% shield',
      mods: { shield: 0.2 },
    },
  },
  {
    id: 'trickster',
    name: 'Trickster',
    twoPiece: { description: 'Slip past every 7th blow', mods: { dodgeEvery: 7 } },
    fourPiece: {
      description: 'A dodge answers back for 70% of a hit',
      mods: { counter: 0.7 },
    },
  },
  {
    id: 'berserker',
    name: 'Berserker',
    twoPiece: { description: 'Deal 8% more damage', mods: { outgoing: 1.08 } },
    fourPiece: {
      description: 'Below half health, deal 22% more',
      mods: { lowHp: 1.22, lowHpBelow: 0.5 },
    },
  },
  {
    id: 'celestial',
    name: 'Celestial',
    twoPiece: { description: 'Mend 3% of health every 4th attack', mods: { heal: 0.03, healEvery: 4 } },
    fourPiece: {
      description: 'Overhealing becomes shield instead of being wasted',
      mods: { barrier: true },
    },
  },
]

export const SET_BY_ID = new Map(SETS.map((set) => [set.id, set]))

export const SET_MEMBERS: Record<string, string[]> = Object.fromEntries(
  SETS.map((set) => [set.id, ITEMS.filter((item) => item.setId === set.id).map((item) => item.id)]),
)

export const TWO_PIECE = 2
export const FOUR_PIECE = 4

export interface ActiveSet {
  set: SetConfig
  worn: number
  twoActive: boolean
  fourActive: boolean
}

/** Which sets the worn pieces add up to, counted by *equipped* items only. */
export function activeSets(equippedItemIds: string[]): ActiveSet[] {
  const counts = new Map<string, number>()
  for (const id of equippedItemIds) {
    const setId = ITEMS.find((item) => item.id === id)?.setId
    if (setId) counts.set(setId, (counts.get(setId) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([setId, worn]) => {
      const set = SET_BY_ID.get(setId)
      return set
        ? { set, worn, twoActive: worn >= TWO_PIECE, fourActive: worn >= FOUR_PIECE }
        : null
    })
    .filter((entry): entry is ActiveSet => entry !== null && entry.worn > 0)
    .sort((a, b) => b.worn - a.worn || a.set.id.localeCompare(b.set.id))
}

export function setModifiers(equippedItemIds: string[]): ModifierSource[] {
  const mods: ModifierSource[] = []
  for (const active of activeSets(equippedItemIds)) {
    if (active.twoActive) mods.push(active.set.twoPiece.mods)
    if (active.fourActive) mods.push(active.set.fourPiece.mods)
  }
  return mods
}
