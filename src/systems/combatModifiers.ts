import { PLAN_BY_ID } from '../data/battlePlans'
import type { PlanId } from '../data/battlePlans'

/**
 * Everything that can bend a fight, in one shape.
 *
 * Battle plans, race passives, skills and equipment affixes all reduce to this
 * before the turn loop sees them. That is the whole point: without a common
 * shape the loop grows one branch per system, and the fourth system to arrive
 * silently changes the balance of the first three. With it, `resolveBattle`
 * reads a single record and every system composes by the same rules.
 *
 * ## Composition rules
 *
 * - **Multipliers multiply.** Two sources of +25% damage give ×1.5625, not
 *   ×1.5. They are folded into one product and rounded once, so the order the
 *   sources happen to be declared in cannot change the result.
 * - **Cadences take the strictest.** Two sources of "dodge every Nth" give the
 *   smaller N rather than two independent dodges — a second dodge on the same
 *   blow is invisible, so adding them would pay nothing for a real cost.
 * - **Percentages of Max HP add.** Healing 6% and 3% on the same blow is one
 *   9% heal, matching how a player reads two heal sources stacking.
 * - **Flat reductions add.** Two sources of Pierce 6 give 12 — armour is
 *   subtracted, so the thing that counters it has to be subtracted too.
 * - **Thresholds take the most generous.** A skill that executes below 15% and
 *   one that executes below 20% give 20%: the player bought the wider window.
 */
export interface CombatModifiers {
  /** Multiplier on damage the player deals. */
  outgoing: number
  /** Multiplier on damage the player takes. */
  incoming: number
  /** Extra multiplier on every `comboEvery`-th player attack; 0 disables. */
  comboEvery: number
  combo: number
  /** The player dodges every `dodgeEvery`-th enemy attack; 0 disables. */
  dodgeEvery: number
  /** Fraction of the player's attack dealt back on a dodge; 0 disables. */
  counter: number
  /** Fraction of Max HP restored every `healEvery`-th player attack. */
  heal: number
  healEvery: number
  /** Multiplier on the first player attack that actually lands. */
  firstStrike: number
  /** Multiplier while the player is strictly below `lowHpBelow` of Max HP. */
  lowHp: number
  lowHpBelow: number
  /** Multiplier once the enemy is at or below `executeBelow` of its Max HP. */
  execute: number
  executeBelow: number
  /** Multiplier on damage dealt to a boss specifically. */
  bossDamage: number
  /** Shield, as a fraction of Max HP, granted before the first turn. */
  shield: number
  /**
   * Multiplier on everything that puts health or shield back — the heal
   * cadence, the opening shield, and the barrier overflow that feeds it.
   *
   * A scale rather than a cut to each source, because healing and shielding are
   * fractions of Max HP that *add* across sources: halving them one at a time
   * would depend on how many the player happened to be running, and stacking
   * two small heals would survive a rule meant to switch sustain off.
   */
  sustainScale: number
  /** Healing past Max HP becomes shield instead of being discarded. */
  barrier: boolean
  /**
   * Flat defence stripped from the enemy before damage is worked out.
   *
   * A multiplier could not express this. Armour is subtracted, not divided, so
   * the answer to a high-defence enemy is to take defence away rather than to
   * scale damage that has already been reduced to the minimum-1 floor — which
   * is exactly the wall the balance walk kept finding. Pierce is the Breaker
   * build's whole reason to exist.
   */
  pierce: number
  /** Multipliers on the player's own stat block, applied before the fight. */
  hpScale: number
  atkScale: number
  defScale: number
}

export const NEUTRAL: CombatModifiers = {
  outgoing: 1,
  incoming: 1,
  comboEvery: 0,
  combo: 1,
  dodgeEvery: 0,
  counter: 0,
  heal: 0,
  healEvery: 0,
  firstStrike: 1,
  lowHp: 1,
  lowHpBelow: 0.5,
  execute: 1,
  executeBelow: 0,
  bossDamage: 1,
  shield: 0,
  sustainScale: 1,
  barrier: false,
  pierce: 0,
  hpScale: 1,
  atkScale: 1,
  defScale: 1,
}

/** A contribution from one source. Absent fields mean "no opinion". */
export type ModifierSource = Partial<CombatModifiers>

/** Strictest of two cadences, treating 0 as "never". */
function tightest(a: number, b: number): number {
  if (a <= 0) return b
  if (b <= 0) return a
  return Math.min(a, b)
}

export function combine(base: CombatModifiers, source: ModifierSource): CombatModifiers {
  return {
    outgoing: base.outgoing * (source.outgoing ?? 1),
    incoming: base.incoming * (source.incoming ?? 1),
    combo: base.combo * (source.combo ?? 1),
    comboEvery: tightest(base.comboEvery, source.comboEvery ?? 0),
    dodgeEvery: tightest(base.dodgeEvery, source.dodgeEvery ?? 0),
    counter: Math.max(base.counter, source.counter ?? 0),
    heal: base.heal + (source.heal ?? 0),
    healEvery: tightest(base.healEvery, source.healEvery ?? 0),
    firstStrike: base.firstStrike * (source.firstStrike ?? 1),
    lowHp: base.lowHp * (source.lowHp ?? 1),
    // The most generous threshold wins; a stricter one would silently cancel
    // the wider window the player already paid for.
    lowHpBelow: Math.max(base.lowHpBelow, source.lowHpBelow ?? 0),
    execute: base.execute * (source.execute ?? 1),
    executeBelow: Math.max(base.executeBelow, source.executeBelow ?? 0),
    bossDamage: base.bossDamage * (source.bossDamage ?? 1),
    shield: base.shield + (source.shield ?? 0),
    sustainScale: base.sustainScale * (source.sustainScale ?? 1),
    barrier: base.barrier || (source.barrier ?? false),
    pierce: base.pierce + (source.pierce ?? 0),
    hpScale: base.hpScale * (source.hpScale ?? 1),
    atkScale: base.atkScale * (source.atkScale ?? 1),
    defScale: base.defScale * (source.defScale ?? 1),
  }
}

export function foldModifiers(sources: (ModifierSource | undefined)[]): CombatModifiers {
  return sources.reduce<CombatModifiers>(
    (acc, source) => (source ? combine(acc, source) : acc),
    NEUTRAL,
  )
}

/**
 * A battle plan as a modifier source. Plans predate this type and keep their
 * own shape in data — they are player-facing content with their own screen —
 * so the translation lives here rather than reshaping the data file.
 */
export function planModifiers(id: PlanId | undefined): ModifierSource | undefined {
  const plan = id ? PLAN_BY_ID.get(id) : undefined
  if (!plan) return undefined
  return {
    outgoing: plan.outgoing,
    incoming: plan.incoming,
    combo: plan.combo,
    comboEvery: plan.comboEvery,
    dodgeEvery: plan.dodgeEvery,
    heal: plan.heal,
    healEvery: plan.healEvery,
  }
}
