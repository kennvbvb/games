import type { PlayerState, StageConfig, BattleResult } from '../types'
import type { PlanId } from '../data/battlePlans'
import type { AdminTestState } from '../admin/AdminTestState'
import type { AdminGrant } from '../admin/AdminAccess'

class GameStateStore {
  player: PlayerState | null = null
  userId: string | null = null
  selectedStage: StageConfig | null = null
  lastBattleResult: BattleResult | null = null
  /**
   * Remembered stage-select page, so the post-battle flow returns where the
   * player was. -1 means "not chosen yet", which stage select reads as "open
   * the world I am actually up to".
   */
  stagePage = -1
  /**
   * The plan chosen for the next fight. Null falls back to the saved default,
   * which is what lets an auto-battle streak skip the plan picker entirely.
   */
  selectedPlan: PlanId | null = null
  /** Remaining queued auto-battles; 0 means the loop is idle. */
  autoRunsRemaining = 0
  /** Battles completed in the current auto-battle streak, for display. */
  autoRunCount = 0

  /**
   * Whether the Test Lab may be opened, resolved once after auth. Never
   * consulted for anything except showing the entry point — see AdminAccess for
   * why that is not the security boundary.
   */
  adminGrant: AdminGrant = { kind: 'none' }
  /**
   * The lab's scratch copy. Deliberately parallel to `player` rather than
   * replacing it: the live save stays untouched and reachable the whole time
   * the lab is open, so leaving is just dropping this reference.
   */
  adminTest: AdminTestState | null = null

  stopAutoBattle(): void {
    this.autoRunsRemaining = 0
    this.autoRunCount = 0
  }
}

export const GameState = new GameStateStore()
