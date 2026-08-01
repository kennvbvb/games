import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { CHAPTERS, chapterCleared } from '../data/chapters'
import { isBossStage } from '../data/stages'
import { GameState } from '../state/GameState'
import { DIFFICULTY_LABEL_KEYS, stageOutlook } from '../systems/difficulty'
import { makeButton } from '../ui/components/makeButton'
import { makePanel } from '../ui/components/makePanel'
import { makeEmoji } from '../ui/components/makeEmoji'
import { makeStatRow } from '../ui/components/makeStatRow'
import { makeTitle } from '../ui/components/makeTitle'
import { advanceTutorial, makeTutorialTip } from '../ui/components/makeTutorialTip'
import { ambientTween } from '../ui/motion'
import { COLORS, FONT } from '../ui/styles'
import type { Chapter } from '../data/chapters'
import type { DifficultyTier } from '../systems/difficulty'
import type { StageConfig } from '../types'
import { t } from '../i18n'

// One page is one chapter. The boss closes every chapter, so it gets the last
// slot and a taller card.
const ROW_YS = [150, 242, 334]
const BOSS_Y = 436
const CARD_H = 88
const BOSS_CARD_H = 104

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
    const page = Math.min(Math.max(GameState.stagePage, 0), CHAPTERS.length - 1)
    GameState.stagePage = page
    const chapter = CHAPTERS[page]

    advanceTutorial(1)
    makeTitle(this, 40, t('stages.title'), 'icon_atk')
    this.renderChapterHeader(chapter)

    chapter.stages.forEach((stage, i) => {
      this.renderStageCard(stage, isBossStage(stage) ? BOSS_Y : ROW_YS[i])
    })

    const pagerY = 526
    makeButton(this, GAME_W / 2 - 110, pagerY, '◀', () => this.turnPage(-1), {
      disabled: page === 0,
      fontSize: '16px',
      minWidth: 64,
    })
    this.add
      .text(GAME_W / 2, pagerY, t('stages.page', { current: page + 1, total: CHAPTERS.length }), {
        fontSize: '15px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)
    makeButton(this, GAME_W / 2 + 110, pagerY, '▶', () => this.turnPage(1), {
      disabled: page >= CHAPTERS.length - 1,
      fontSize: '16px',
      minWidth: 64,
    })

    makeButton(this, GAME_W / 2, 592, t('common.back'), () => this.scene.start('MainMenu'), {
      variant: 'secondary',
      fontSize: '15px',
      minWidth: 160,
    })

    makeTutorialTip(this, 1, t('tutorial.step1'), 656)
  }

  /** Chapter name and how much of it is done — the page number alone said nothing. */
  private renderChapterHeader(chapter: Chapter): void {
    const player = GameState.player!
    const cleared = chapterCleared(player, chapter)

    const name = this.add
      .text(GAME_W / 2 + 12, 74, t(chapter.nameKey), {
        fontSize: '19px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0.5)
    makeEmoji(this, name.x - name.width / 2 - 16, 74, chapter.icon, 20)

    this.add
      .text(
        GAME_W / 2,
        96,
        `${t('chapter.label', { index: chapter.index })}  ·  ${t('chapter.progress', {
          cleared,
          total: chapter.stages.length,
        })}`,
        { fontSize: '12px', fontFamily: FONT.family, color: COLORS.textDim },
      )
      .setOrigin(0.5)
  }

  /**
   * One stage card: enemy, rewards, and an honest difficulty read. Because
   * combat is deterministic the outlook is an exact simulation of the fight
   * the player would get, not an estimate — bosses included, enrage and all.
   */
  private renderStageCard(stage: StageConfig, y: number): void {
    const player = GameState.player!
    const unlocked = stage.order <= player.stageProgress.highestUnlocked
    const cleared = player.stageProgress.completedStageIds.includes(stage.id)
    const boss = isBossStage(stage)

    makePanel(this, GAME_W / 2, y, 430, boss ? BOSS_CARD_H : CARD_H)
    const top = y - (boss ? BOSS_CARD_H : CARD_H) / 2

    const sprite = makeEmoji(this, 60, top + 34, unlocked ? stage.enemy.sprite : 'icon_lock', boss ? 46 : 38)
    if (boss && unlocked) {
      ambientTween(this, { targets: sprite, scale: { from: sprite.scale, to: sprite.scale * 1.08 }, duration: 800, yoyo: true, repeat: -1 })
    }

    const title = this.add
      .text(96, top + 20, `${stage.order}. ${stage.name}`, {
        fontSize: '16px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: unlocked ? COLORS.text : COLORS.textDisabled,
      })
      .setOrigin(0, 0.5)

    if (boss) {
      // Tag rides after the name so it reads as part of the title line.
      const tagX = Math.min(96 + title.width + 10, 300)
      const tag = this.add
        .text(tagX + 15, top + 20, t('stages.boss'), {
          fontSize: '11px',
          fontFamily: FONT.family,
          fontStyle: 'bold',
          color: COLORS.danger,
        })
        .setOrigin(0, 0.5)
      makeEmoji(this, tagX + 6, top + 20, 'decor_skull', 13)
      tag.setX(tagX + 15)
    }

    if (!unlocked) {
      this.add
        .text(96, top + 46, t('stages.locked', { order: stage.order - 1 }), {
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
      top + 46,
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
        top + 68,
        outlook.willWin
          ? t('stages.outlook', { tier: t(DIFFICULTY_LABEL_KEYS[outlook.tier]), hp: hpPct })
          : t('stages.outlookLose'),
        { fontSize: '11px', fontFamily: FONT.family, color: TIER_COLOR[outlook.tier] },
      )
      .setOrigin(0, 0.5)

    if (boss) {
      this.add
        .text(96, top + 88, t('stages.bossHint', { turn: stage.enemy.boss!.enrageAfterTurn }), {
          fontSize: '10px',
          fontFamily: FONT.family,
          color: COLORS.textDim,
        })
        .setOrigin(0, 0.5)
    }

    if (cleared) makeEmoji(this, 404, top + 18, 'icon_star', 18)

    makeButton(
      this,
      372,
      top + 50,
      cleared ? t('stages.farm') : t('stages.fight'),
      () => {
        GameState.selectedStage = stage
        GameState.stopAutoBattle()
        // Only this route asks for a plan; auto-battle streaks reuse the choice.
        this.scene.start('PrepareBattle')
      },
      { minWidth: 90, fontSize: '14px', minHeight: 48 },
    )
  }

  private turnPage(dir: number): void {
    GameState.stagePage += dir
    this.scene.restart()
  }
}
