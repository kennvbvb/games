import { ITEMS } from '../data/items'
import { STAGES, STAGES_PER_WORLD } from '../data/stages'
import { statsForLevel } from '../systems/leveling'
import { bestOwnedPerSlot } from '../systems/upgrades'
import type { PlayerState } from '../types'

/**
 * Named starting points for the Test Lab.
 *
 * Every preset is expressed relative to the campaign rather than in absolute
 * numbers — "two thirds of the way through", not "stage 40" — so extending the
 * campaign moves them along with it instead of quietly turning "Late Game" into
 * a mid-game build.
 */
export interface AdminPreset {
  id: string
  label: string
  description: string
  apply(base: PlayerState): PlayerState
}

/** Unlocks up to `order` and marks everything before it cleared. */
function progressTo(order: number): PlayerState['stageProgress'] {
  const target = Math.min(Math.max(Math.round(order), 1), STAGES.length)
  return {
    highestUnlocked: target,
    completedStageIds: STAGES.slice(0, target - 1).map((stage) => stage.id),
  }
}

/** Everything the shop would sell at this level, worn best-per-slot. */
function gearFor(level: number): Pick<PlayerState, 'ownedItemIds' | 'equipped'> {
  const owned = ITEMS.filter((item) => (item.minLevel ?? 1) <= level).map((item) => item.id)
  return { ownedItemIds: owned, equipped: bestOwnedPerSlot(owned) }
}

function at(
  base: PlayerState,
  level: number,
  order: number,
  extra: Partial<PlayerState> = {},
): PlayerState {
  return {
    ...base,
    level,
    exp: 0,
    stats: statsForLevel(level, base.raceId),
    stageProgress: progressTo(order),
    ...gearFor(level),
    ...extra,
  }
}

/** Fraction of the way through the campaign, as a stage order. */
function stageAt(fraction: number): number {
  return Math.max(1, Math.round(STAGES.length * fraction))
}

/**
 * Level roughly appropriate for a stage, taken from the shape of the campaign
 * rather than a table: a linear read across the level band the balance pass
 * targets. Presets only need to land in the right neighbourhood — the Battle
 * Simulator is what produces exact numbers.
 */
function levelFor(order: number): number {
  return Math.max(1, Math.round(1 + (order / STAGES.length) * 29))
}

export const ADMIN_PRESETS: AdminPreset[] = [
  {
    id: 'new-player',
    label: 'New Player',
    description: 'Level 1, no gear, stage 1',
    apply: (base) => at(base, 1, 1, { gold: 0, upgrades: { hp: 0, atk: 0, def: 0 } }),
  },
  {
    id: 'early-game',
    label: 'Early Game',
    description: 'End of the first worlds',
    apply: (base) => at(base, levelFor(stageAt(0.15)), stageAt(0.15), { gold: 400 }),
  },
  {
    id: 'mid-game',
    label: 'Mid Game',
    description: 'Halfway, geared for its level',
    apply: (base) =>
      at(base, levelFor(stageAt(0.5)), stageAt(0.5), { gold: 2500, upgrades: { hp: 6, atk: 6, def: 4 } }),
  },
  {
    id: 'late-game',
    label: 'Late Game',
    description: 'Final worlds, full shop',
    apply: (base) =>
      at(base, levelFor(stageAt(0.85)), stageAt(0.85), {
        gold: 9000,
        upgrades: { hp: 14, atk: 14, def: 10 },
      }),
  },
  {
    id: 'endgame-ready',
    label: `Stage ${STAGES.length} Ready`,
    description: 'Everything unlocked, built to clear the last boss',
    apply: (base) =>
      at(base, levelFor(STAGES.length) + 4, STAGES.length, {
        gold: 20000,
        upgrades: { hp: 22, atk: 22, def: 16 },
      }),
  },
  {
    id: 'underpowered',
    label: 'Underpowered',
    description: 'Late stages unlocked, early-game power',
    apply: (base) => ({
      ...at(base, Math.max(1, levelFor(stageAt(0.85)) - 10), stageAt(0.85)),
      // Deliberately not `gearFor` — the point of this preset is a player who
      // rushed unlocks without the build to back them up.
      ...gearFor(1),
      gold: 0,
      upgrades: { hp: 0, atk: 0, def: 0 },
    }),
  },
  {
    id: 'glass-cannon',
    label: 'Glass Cannon',
    description: 'All attack, nothing behind it',
    apply: (base) =>
      at(base, levelFor(stageAt(0.5)), stageAt(0.5), {
        gold: 0,
        upgrades: { hp: 0, atk: 30, def: 0 },
      }),
  },
  {
    id: 'tank',
    label: 'Tank',
    description: 'All health and armour, no damage',
    apply: (base) =>
      at(base, levelFor(stageAt(0.5)), stageAt(0.5), {
        gold: 0,
        upgrades: { hp: 30, atk: 0, def: 20 },
      }),
  },
  {
    id: 'world-start',
    label: 'World Start',
    description: 'First stage of the last world, nothing cleared in it',
    apply: (base) => {
      const order = STAGES.length - STAGES_PER_WORLD + 1
      return at(base, levelFor(order), order, { gold: 6000 })
    },
  },
]

export const PRESET_BY_ID = new Map(ADMIN_PRESETS.map((preset) => [preset.id, preset]))
