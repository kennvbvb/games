import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { GameState } from '../state/GameState'
import { applyRewards } from '../systems/rewards'
import { persist } from '../services/saveService'
import { makeButton } from '../ui/components/makeButton'
import { makePanel } from '../ui/components/makePanel'
import { COLORS, FONT } from '../ui/styles'

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result')
  }

  create(): void {
    setupScene(this)
    const width = GAME_W
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

    const banner = this.add
      .text(width / 2, 130, result.win ? '🎉' : '😿', { fontSize: '72px' })
      .setOrigin(0.5)
    this.tweens.add({ targets: banner, scale: { from: 0.4, to: 1 }, duration: 400, ease: 'Back.Out' })

    this.add
      .text(width / 2, 210, result.win ? 'Victory!' : 'Defeat...', {
        fontSize: '32px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: result.win ? COLORS.success : COLORS.danger,
      })
      .setOrigin(0.5)

    makePanel(this, width / 2, 310, 360, 110)
    if (result.win) {
      this.add
        .text(width / 2, 290, `✨ +${result.rewards.exp} EXP    🪙 +${result.rewards.gold} gold`, {
          fontSize: '17px',
          fontFamily: FONT.family,
          color: COLORS.text,
        })
        .setOrigin(0.5)
      if (player.level > prevLevel) {
        const levelUp = this.add
          .text(width / 2, 330, `🌟 Level Up!  Lv ${prevLevel} → Lv ${player.level} 🌟`, {
            fontSize: '17px',
            fontFamily: FONT.family,
            fontStyle: 'bold',
            color: COLORS.success,
          })
          .setOrigin(0.5)
        this.tweens.add({ targets: levelUp, scale: { from: 1, to: 1.1 }, duration: 500, yoyo: true, repeat: -1 })
      } else {
        this.add
          .text(width / 2, 330, 'The next stage is waiting for you!', {
            fontSize: '14px',
            fontFamily: FONT.family,
            color: COLORS.textDim,
          })
          .setOrigin(0.5)
      }
    } else {
      this.add
        .text(width / 2, 300, 'No rewards this time...\nLevel up or buy some treats first! 🍪', {
          fontSize: '14px',
          fontFamily: FONT.family,
          color: COLORS.textDim,
          align: 'center',
        })
        .setOrigin(0.5)
    }

    makeButton(this, width / 2, 430, 'Continue', () => this.scene.start('StageSelect'), { minWidth: 200 })
    if (!result.win) {
      makeButton(this, width / 2, 494, '🛒 Shop', () => this.scene.start('Shop'), { variant: 'secondary', fontSize: '14px' })
    }
  }
}
