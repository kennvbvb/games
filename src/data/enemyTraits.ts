import type { MessageKey } from '../i18n'
import type { StatusApplication } from '../systems/status'

/**
 * A quirk the stage's enemy fights with. Traits are what make two enemies with
 * the same stat block play differently, and they are the reason one battle plan
 * beats another.
 *
 * Which stage gets which trait is hand-authored in data/stages, not derived —
 * that ordering *is* the difficulty curve, and a formula would make it
 * accidental.
 */
export const TRAIT_IDS = [
  'straightforward',
  'slippery',
  'fierce',
  'mending',
  // Added for the back half of the campaign, where a stat block on its own
  // stops being interesting. Each one asks a different question of a build.
  'armored',
  'venomous',
  'countering',
  'disruptive',
  'vampiric',
  'shielded',
  'unstable',
  'phasebound',
] as const

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
  /** Multiplier on the enemy's own defence, for traits that armour it up. */
  defScale?: number
  /** Fraction of the damage it takes that it sends back at the player. */
  reflect?: number
  /** Fraction of damage dealt that it drains back as health. */
  drain?: number
  /** Shield, as a fraction of Max HP, standing in front of its health. */
  shield?: number
  /** A status it puts on the player; see systems/status. */
  inflict?: StatusApplication
  /**
   * Turns until it swaps to its other face. Zero disables. The swap is a pure
   * function of the turn number, so a fight with one stays deterministic.
   */
  alternateEvery?: number
  /** Multiplier applied on the turns it has swapped to. */
  alternateAtk?: number
  alternateIncoming?: number
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

  // --- Later worlds --------------------------------------------------------
  {
    id: 'armored',
    nameKey: 'trait.armored',
    descriptionKey: 'trait.armoredHint',
    icon: 'icon_def',
    dodgeEvery: 0,
    fierce: 1,
    fierceBelow: 0,
    heal: 0,
    healEvery: 0,
    // 1.6 was enough to push the lowest-attack kin onto the minimum-1 damage
    // floor, which turns "tanky" into "unkillable" for exactly one build. Same
    // trap the difficulty modes avoid by never scaling defence at all.
    defScale: 1.35,
  },
  {
    id: 'venomous',
    nameKey: 'trait.venomous',
    descriptionKey: 'trait.venomousHint',
    icon: 'decor_droplet',
    dodgeEvery: 0,
    fierce: 1,
    fierceBelow: 0,
    heal: 0,
    healEvery: 0,
    inflict: { id: 'poison', turns: 4, stacks: 1, everyN: 2 },
  },
  {
    id: 'countering',
    nameKey: 'trait.countering',
    descriptionKey: 'trait.counteringHint',
    icon: 'icon_clash',
    dodgeEvery: 0,
    fierce: 1,
    fierceBelow: 0,
    heal: 0,
    healEvery: 0,
    reflect: 0.2,
  },
  {
    id: 'disruptive',
    nameKey: 'trait.disruptive',
    descriptionKey: 'trait.disruptiveHint',
    icon: 'decor_fog',
    dodgeEvery: 0,
    fierce: 1,
    fierceBelow: 0,
    heal: 0,
    healEvery: 0,
    inflict: { id: 'weaken', turns: 3, stacks: 1, everyN: 3 },
  },
  {
    id: 'vampiric',
    nameKey: 'trait.vampiric',
    descriptionKey: 'trait.vampiricHint',
    icon: 'decor_bone',
    dodgeEvery: 0,
    fierce: 1,
    fierceBelow: 0,
    heal: 0,
    healEvery: 0,
    drain: 0.35,
  },
  {
    id: 'shielded',
    nameKey: 'trait.shielded',
    descriptionKey: 'trait.shieldedHint',
    icon: 'decor_crystal',
    dodgeEvery: 0,
    fierce: 1,
    fierceBelow: 0,
    heal: 0,
    healEvery: 0,
    shield: 0.25,
  },
  {
    id: 'unstable',
    nameKey: 'trait.unstable',
    descriptionKey: 'trait.unstableHint',
    icon: 'decor_bolt',
    dodgeEvery: 0,
    fierce: 1,
    fierceBelow: 0,
    heal: 0,
    healEvery: 0,
    alternateEvery: 2,
    alternateAtk: 1.5,
    alternateIncoming: 1.3,
  },
  {
    id: 'phasebound',
    nameKey: 'trait.phasebound',
    descriptionKey: 'trait.phaseboundHint',
    icon: 'decor_portal',
    // Was every 3rd attack, which is a third of all damage gone and made the
    // late bosses that carry it cost five kin twenty-plus replays each. Every
    // 4th matches Slippery; the freeze is what makes it its own thing.
    dodgeEvery: 4,
    fierce: 1.2,
    fierceBelow: 0.4,
    heal: 0,
    healEvery: 0,
    inflict: { id: 'freeze', turns: 1, everyN: 5 },
  },
]

export const TRAIT_BY_ID = new Map(ENEMY_TRAITS.map((trait) => [trait.id, trait]))

export function traitOf(id: TraitId | undefined): EnemyTrait {
  return TRAIT_BY_ID.get(id ?? DEFAULT_TRAIT) ?? TRAIT_BY_ID.get(DEFAULT_TRAIT)!
}
