import type { MessageKey } from '../i18n'

/**
 * A quirk the stage's enemy fights with. Traits are what make two enemies with
 * the same stat block play differently, and they are the reason one battle plan
 * beats another.
 *
 * Which stage gets which trait is hand-authored in data/stages, not derived —
 * that ordering *is* the difficulty curve, and a formula would make it
 * accidental.
 */
export const TRAIT_IDS = ['straightforward', 'slippery', 'fierce', 'mending'] as const

export type TraitId = (typeof TRAIT_IDS)[number]

export const DEFAULT_TRAIT: TraitId = 'straightforward'

export interface EnemyTrait {
  id: TraitId
  nameKey: MessageKey
  descriptionKey: MessageKey
  icon: string
  /** Dodges every Nth player attack; 0 disables it. */
  dodgeEvery: number
  /** Damage multiplier once the enemy is at or below `enrageBelow` of its Max HP. */
  fierce: number
  /** Threshold for `fierce`, as a fraction of Max HP. */
  fierceBelow: number
  /** Fraction of Max HP the enemy restores every `healEvery`-th enemy attack. */
  heal: number
  healEvery: number
}

export const ENEMY_TRAITS: EnemyTrait[] = [
  {
    id: 'straightforward',
    nameKey: 'trait.straightforward',
    descriptionKey: 'trait.straightforwardHint',
    icon: 'decor_leaf',
    dodgeEvery: 0,
    fierce: 1,
    fierceBelow: 0,
    heal: 0,
    healEvery: 0,
  },
  {
    id: 'slippery',
    nameKey: 'trait.slippery',
    descriptionKey: 'trait.slipperyHint',
    icon: 'decor_droplet',
    dodgeEvery: 4,
    fierce: 1,
    fierceBelow: 0,
    heal: 0,
    healEvery: 0,
  },
  {
    id: 'fierce',
    nameKey: 'trait.fierce',
    descriptionKey: 'trait.fierceHint',
    icon: 'decor_fire',
    dodgeEvery: 0,
    fierce: 1.45,
    fierceBelow: 0.5,
    heal: 0,
    healEvery: 0,
  },
  {
    id: 'mending',
    nameKey: 'trait.mending',
    descriptionKey: 'trait.mendingHint',
    icon: 'decor_herb',
    dodgeEvery: 0,
    fierce: 1,
    fierceBelow: 0,
    heal: 0.06,
    healEvery: 3,
  },
]

export const TRAIT_BY_ID = new Map(ENEMY_TRAITS.map((trait) => [trait.id, trait]))

export function traitOf(id: TraitId | undefined): EnemyTrait {
  return TRAIT_BY_ID.get(id ?? DEFAULT_TRAIT) ?? TRAIT_BY_ID.get(DEFAULT_TRAIT)!
}
