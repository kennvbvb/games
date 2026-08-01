import { STAGES, STAGES_PER_CHAPTER } from './stages'
import type { MessageKey } from '../i18n'
import type { PlayerState, StageConfig } from '../types'

export interface Chapter {
  id: string
  /** 1-based; also the page index used by stage select. */
  index: number
  nameKey: MessageKey
  icon: string
  stages: StageConfig[]
  /** The chapter's last stage, always a boss. */
  boss: StageConfig
}

const CHAPTER_META: { nameKey: MessageKey; icon: string }[] = [
  { nameKey: 'chapter.1', icon: 'decor_tree' },
  { nameKey: 'chapter.2', icon: 'decor_snowflake' },
  { nameKey: 'chapter.3', icon: 'decor_castle' },
]

/**
 * Chapters are a fixed slice of the stage list rather than their own content,
 * so adding a stage cannot leave a chapter half-defined — the grouping falls
 * out of STAGES_PER_CHAPTER.
 */
export const CHAPTERS: Chapter[] = CHAPTER_META.map((meta, i) => {
  const stages = STAGES.slice(i * STAGES_PER_CHAPTER, (i + 1) * STAGES_PER_CHAPTER)
  return {
    id: `chapter-${i + 1}`,
    index: i + 1,
    nameKey: meta.nameKey,
    icon: meta.icon,
    stages,
    boss: stages[stages.length - 1],
  }
})

export const BOSS_STAGE_IDS = CHAPTERS.map((chapter) => chapter.boss.id)

export function chapterOfStage(stage: StageConfig): Chapter {
  return CHAPTERS[Math.floor((stage.order - 1) / STAGES_PER_CHAPTER)]
}

/** How many of a chapter's stages the player has cleared. */
export function chapterCleared(state: PlayerState, chapter: Chapter): number {
  return chapter.stages.filter((stage) => state.stageProgress.completedStageIds.includes(stage.id)).length
}
