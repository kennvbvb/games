import type { PlayerState, StageConfig, BattleResult } from '../types'

class GameStateStore {
  player: PlayerState | null = null
  userId: string | null = null
  selectedStage: StageConfig | null = null
  lastBattleResult: BattleResult | null = null
}

export const GameState = new GameStateStore()
