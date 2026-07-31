import type { PlayerState, StageConfig, BattleResult } from '../types'

class GameStateStore {
  player: PlayerState | null = null
  userId: string | null = null
  selectedStage: StageConfig | null = null
  lastBattleResult: BattleResult | null = null
  /** Remembered stage-select page so post-battle flow returns where the player was. */
  stagePage = 0
  /** Remaining queued auto-battles; 0 means the loop is idle. */
  autoRunsRemaining = 0
  /** Battles completed in the current auto-battle streak, for display. */
  autoRunCount = 0

  stopAutoBattle(): void {
    this.autoRunsRemaining = 0
    this.autoRunCount = 0
  }
}

export const GameState = new GameStateStore()
