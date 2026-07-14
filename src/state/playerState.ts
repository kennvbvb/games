import type { PlayerState } from '../types'
import { statsForLevel } from '../systems/leveling'

export function createDefaultPlayerState(name = 'Hero'): PlayerState {
  return {
    name,
    level: 1,
    exp: 0,
    gold: 0,
    stats: statsForLevel(1),
    stageProgress: { highestUnlocked: 1, completedStageIds: [] },
  }
}
