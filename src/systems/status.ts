import { RESOLUTION_ORDER, STATUSES, statusOf } from '../data/statuses'
import type { StatusConfig, StatusId } from '../data/statuses'

/**
 * One status riding on one side of a fight.
 *
 * Kept as plain data with no methods so the whole bag can be cloned, compared
 * and logged; the rules live in the functions below, which are pure.
 */
export interface StatusInstance {
  id: StatusId
  source: 'player' | 'enemy'
  stacks: number
  remainingTurns: number
  magnitude: number
}

export type StatusBag = StatusInstance[]

export interface StatusApplication {
  id: StatusId
  /** How long it lasts from the moment it lands. */
  turns: number
  /** Stacks added per application; clamped to the status's own maximum. */
  stacks?: number
  /** Overrides the status's default magnitude. */
  magnitude?: number
  /** Applied on every Nth attack by the inflicting side; 1 means every attack. */
  everyN?: number
}

/**
 * Adds a status, or refreshes one already running.
 *
 * Refreshing takes the *longer* of the two durations rather than replacing:
 * a second application should never be able to cut short the first, which is
 * what a naive overwrite does and what players read as the effect "falling off
 * early for no reason".
 */
export function applyStatus(
  bag: StatusBag,
  application: StatusApplication,
  source: 'player' | 'enemy',
): StatusBag {
  const config = statusOf(application.id)
  const add = Math.max(1, application.stacks ?? 1)
  const magnitude = application.magnitude ?? config.defaultMagnitude
  const existing = bag.find((s) => s.id === application.id)

  if (!existing) {
    return [
      ...bag,
      {
        id: application.id,
        source,
        stacks: Math.min(add, config.maxStacks),
        remainingTurns: application.turns,
        magnitude,
      },
    ]
  }

  return bag.map((s) =>
    s.id === application.id
      ? {
          ...s,
          stacks: Math.min(s.stacks + add, config.maxStacks),
          remainingTurns: Math.max(s.remainingTurns, application.turns),
          magnitude,
        }
      : s,
  )
}

export function hasStatus(bag: StatusBag, id: StatusId): boolean {
  return bag.some((s) => s.id === id && s.remainingTurns > 0)
}

export function stacksOf(bag: StatusBag, id: StatusId): number {
  return bag.find((s) => s.id === id)?.stacks ?? 0
}

/** Removes every harmful status; the beneficial ones are left alone. */
export function cleanse(bag: StatusBag): StatusBag {
  return bag.filter((s) => !statusOf(s.id).harmful)
}

export interface StatusTick {
  /** Damage the afflicted side takes this turn from everything running on it. */
  damage: number
  /** Health the afflicted side regains this turn. */
  heal: number
  /** True when a control status is stopping this side from acting. */
  skipsTurn: boolean
}

/**
 * Resolves everything a bag does at the start of its owner's turn.
 *
 * The order is fixed and spelled out in RESOLUTION_ORDER: damage first, so a
 * burn that would kill cannot be undone by a regen landing in the same instant;
 * healing second; control last, so a side frozen this turn has still taken its
 * burn tick — being frozen is not immunity.
 *
 * `hitsTaken` feeds the statuses that grow with how often their owner has been
 * struck, which is the only outside input the tick needs.
 */
export function tickStatuses(bag: StatusBag, maxHp: number, hitsTaken: number): StatusTick {
  let damage = 0
  let heal = 0
  let skipsTurn = false

  for (const kind of RESOLUTION_ORDER) {
    for (const instance of bag) {
      if (instance.remainingTurns <= 0) continue
      const config = statusOf(instance.id)
      if (config.kind !== kind) continue

      if (kind === 'damage-over-turn') {
        const scale = config.scalesWithHits ? Math.max(1, hitsTaken) : 1
        damage += Math.round(maxHp * instance.magnitude * instance.stacks * scale)
      } else if (kind === 'heal-over-turn') {
        heal += Math.round(maxHp * instance.magnitude * instance.stacks)
      } else if (kind === 'control') {
        skipsTurn = true
      }
    }
  }

  return { damage, heal, skipsTurn }
}

/** Product of every running 'scale' status that targets this quantity. */
function scaleFor(bag: StatusBag, target: NonNullable<StatusConfig['scales']>): number {
  let product = 1
  for (const instance of bag) {
    if (instance.remainingTurns <= 0) continue
    const config = statusOf(instance.id)
    if (config.kind !== 'scale' || config.scales !== target) continue
    // Stacks compound rather than add, matching how every other multiplier in
    // the game composes; see systems/combatModifiers.
    product *= instance.magnitude ** instance.stacks
  }
  return product
}

/** Multiplier on the attack of a side carrying these statuses. */
export function attackScale(bag: StatusBag): number {
  return scaleFor(bag, 'atk')
}

/** Multiplier on the defence of a side carrying these statuses. */
export function defenceScale(bag: StatusBag): number {
  return scaleFor(bag, 'def')
}

/** Multiplier on healing a side carrying these statuses receives. */
export function healingScale(bag: StatusBag): number {
  return scaleFor(bag, 'healing')
}

/**
 * Fraction of an incoming blow sent back at the attacker. Reflect is a benefit,
 * so its magnitude reads as "how much comes back" and stacks add rather than
 * compounding towards zero the way the penalties do.
 */
export function reflectFraction(bag: StatusBag): number {
  let total = 0
  for (const instance of bag) {
    if (instance.remainingTurns <= 0) continue
    const config = statusOf(instance.id)
    if (config.kind === 'scale' && config.scales === 'reflect') {
      total += instance.magnitude * instance.stacks
    }
  }
  return Math.min(total, 1)
}

/** Counts one turn down and drops anything that has run out. */
export function decayStatuses(bag: StatusBag): StatusBag {
  return bag
    .map((s) => ({ ...s, remainingTurns: s.remainingTurns - 1 }))
    .filter((s) => s.remainingTurns > 0)
}

/** Everything still running, for the battle UI and the lab. */
export function activeStatuses(bag: StatusBag): StatusInstance[] {
  return bag.filter((s) => s.remainingTurns > 0)
}

export { STATUSES }
