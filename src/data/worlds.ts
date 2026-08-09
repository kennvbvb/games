import { STAGES, STAGES_PER_WORLD } from './stages'
import type { MessageKey } from '../i18n'
import type { PlayerState, StageConfig } from '../types'

export interface World {
  id: string
  /** 1-based; also the page index used by stage select. */
  index: number
  nameKey: MessageKey
  icon: string
  stages: StageConfig[]
  /** The world's last stage, always a boss. */
  boss: StageConfig
}

const WORLD_META: { nameKey: MessageKey; icon: string }[] = [
  { nameKey: 'world.1', icon: 'decor_tree' },
  { nameKey: 'world.2', icon: 'decor_mountain' },
  { nameKey: 'world.3', icon: 'decor_skull' },
  { nameKey: 'world.4', icon: 'decor_galaxy' },
  { nameKey: 'world.5', icon: 'decor_orb' },
  { nameKey: 'world.6', icon: 'decor_gear' },
  { nameKey: 'world.7', icon: 'decor_sun' },
  { nameKey: 'world.8', icon: 'decor_mushroom' },
  { nameKey: 'world.9', icon: 'decor_sakura' },
  { nameKey: 'world.10', icon: 'decor_snowflake' },
  { nameKey: 'world.11', icon: 'decor_portal' },
  { nameKey: 'world.12', icon: 'decor_feather' },
  { nameKey: 'world.13', icon: 'decor_shell' },
  { nameKey: 'world.14', icon: 'decor_flower' },
  { nameKey: 'world.15', icon: 'decor_moon' },
  { nameKey: 'world.16', icon: 'decor_fire' },
  { nameKey: 'world.17', icon: 'decor_comet' },
  { nameKey: 'world.18', icon: 'decor_orb' },
  { nameKey: 'world.19', icon: 'decor_clock' },
  { nameKey: 'world.20', icon: 'decor_sun' },
]

/**
 * Worlds are a fixed slice of the stage list rather than their own content, so
 * adding a stage cannot leave a world half-defined — the grouping falls out of
 * STAGES_PER_WORLD, and a test pins the arithmetic.
 */
export const WORLDS: World[] = WORLD_META.map((meta, i) => {
  const stages = STAGES.slice(i * STAGES_PER_WORLD, (i + 1) * STAGES_PER_WORLD)
  return {
    id: `world-${i + 1}`,
    index: i + 1,
    nameKey: meta.nameKey,
    icon: meta.icon,
    stages,
    boss: stages[stages.length - 1],
  }
})

export const BOSS_STAGE_IDS = WORLDS.map((world) => world.boss.id)

export function worldOfStage(stage: StageConfig): World {
  return WORLDS[Math.floor((stage.order - 1) / STAGES_PER_WORLD)]
}

/** How many of a world's stages the player has cleared. */
export function worldCleared(state: PlayerState, world: World): number {
  return world.stages.filter((stage) => state.stageProgress.completedStageIds.includes(stage.id)).length
}

/**
 * The page to open on: where the player actually is, not where they started.
 * With twenty worlds, defaulting to the first would mean up to nineteen taps
 * before reaching the next fight.
 */
export function worldPageFor(state: PlayerState): number {
  const highest = Math.min(Math.max(state.stageProgress.highestUnlocked, 1), STAGES.length)
  return Math.floor((highest - 1) / STAGES_PER_WORLD)
}
