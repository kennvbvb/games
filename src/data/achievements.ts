import { STAGES } from './stages'
import { BOSS_STAGE_IDS } from './worlds'
import type { MessageKey } from '../i18n'
import type { PlayerState } from '../types'

export interface Achievement {
  id: string
  nameKey: MessageKey
  icon: string
  /** Gold paid out once, when the player claims it. */
  reward: number
  target: number
  /**
   * Current progress. Derived from state wherever possible so nothing extra
   * has to be tracked or kept in sync.
   */
  progress: (state: PlayerState) => number
}

const treatsBought = (s: PlayerState) => s.upgrades.hp + s.upgrades.atk + s.upgrades.def

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-steps',
    nameKey: 'achv.firstSteps',
    icon: 'icon_star',
    reward: 50,
    target: 1,
    progress: (s) => s.stageProgress.completedStageIds.length,
  },
  {
    id: 'trailblazer',
    nameKey: 'achv.trailblazer',
    icon: 'icon_atk',
    reward: 150,
    target: 5,
    progress: (s) => s.stageProgress.completedStageIds.length,
  },
  {
    id: 'champion',
    nameKey: 'achv.champion',
    icon: 'icon_victory',
    reward: 500,
    target: STAGES.length,
    progress: (s) => s.stageProgress.completedStageIds.length,
  },
  { id: 'growing', nameKey: 'achv.growing', icon: 'icon_levelup', reward: 60, target: 5, progress: (s) => s.level },
  { id: 'seasoned', nameKey: 'achv.seasoned', icon: 'icon_levelup', reward: 200, target: 10, progress: (s) => s.level },
  { id: 'veteran', nameKey: 'achv.veteran', icon: 'icon_levelup', reward: 600, target: 20, progress: (s) => s.level },
  {
    id: 'equipped',
    nameKey: 'achv.equipped',
    icon: 'icon_bag',
    reward: 80,
    target: 3,
    progress: (s) => s.ownedItemIds.length,
  },
  {
    id: 'collector',
    nameKey: 'achv.collector',
    icon: 'icon_bag',
    reward: 300,
    target: 10,
    progress: (s) => s.ownedItemIds.length,
  },
  { id: 'sweet-tooth', nameKey: 'achv.sweetTooth', icon: 'icon_candy', reward: 120, target: 10, progress: treatsBought },
  {
    id: 'battle-hardened',
    nameKey: 'achv.battleHardened',
    icon: 'icon_hit',
    reward: 100,
    target: 25,
    progress: (s) => s.lifetime.battlesWon,
  },
  {
    id: 'relentless',
    nameKey: 'achv.relentless',
    icon: 'icon_hit',
    reward: 400,
    target: 100,
    progress: (s) => s.lifetime.battlesWon,
  },
  {
    id: 'boss-slayer',
    nameKey: 'achv.bossSlayer',
    icon: 'decor_skull',
    reward: 450,
    target: BOSS_STAGE_IDS.length,
    progress: (s) => s.stageProgress.completedStageIds.filter((id) => BOSS_STAGE_IDS.includes(id)).length,
  },
  {
    id: 'wealthy',
    nameKey: 'achv.wealthy',
    icon: 'icon_gold',
    reward: 350,
    target: 5000,
    progress: (s) => s.lifetime.goldEarned,
  },
]

export const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]))
