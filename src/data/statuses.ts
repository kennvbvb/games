import type { MessageKey } from '../i18n'

/**
 * Lasting effects a fight can put on either side.
 *
 * Every one is a pure function of the state it is given — a stack count, a
 * remaining duration and a magnitude — so a fight carrying statuses is exactly
 * as deterministic as one without, and the stage preview stays an exact
 * simulation rather than becoming an estimate.
 *
 * Shield is deliberately *not* here: it is a resource with a running total, not
 * something that expires, and it already lives on the combat state.
 */
export const STATUS_IDS = [
  'burn',
  'poison',
  'bleed',
  'freeze',
  'weaken',
  'armor-break',
  'curse',
  'regen',
  'reflect',
] as const

export type StatusId = (typeof STATUS_IDS)[number]

/**
 * How a status is read during a turn. The engine branches on this rather than
 * on the id, so adding a status is a data change.
 */
export type StatusKind =
  /** Damage at the start of the afflicted side's turn, scaled by stacks. */
  | 'damage-over-turn'
  /** Healing at the start of the afflicted side's turn. */
  | 'heal-over-turn'
  /** Skips the afflicted side's attack entirely while it lasts. */
  | 'control'
  /** Multiplies a stat or an effect while it lasts. */
  | 'scale'

export interface StatusConfig {
  id: StatusId
  nameKey: MessageKey
  descriptionKey: MessageKey
  icon: string
  kind: StatusKind
  /** True for anything the afflicted side would rather not have. */
  harmful: boolean
  /** Stacks beyond this are dropped; 1 means the status does not stack. */
  maxStacks: number
  /**
   * What the magnitude means, by kind:
   *  - damage/heal over turn: fraction of the afflicted side's Max HP per stack
   *  - scale: the multiplier applied to `scales`
   *  - control: unused
   */
  defaultMagnitude: number
  /** Which quantity a 'scale' status multiplies. */
  scales?: 'atk' | 'def' | 'healing' | 'reflect'
  /**
   * Bleed grows with how often the afflicted side has been hit, so its damage
   * is multiplied by the attack count rather than being flat. Kept as a flag
   * rather than a special case in the engine's damage branch.
   */
  scalesWithHits?: true
}

export const STATUSES: StatusConfig[] = [
  {
    id: 'burn',
    nameKey: 'status.burn',
    descriptionKey: 'status.burnHint',
    icon: 'decor_fire',
    kind: 'damage-over-turn',
    harmful: true,
    maxStacks: 5,
    defaultMagnitude: 0.03,
  },
  {
    id: 'poison',
    nameKey: 'status.poison',
    descriptionKey: 'status.poisonHint',
    icon: 'decor_droplet',
    kind: 'damage-over-turn',
    harmful: true,
    maxStacks: 8,
    defaultMagnitude: 0.02,
  },
  {
    id: 'bleed',
    nameKey: 'status.bleed',
    descriptionKey: 'status.bleedHint',
    icon: 'decor_gem',
    kind: 'damage-over-turn',
    harmful: true,
    maxStacks: 4,
    defaultMagnitude: 0.008,
    scalesWithHits: true,
  },
  {
    id: 'freeze',
    nameKey: 'status.freeze',
    descriptionKey: 'status.freezeHint',
    icon: 'decor_snowflake',
    kind: 'control',
    harmful: true,
    maxStacks: 1,
    defaultMagnitude: 0,
  },
  {
    id: 'weaken',
    nameKey: 'status.weaken',
    descriptionKey: 'status.weakenHint',
    icon: 'decor_fog',
    kind: 'scale',
    harmful: true,
    maxStacks: 3,
    defaultMagnitude: 0.88,
    scales: 'atk',
  },
  {
    id: 'armor-break',
    nameKey: 'status.armorBreak',
    descriptionKey: 'status.armorBreakHint',
    icon: 'decor_rock',
    kind: 'scale',
    harmful: true,
    maxStacks: 3,
    defaultMagnitude: 0.82,
    scales: 'def',
  },
  {
    id: 'curse',
    nameKey: 'status.curse',
    descriptionKey: 'status.curseHint',
    icon: 'decor_skull',
    kind: 'scale',
    harmful: true,
    maxStacks: 2,
    defaultMagnitude: 0.5,
    scales: 'healing',
  },
  {
    id: 'regen',
    nameKey: 'status.regen',
    descriptionKey: 'status.regenHint',
    icon: 'decor_herb',
    kind: 'heal-over-turn',
    harmful: false,
    maxStacks: 3,
    defaultMagnitude: 0.03,
  },
  {
    id: 'reflect',
    nameKey: 'status.reflect',
    descriptionKey: 'status.reflectHint',
    icon: 'icon_clash',
    kind: 'scale',
    harmful: false,
    maxStacks: 2,
    defaultMagnitude: 0.25,
    scales: 'reflect',
  },
]

export const STATUS_BY_ID = new Map(STATUSES.map((status) => [status.id, status]))

export function statusOf(id: StatusId): StatusConfig {
  return STATUS_BY_ID.get(id)!
}

export function normalizeStatus(value: unknown): StatusId | null {
  if (typeof value !== 'string') return null
  return (STATUS_IDS as readonly string[]).includes(value) ? (value as StatusId) : null
}

/**
 * The order statuses are resolved in, and the reason it is fixed.
 *
 * Damage before healing, so a burn that would kill cannot be undone by a regen
 * that lands in the same instant. Control after both, so a side frozen this
 * turn still took its burn tick — being frozen is not immunity. Scales are read
 * at the moment they are used rather than resolved here, because attack and
 * defence are only meaningful against a specific blow.
 *
 * Written out rather than implied by array order so a test can assert it.
 */
export const RESOLUTION_ORDER: StatusKind[] = ['damage-over-turn', 'heal-over-turn', 'control']
