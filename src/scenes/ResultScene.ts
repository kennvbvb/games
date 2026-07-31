import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { GameState } from '../state/GameState'
import { applyRewards } from '../systems/rewards'
import { persist } from '../services/saveService'
import { makeButton } from '../ui/components/makeButton'
import { makePanel } from '../ui/components/makePanel'
import { makeEmoji } from '../ui/components/makeEmoji'
import { makeStatRow } from '../ui/components/makeStatRow'
import { drawStageScenery } from '../ui/scenery'
import { COLORS, FONT } from '../ui/styles'

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result')
  }

  create(): void {
    setupScene(this)
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

    drawStageScenery(this, stage.bg, stage.order, { horizon: 470 })

    const banner = makeEmoji(this, GAME_W / 2, 128, result.win ? 'icon_victory' : 'icon_defeat', 84)
    this.tweens.add({ targets: banner, scale: { from: banner.scale * 0.4, to: banner.scale }, duration: 400, ease: 'Back.Out' })

    makePanel(this, GAME_W / 2, 218, 300, 56)
    this.add
      .text(GAME_W / 2, 218, result.win ? 'Victory!' : 'Defeat...', {
        fontSize: '32px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: result.win ? COLORS.success : COLORS.danger,
      })
      .setOrigin(0.5)

    makePanel(this, GAME_W / 2, 316, 360, 110)
    if (result.win) {
      makeStatRow(
        this,
        GAME_W / 2 - 96,
        296,
        [
          { icon: 'icon_exp', value: `+${result.rewards.exp} EXP` },
          { icon: 'icon_gold', value: `+${result.rewards.gold}` },
        ],
        { fontSize: '17px', iconSize: 19, gap: 22 },
      )

      if (player.level > prevLevel) {
        const levelUp = this.add
          .text(GAME_W / 2 + 12, 338, `Level Up!  Lv ${prevLevel} → Lv ${player.level}`, {
            fontSize: '16px',
            fontFamily: FONT.family,
            fontStyle: 'bold',
            color: COLORS.success,
          })
          .setOrigin(0.5)
        makeEmoji(this, levelUp.x - levelUp.width / 2 - 12, 338, 'icon_levelup', 18)
        this.tweens.add({ targets: levelUp, scale: { from: 1, to: 1.08 }, duration: 500, yoyo: true, repeat: -1 })
      } else {
        this.add
          .text(GAME_W / 2, 338, 'The next stage is waiting for you!', {
            fontSize: '14px',
            fontFamily: FONT.family,
            color: COLORS.textDim,
          })
          .setOrigin(0.5)
      }
    } else {
      this.add
        .text(GAME_W / 2, 316, 'No rewards this time...\nLevel up or buy some gear first!', {
          fontSize: '14px',
          fontFamily: FONT.family,
          color: COLORS.textDim,
          align: 'center',
        })
        .setOrigin(0.5)
    }

    makeButton(this, GAME_W / 2, 424, 'Continue', () => this.scene.start('StageSelect'), { minWidth: 200 })
    if (!result.win) {
      makeButton(this, GAME_W / 2, 488, 'Shop', () => this.scene.start('Shop'), {
        variant: 'secondary',
        fontSize: '14px',
        icon: 'icon_cart',
      })
    }
  }
}
