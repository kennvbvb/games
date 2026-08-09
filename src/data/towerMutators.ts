import type { MessageKey } from '../i18n'
import type { EnemyConfig } from '../types'
import type { ModifierSource } from '../systems/combatModifiers'

/**
 * The rule a band of tower floors fights under.
 *
 * The expansion plan is blunt about this: the tower's difficulty has to come
 * from rules that change how a build is put together, not from more health and
 * more attack. The stat curve alone produces a climb where the answer to every
 * floor is the answer to the last one, only more so — which is a number going
 * up, not a game.
 *
 * So every five floors the rule changes, and each rule has a build that answers
 * it:
 *
 * - **Warded** multiplies enemy defence. Raw attack loses value fast against
 *   armour; Pierce takes the armour away instead. This band is Breaker's.
 * - **Charmless** switches both accessory slots off. Four slots have to carry
 *   what six did, which is the one rule that cannot be answered by swapping a
 *   single piece — it has to be answered by rebuilding.
 * - **Withered** halves healing and shielding. Sustain stops being a defence,
 *   so mitigation has to be. This band is Bulwark's.
 * - **Open Halls** has no rule at all, and is where the stat curve is the whole
 *   test. One band in four, deliberately: a climb that is a puzzle on every
 *   floor is exhausting, and the free band is also what makes the other three
 *   read as rules rather than as background.
 *
 * Every mutator is a pure function of the floor number and carries no
 * randomness, so a floor is the same floor on every device and the pre-fight
 * forecast stays an exact simulation rather than an estimate.
 *
 * ## What the rules actually cost
 *
 * Measured, same hero either way — a campaign finisher at level 40 with every
 * shop piece, every skill and the stat treats bought. The floor each kin stops
 * on:
 *
 *   rules off, no relics     every kin       floor 40
 *   rules on,  no relics     human, dwarf    floor 30   others floor 40
 *   rules on,  relics        dwarf           floor 30   others floor 40
 *   rules on,  relics + 1    every kin       floor 40
 *
 * So the rules cost the two lowest-attack kin exactly one boss gate, the relics
 * that answer them buy it back for Human, and Dwarf needs one ascension. Every
 * wall lands on a boss floor rather than mid-band, which is the shape wanted:
 * the gates are the tests and the four floors before each are the run-up.
 */
export interface TowerMutator {
  id: string
  nameKey: MessageKey
  descriptionKey: MessageKey
  /** Applied to the player's half of the fight; see systems/playerBattle. */
  mods?: ModifierSource
  /**
   * Multiplier on the floor enemy's defence.
   *
   * This was a flat bump for exactly as long as the damage floor was an
   * absolute 1. Under that rule, scaling defence scaled the *gap* between a
   * kin's attack and the point where every blow lands for one — and the gap is
   * thin. Damage per hit for Dwarf, the lowest-attack kin, fully geared, on the
   * warded floors, measured then:
   *
   *   floors      6-10            26-30           46-50
   *   x1.00       131..132        46,43,37,1,32   1 (already floored)
   *   x1.10       113..107        18,15,9,1,1
   *   x1.25        85..75          1,1,1,1,1
   *
   * A ten percent bump erased Dwarf two bands in. Now that the floor is a share
   * of the attacker's attack (see MIN_DAMAGE_FRACTION), the same sweep bottoms
   * out at 67 even at x2.0 — armour saturates instead of winning outright, so
   * the rule can scale again.
   *
   * A multiplier rather than the flat bump back, because the tower is endless:
   * ten defence is a real cost at floor 10 and rounding error at floor 500,
   * so a flat rule quietly stops being a rule. x1.35 keeps subtraction the
   * binding term for most kin through the measured wall rather than pinning
   * them to the floor.
   */
  enemyDefScale?: number
  /** Both accessory slots contribute nothing: no stats, no affixes, no effect. */
  silenceAccessories?: true
}

/** Floors per band; also the tower list's page size, so one page is one rule. */
export const FLOORS_PER_BAND = 5

/** How much the Warded bands multiply enemy defence by. */
export const WARDED_DEFENCE_SCALE = 1.35

export const TOWER_MUTATORS: TowerMutator[] = [
  {
    id: 'open',
    nameKey: 'tower.mutOpen',
    descriptionKey: 'tower.mutOpenHint',
  },
  {
    id: 'warded',
    nameKey: 'tower.mutWarded',
    descriptionKey: 'tower.mutWardedHint',
    enemyDefScale: WARDED_DEFENCE_SCALE,
  },
  {
    id: 'charmless',
    nameKey: 'tower.mutCharmless',
    descriptionKey: 'tower.mutCharmlessHint',
    silenceAccessories: true,
  },
  {
    id: 'withered',
    nameKey: 'tower.mutWithered',
    descriptionKey: 'tower.mutWitheredHint',
    // Healing and shielding are both fractions of Max HP that *add* across
    // sources, so halving them is a scale on the player's own pool rather than
    // on the sources — which is why this is `sustainScale`, not `heal: 0.5`.
    mods: { sustainScale: 0.5 },
  },
]

export const MUTATOR_BY_ID = new Map(TOWER_MUTATORS.map((m) => [m.id, m]))

/** 1-based band index; band 1 is floors 1..FLOORS_PER_BAND. */
export function bandOfFloor(floor: number): number {
  return Math.floor((Math.max(1, Math.floor(floor)) - 1) / FLOORS_PER_BAND) + 1
}

/** First floor of the band a floor sits in — the checkpoint that opens it. */
export function bandStart(floor: number): number {
  return (bandOfFloor(floor) - 1) * FLOORS_PER_BAND + 1
}

/** A checkpoint is where a band, and therefore a rule, begins. */
export function isCheckpointFloor(floor: number): boolean {
  return bandStart(floor) === Math.max(1, Math.floor(floor))
}

export function mutatorForFloor(floor: number): TowerMutator {
  return TOWER_MUTATORS[(bandOfFloor(floor) - 1) % TOWER_MUTATORS.length]
}

/** The mutator a tower stage id fights under, or undefined outside the tower. */
export function mutatorForStageId(id: string): TowerMutator | undefined {
  if (!id.startsWith('tower-')) return undefined
  const floor = Number.parseInt(id.slice('tower-'.length), 10)
  return Number.isFinite(floor) ? mutatorForFloor(floor) : undefined
}

/** Applies the band's rule to a floor's enemy. */
export function applyMutatorToEnemy(enemy: EnemyConfig, mutator: TowerMutator): EnemyConfig {
  if (mutator.enemyDefScale === undefined) return enemy
  return { ...enemy, def: Math.round(enemy.def * mutator.enemyDefScale) }
}
