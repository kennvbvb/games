import type { PlayerState, StageConfig, BattleResult } from '../types'

class GameStateStore {
  player: PlayerState | null = null
  userId: string | null = null
  selectedStage: StageConfig | null = null
  lastBattleResult: BattleResult | null = null
  /** Remembered stage-select page so post-battle flow returns where the player was. */
  stagePage = 0
}

export const GameState = new GameStateStore()
