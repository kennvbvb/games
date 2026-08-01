import type { MessageKey } from '../i18n'

/**
 * A stance the player commits to before a fight. Every plan trades something
 * away — there is no strictly-best option, which is what makes the choice on
 * the Prepare Battle screen worth making.
 *
 * All numbers are multipliers folded into a single product per blow; see
 * systems/combat for the exact order of operations.
 */
export const PLAN_IDS = ['brave', 'cozy', 'clever'] as const

export type PlanId = (typeof PLAN_IDS)[number]

export const DEFAULT_PLAN: PlanId = 'brave'

export interface BattlePlan {
  id: PlanId
  nameKey: MessageKey
  descriptionKey: MessageKey
  icon: string
  /** Multiplier on damage the player deals. */
  outgoing: number
  /** Multiplier on damage the player takes. */
  incoming: number
  /** Fraction of Max HP restored on every `healEvery`-th player attack. */
  heal: number
  /** Player attacks between heals; 0 disables healing entirely. */
  healEvery: number
  /** Multiplier applied on every `comboEvery`-th player attack. */
  combo: number
  comboEvery: number
  /** The player dodges every `dodgeEvery`-th enemy attack; 0 disables it. */
  dodgeEvery: number
}

export const BATTLE_PLANS: BattlePlan[] = [
  {
    id: 'brave',
    nameKey: 'plan.brave',
    descriptionKey: 'plan.braveHint',
    icon: 'icon_atk',
    outgoing: 1.25,
    incoming: 1.2,
    heal: 0,
    healEvery: 0,
    combo: 1,
    comboEvery: 0,
    dodgeEvery: 0,
  },
  {
    id: 'cozy',
    nameKey: 'plan.cozy',
    descriptionKey: 'plan.cozyHint',
    icon: 'icon_hp',
    outgoing: 0.9,
    incoming: 0.65,
    heal: 0.06,
    healEvery: 3,
    combo: 1,
    comboEvery: 0,
    dodgeEvery: 0,
  },
  {
    id: 'clever',
    nameKey: 'plan.clever',
    descriptionKey: 'plan.cleverHint',
    icon: 'icon_star',
    outgoing: 0.85,
    incoming: 1,
    heal: 0,
    healEvery: 0,
    combo: 2.15,
    comboEvery: 3,
    dodgeEvery: 4,
  },
]

export const PLAN_BY_ID = new Map(BATTLE_PLANS.map((plan) => [plan.id, plan]))

/** Fails closed to the default, so a hand-edited save cannot invent a plan. */
export function normalizePlan(value: unknown): PlanId {
  if (typeof value !== 'string') return DEFAULT_PLAN
  return (PLAN_IDS as readonly string[]).includes(value) ? (value as PlanId) : DEFAULT_PLAN
}
