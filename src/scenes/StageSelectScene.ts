import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { STAGES } from '../data/stages'
import { GameState } from '../state/GameState'
import { difficultyLabel, stageOutlook } from '../systems/difficulty'
import { makeButton } from '../ui/components/makeButton'
import { makePanel } from '../ui/components/makePanel'
import { makeEmoji } from '../ui/components/makeEmoji'
import { makeStatRow } from '../ui/components/makeStatRow'
import { makeTitle } from '../ui/components/makeTitle'
import { COLORS, FONT } from '../ui/styles'
import type { DifficultyTier } from '../systems/difficulty'
import type { StageConfig } from '../types'

const STAGES_PER_PAGE = 4
const ROW_YS = [136, 234, 332, 430]

const TIER_COLOR: Record<DifficultyTier, string> = {
  easy: COLORS.success,
  fair: COLORS.gold,
  hard: COLORS.danger,
}

export class StageSelectScene extends Phaser.Scene {
  constructor() {
    super('StageSelect')
  }

  create(): void {
    setupScene(this)
    const pageCount = Math.ceil(STAGES.length / STAGES_PER_PAGE)
    const page = Math.min(Math.max(GameState.stagePage, 0), pageCount - 1)
    GameState.stagePage = page

    makeTitle(this, 46, 'Select Stage', 'icon_atk')

    STAGES.slice(page * STAGES_PER_PAGE, (page + 1) * STAGES_PER_PAGE).forEach((stage, i) => {
      this.renderStageCard(stage, ROW_YS[i])
    })

    const pagerY = 508
    makeButton(this, GAME_W / 2 - 110, pagerY, '◀', () => this.turnPage(-1), {
      disabled: page === 0,
      fontSize: '16px',
      minWidth: 64,
    })
    this.add
      .text(GAME_W / 2, pagerY, `Page ${page + 1} / ${pageCount}`, {
        fontSize: '15px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)
    makeButton(this, GAME_W / 2 + 110, pagerY, '▶', () => this.turnPage(1), {
      disabled: page >= pageCount - 1,
      fontSize: '16px',
      minWidth: 64,
    })

    makeButton(this, GAME_W / 2, 588, 'Back', () => this.scene.start('MainMenu'), {
      variant: 'secondary',
      fontSize: '15px',
      minWidth: 160,
    })
  }

  /**
   * One stage card: enemy, rewards, and an honest difficulty read. Because
   * combat is deterministic the outlook is an exact simulation of the fight
   * the player would get, not an estimate.
   */
  private renderStageCard(stage: StageConfig, y: number): void {
    const player = GameState.player!
    const unlocked = stage.order <= player.stageProgress.highestUnlocked
    const cleared = player.stageProgress.completedStageIds.includes(stage.id)

    makePanel(this, GAME_W / 2, y, 430, 88)
    makeEmoji(this, 60, y - 8, unlocked ? stage.enemy.sprite : 'icon_lock', 38)

    this.add
      .text(96, y - 22, `${stage.order}. ${stage.name}`, {
        fontSize: '16px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: unlocked ? COLORS.text : COLORS.textDisabled,
      })
      .setOrigin(0, 0.5)

    if (!unlocked) {
      this.add
        .text(96, y + 4, `Clear stage ${stage.order - 1} to unlock`, {
          fontSize: '12px',
          fontFamily: FONT.family,
          color: COLORS.textDim,
        })
        .setOrigin(0, 0.5)
      return
    }

    makeStatRow(
      this,
      96,
      y + 4,
      [
        { icon: 'icon_exp', value: `+${stage.rewards.exp}` },
        { icon: 'icon_gold', value: `+${stage.rewards.gold}` },
      ],
      { fontSize: '13px', iconSize: 15, gap: 14 },
    )

    const outlook = stageOutlook(player, stage)
    const hpPct = Math.round(outlook.hpRemaining * 100)
    this.add
      .text(
        96,
        y + 26,
        outlook.willWin ? `${difficultyLabel(outlook.tier)} · ${hpPct}% HP left` : 'Hard · you would lose',
        { fontSize: '11px', fontFamily: FONT.family, color: TIER_COLOR[outlook.tier] },
      )
      .setOrigin(0, 0.5)

    if (cleared) makeEmoji(this, 404, y - 24, 'icon_star', 18)

    makeButton(
      this,
      372,
      y + 6,
      cleared ? 'Farm' : 'Fight',
      () => {
        GameState.selectedStage = stage
        GameState.stopAutoBattle()
        this.scene.start('Battle')
      },
      { minWidth: 90, fontSize: '14px', minHeight: 48 },
    )
  }

  private turnPage(dir: number): void {
    GameState.stagePage += dir
    this.scene.restart()
  }
}
