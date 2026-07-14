import Phaser from 'phaser'
import { GameState } from '../state/GameState'
import { applyRewards } from '../systems/rewards'
import { persist } from '../services/saveService'
import { makeButton } from '../ui/components/makeButton'
import { COLORS } from '../ui/styles'

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result')
  }

  create(): void {
    const { width } = this.scale
    const result = GameState.lastBattleResult!
    const stage = GameState.selectedStage!
    const prevLevel = GameState.player!.level

    let player = applyRewards(GameState.player!, result)
    if (result.win) {
      const nextUnlock = Math.max(player.stageProgress.highestUnlocked, stage.order + 1)
      const completedStageIds = player.stageProgress.completedStageIds.includes(stage.id)
        ? player.stageProgress.completedStageIds
        : [...player.stageProgress.completedStageIds, stage.id]
      player = { ...player, stageProgress: { highestUnlocked: nextUnlock, completedStageIds } }
    }
    GameState.player = player
    void persist(player, GameState.userId)

    this.add
      .text(width / 2, 60, result.win ? 'Victory!' : 'Defeat...', {
        fontSize: '28px',
        color: result.win ? COLORS.success : COLORS.danger,
      })
      .setOrigin(0.5)

    if (result.win) {
      this.add
        .text(width / 2, 110, `+${result.rewards.exp} EXP   +${result.rewards.gold} Gold`, {
          fontSize: '16px',
          color: COLORS.text,
        })
        .setOrigin(0.5)

      if (player.level > prevLevel) {
        this.add
          .text(width / 2, 150, `Level Up! Lv.${prevLevel} -> Lv.${player.level}`, {
            fontSize: '16px',
            color: COLORS.success,
          })
          .setOrigin(0.5)
      }
    } else {
      this.add
        .text(width / 2, 110, 'No rewards this time. Try leveling up first.', {
          fontSize: '14px',
          color: COLORS.textDim,
        })
        .setOrigin(0.5)
    }

    makeButton(this, width / 2, 220, 'Continue', () => this.scene.start('StageSelect'))
  }
}
