import { WEEK_MS } from './rifts'
import { PLAN_IDS } from './battlePlans'
import { TRAIT_IDS } from './enemyTraits'
import type { MessageKey } from '../i18n'
import type { PlanId } from './battlePlans'
import type { TraitId } from './enemyTraits'

/**
 * Weekly Contracts: three jobs a week, of which two pay.
 *
 * The expansion plan is specific about the shape, and every part of it is a
 * reaction to how weekly content usually goes wrong:
 *
 * - **Three offered, two required.** A player who cannot stand one of the three
 *   is not locked out of the week, and nobody has to force a build they dislike
 *   to keep a streak.
 * - **The reward can be claimed late.** Completing a week's work and then not
 *   opening the game for a few days must not throw it away. Finished weeks
 *   queue up and stay claimable for `CONTRACT_GRACE_WEEKS`.
 * - **Gold and EXP only**, for exactly the reason the Realm Rift pays those and
 *   nothing else: the week comes from the device clock, there is no server to
 *   check it against, and a player who moves their clock can mint as many weeks
 *   as they have patience for. Paying anything scarce would make that worth
 *   doing. Gold and EXP are already given away without limit by idle farming.
 *
 * The three on offer are a pure function of the week index — the same rotation
 * on every device, no shuffle, nothing stored to say which ones you were given.
 */

export const CONTRACTS_PER_WEEK = 3

/** How many of the three pay out the week's reward. */
export const CONTRACTS_TO_CLEAR = 2

/** Weeks a finished-but-unclaimed reward keeps waiting. */
export const CONTRACT_GRACE_WEEKS = 3

export type ContractKind = 'winsWithPlan' | 'bossHealthy' | 'towerFloors' | 'beatTrait' | 'remixWins'

export interface ContractConfig {
  id: string
  kind: ContractKind
  /** How many times the condition has to be met. */
  target: number
  labelKey: MessageKey
  /** Filled into the label; whichever of these the kind uses. */
  plan?: PlanId
  trait?: TraitId
  /** Fraction of Max HP the player must still hold, for `bossHealthy`. */
  healthAbove?: number
}

/**
 * The pool the week draws from.
 *
 * Deliberately drawn from things a player already does rather than from
 * detours: every one of these is satisfiable by playing the campaign, the tower
 * or the remix the way you were going to anyway, with one decision changed.
 */
const POOL: ContractConfig[] = [
  ...PLAN_IDS.map((plan) => ({
    id: `plan-${plan}`,
    kind: 'winsWithPlan' as const,
    target: 10,
    labelKey: 'contract.winsWithPlan' as MessageKey,
    plan,
  })),
  {
    id: 'boss-healthy',
    kind: 'bossHealthy',
    target: 3,
    labelKey: 'contract.bossHealthy',
    healthAbove: 0.4,
  },
  { id: 'tower-5', kind: 'towerFloors', target: 5, labelKey: 'contract.towerFloors' },
  { id: 'remix-3', kind: 'remixWins', target: 3, labelKey: 'contract.remixWins' },
  ...(['slippery', 'fierce', 'mending'] as TraitId[]).map((trait) => ({
    id: `trait-${trait}`,
    kind: 'beatTrait' as const,
    target: 6,
    labelKey: 'contract.beatTrait' as MessageKey,
    trait,
  })),
]

export const CONTRACT_POOL = POOL.filter(
  (contract) => contract.trait === undefined || TRAIT_IDS.includes(contract.trait),
)

export const CONTRACT_BY_ID = new Map(CONTRACT_POOL.map((contract) => [contract.id, contract]))

export function contractWeek(now = Date.now()): number {
  return Math.max(0, Math.floor(now / WEEK_MS))
}

/**
 * The three contracts a week offers.
 *
 * Strided rather than sliced, so consecutive weeks do not simply shift the
 * window by three and re-offer two of last week's jobs. The stride is co-prime
 * with the pool size wherever possible, which spreads the repeats out instead
 * of clustering them.
 */
export function contractsForWeek(week: number): ContractConfig[] {
  const size = CONTRACT_POOL.length
  const stride = 1 + (week % Math.max(1, size - 1))
  const picked: ContractConfig[] = []
  let index = (week * 5) % size
  while (picked.length < Math.min(CONTRACTS_PER_WEEK, size)) {
    const candidate = CONTRACT_POOL[index % size]
    if (!picked.includes(candidate)) picked.push(candidate)
    index += stride
  }
  return picked
}

/** Gold and EXP a finished week pays. Flat: the week is a clock, not a ladder. */
export const CONTRACT_REWARD = { gold: 2400, exp: 3000 }

export const MS_PER_WEEK = WEEK_MS
