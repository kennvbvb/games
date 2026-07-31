import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { STAGES } from '../data/stages'
import { GameState } from '../state/GameState'
import { applyRewards } from '../systems/rewards'
import { persist } from '../services/saveService'
import { makeButton } from '../ui/components/makeButton'
import { makePanel } from '../ui/components/makePanel'
import { makeEmoji } from '../ui/components/makeEmoji'
import { makeStatRow } from '../ui/components/makeStatRow'
import { drawStageScenery } from '../ui/scenery'
import { COLORS, FONT } from '../ui/styles'
import type { PlayerState, StageConfig } from '../types'

/** How long the result screen lingers before the next queued auto-battle. */
const AUTO_ADVANCE_MS = 900

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
      player = {
        ...player,
        stageProgress: { highestUnlocked: Math.min(nextUnlock, STAGES.length), completedStageIds },
        // Farming this stage is what the hero keeps doing while away.
        idle: { ...player.idle, farmingStageId: stage.id },
      }
    }
    GameState.player = player
    void persist(player, GameState.userId).then((stamped) => {
      GameState.player = stamped
    })

    // A loss always breaks the auto-battle loop — that is the stop condition.
    if (!result.win) GameState.stopAutoBattle()

    const nextStage = STAGES.find((s) => s.order === stage.order + 1) ?? null
    const nextUnlocked = nextStage !== null && nextStage.order <= player.stageProgress.highestUnlocked

    drawStageScenery(this, stage.bg, stage.order, { horizon: 470 })
    this.renderOutcome(result.win, player, prevLevel)

    if (GameState.autoRunsRemaining > 0) {
      this.runAutoBattle(player, stage, nextStage, nextUnlocked)
      return
    }
    this.renderActions(result.win, stage, nextStage, nextUnlocked)
  }

  private renderOutcome(win: boolean, player: PlayerState, prevLevel: number): void {
    const result = GameState.lastBattleResult!
    const banner = makeEmoji(this, GAME_W / 2, 120, win ? 'icon_victory' : 'icon_defeat', 76)
    this.tweens.add({
      targets: banner,
      scale: { from: banner.scale * 0.4, to: banner.scale },
      duration: 400,
      ease: 'Back.Out',
    })

    makePanel(this, GAME_W / 2, 202, 300, 54)
    this.add
      .text(GAME_W / 2, 202, win ? 'Victory!' : 'Defeat...', {
        fontSize: '30px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: win ? COLORS.success : COLORS.danger,
      })
      .setOrigin(0.5)

    makePanel(this, GAME_W / 2, 292, 360, 104)
    if (win) {
      makeStatRow(
        this,
        GAME_W / 2 - 96,
        274,
        [
          { icon: 'icon_exp', value: `+${result.rewards.exp} EXP` },
          { icon: 'icon_gold', value: `+${result.rewards.gold}` },
        ],
        { fontSize: '17px', iconSize: 19, gap: 22 },
      )
      if (player.level > prevLevel) {
        const levelUp = this.add
          .text(GAME_W / 2 + 12, 314, `Level Up!  Lv ${prevLevel} → Lv ${player.level}`, {
            fontSize: '16px',
            fontFamily: FONT.family,
            fontStyle: 'bold',
            color: COLORS.success,
          })
          .setOrigin(0.5)
        makeEmoji(this, levelUp.x - levelUp.width / 2 - 12, 314, 'icon_levelup', 18)
        this.tweens.add({ targets: levelUp, scale: { from: 1, to: 1.08 }, duration: 500, yoyo: true, repeat: -1 })
      } else {
        this.add
          .text(GAME_W / 2, 314, 'The next stage is waiting for you!', {
            fontSize: '14px',
            fontFamily: FONT.family,
            color: COLORS.textDim,
          })
          .setOrigin(0.5)
      }
    } else {
      this.add
        .text(GAME_W / 2, 292, 'No rewards this time...\nLevel up or buy some gear first!', {
          fontSize: '14px',
          fontFamily: FONT.family,
          color: COLORS.textDim,
          align: 'center',
        })
        .setOrigin(0.5)
    }
  }

  /** Chains straight into the next queued battle so farming needs no input. */
  private runAutoBattle(
    player: PlayerState,
    stage: StageConfig,
    nextStage: StageConfig | null,
    nextUnlocked: boolean,
  ): void {
    GameState.autoRunsRemaining -= 1
    GameState.autoRunCount += 1

    const advancing = player.settings.autoAdvance && nextStage !== null && nextUnlocked
    const target = advancing ? nextStage : stage

    this.add
      .text(GAME_W / 2, 376, `Auto-battle · ${GameState.autoRunsRemaining} run(s) left`, {
        fontSize: '13px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)

    makeButton(
      this,
      GAME_W / 2,
      430,
      'Stop auto-battle',
      () => {
        GameState.stopAutoBattle()
        this.scene.restart()
      },
      { variant: 'secondary', minWidth: 220, fontSize: '15px' },
    )

    this.time.delayedCall(AUTO_ADVANCE_MS / player.settings.battleSpeed, () => {
      if (GameState.autoRunsRemaining <= 0) return
      GameState.selectedStage = target
      this.scene.start('Battle')
    })
  }

  private renderActions(
    win: boolean,
    stage: StageConfig,
    nextStage: StageConfig | null,
    nextUnlocked: boolean,
  ): void {
    const startRun = (target: StageConfig, runs: number) => {
      GameState.selectedStage = target
      GameState.autoRunsRemaining = runs
      GameState.autoRunCount = 0
      this.scene.start('Battle')
    }

    if (win && nextStage && nextUnlocked) {
      makeButton(this, GAME_W / 2, 384, `Next: ${nextStage.name}`, () => startRun(nextStage, 0), {
        minWidth: 280,
        icon: 'icon_atk',
        fontSize: '16px',
      })
      makeButton(this, GAME_W / 2, 452, 'Farm this stage ×10', () => startRun(stage, 10), {
        variant: 'secondary',
        minWidth: 280,
        fontSize: '15px',
      })
    } else if (win) {
      // Final stage cleared, or the next one is still locked.
      makeButton(this, GAME_W / 2, 384, 'Farm this stage ×10', () => startRun(stage, 10), {
        minWidth: 280,
        fontSize: '16px',
      })
      makeButton(this, GAME_W / 2, 452, 'Retry', () => startRun(stage, 0), {
        variant: 'secondary',
        minWidth: 280,
        fontSize: '15px',
      })
    } else {
      makeButton(this, GAME_W / 2, 384, 'Retry', () => startRun(stage, 0), { minWidth: 280, fontSize: '16px' })
      makeButton(this, GAME_W / 2, 452, 'Shop', () => this.scene.start('Shop'), {
        variant: 'secondary',
        minWidth: 280,
        fontSize: '15px',
        icon: 'icon_cart',
      })
    }

    makeButton(this, GAME_W / 2, 528, 'Stage select', () => this.scene.start('StageSelect'), {
      variant: 'secondary',
      minWidth: 200,
      fontSize: '14px',
    })
  }
}
