import type { ModifierSource } from '../systems/combatModifiers'
import type { MessageKey } from '../i18n'

/**
 * The three answers the game has to an enemy.
 *
 * This is the point of the whole equipment layer: a piece of gear should be the
 * right piece *for a fight*, not simply the newest one. Each tag counters
 * something the campaign actually throws:
 *
 * - **Breaker** strips armour and ends fights. It is the answer to a
 *   high-defence enemy, which no amount of raw attack solves once damage has
 *   been pushed onto the minimum-1 floor.
 * - **Bulwark** blunts burst. It is the answer to Fierce and to boss enrage,
 *   where the danger is one huge blow rather than a long grind.
 * - **Tempo** plays the clock — combos, dodges, recovery. It is the answer to
 *   Slippery, and the fastest way through a fight already winnable.
 *
 * A piece may also be **flexible**, which means it fits any of the three and
 * counts towards none of their resonances. Flexible is not a fourth build; it
 * is the absence of a commitment, and it is priced as one.
 */
export const BUILD_TAGS = ['breaker', 'bulwark', 'tempo', 'flexible'] as const

export type BuildTag = (typeof BUILD_TAGS)[number]

export interface BuildConfig {
  id: BuildTag
  nameKey: MessageKey
  descriptionKey: MessageKey
  icon: string
  /**
   * Granted at two worn pieces carrying this tag. Deliberately *not* a
   * four-piece set: sets already ask for four of six slots, and a second system
   * demanding the same commitment would leave the player with one real choice
   * rather than two. Two pieces is a lean, not a uniform.
   */
  resonance: ModifierSource
  resonanceKey: MessageKey
}

/** Worn pieces of one tag needed before its resonance applies. */
export const RESONANCE_AT = 2

export const BUILDS: BuildConfig[] = [
  {
    id: 'breaker',
    nameKey: 'build.breaker',
    descriptionKey: 'build.breakerHint',
    icon: 'icon_atk',
    resonance: { pierce: 4 },
    resonanceKey: 'build.breakerResonance',
  },
  {
    id: 'bulwark',
    nameKey: 'build.bulwark',
    descriptionKey: 'build.bulwarkHint',
    icon: 'icon_def',
    resonance: { incoming: 0.94 },
    resonanceKey: 'build.bulwarkResonance',
  },
  {
    id: 'tempo',
    nameKey: 'build.tempo',
    descriptionKey: 'build.tempoHint',
    icon: 'icon_bolt',
    resonance: { comboEvery: 5, combo: 1.2 },
    resonanceKey: 'build.tempoResonance',
  },
  {
    id: 'flexible',
    nameKey: 'build.flexible',
    descriptionKey: 'build.flexibleHint',
    icon: 'icon_star',
    // Nothing. Flexible pieces slot into any build and pay nothing for it.
    resonance: {},
    resonanceKey: 'build.flexibleResonance',
  },
]

export const BUILD_BY_ID = new Map(BUILDS.map((build) => [build.id, build]))

export function buildOf(tag: BuildTag | string | undefined): BuildConfig {
  return BUILD_BY_ID.get((tag ?? 'flexible') as BuildTag) ?? BUILD_BY_ID.get('flexible')!
}

/** Tags that earn a resonance; flexible is excluded because it grants none. */
export const RESONANT_TAGS: BuildTag[] = ['breaker', 'bulwark', 'tempo']

/** How many worn pieces carry each tag. */
export function tagCounts(tags: (BuildTag | undefined)[]): Record<BuildTag, number> {
  const counts: Record<BuildTag, number> = { breaker: 0, bulwark: 0, tempo: 0, flexible: 0 }
  for (const tag of tags) counts[tag ?? 'flexible'] += 1
  return counts
}

/**
 * Resonances currently in force. More than one can apply at once — a hero
 * wearing two Breaker and two Bulwark pieces gets both, which is the mixed
 * build the design asks for rather than a penalty for not committing.
 */
export function activeResonances(tags: (BuildTag | undefined)[]): BuildConfig[] {
  const counts = tagCounts(tags)
  return RESONANT_TAGS.filter((tag) => counts[tag] >= RESONANCE_AT).map((tag) => buildOf(tag))
}

export function resonanceModifiers(tags: (BuildTag | undefined)[]): ModifierSource[] {
  return activeResonances(tags).map((build) => build.resonance)
}
