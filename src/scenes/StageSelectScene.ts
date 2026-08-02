import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { WORLDS, worldCleared, worldPageFor } from '../data/worlds'
import { isBossStage } from '../data/stages'
import { difficultyOf } from '../data/difficulties'
import { activeDifficulty } from '../systems/campaignModes'
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
import type { World } from '../data/worlds'
import type { DifficultyTier } from '../systems/difficulty'
import type { StageConfig } from '../types'
import { t } from '../i18n'

// One page is one world: four ordinary stages, then the boss that closes it on
// a taller card. Five rows in 480x720 is tight, so the cards are shorter than
// the three-per-page layout they replace.
const ROW_YS = [146, 226, 306, 386]
const BOSS_Y = 472
const CARD_H = 74
const BOSS_CARD_H = 92

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
    // Open where the player actually is. With twelve worlds, defaulting to the
    // first would mean up to eleven taps to reach the next fight.
    if (GameState.stagePage < 0) GameState.stagePage = worldPageFor(GameState.player!)
    const page = Math.min(Math.max(GameState.stagePage, 0), WORLDS.length - 1)
    GameState.stagePage = page
    const world = WORLDS[page]

    advanceTutorial(1)
    makeTitle(this, 40, t('stages.title'), 'icon_atk')
    this.renderWorldHeader(world)

    world.stages.forEach((stage, i) => {
      this.renderStageCard(stage, isBossStage(stage) ? BOSS_Y : ROW_YS[i])
    })

    const pagerY = 556
    makeButton(this, GAME_W / 2 - 110, pagerY, '◀', () => this.turnPage(-1), {
      disabled: page === 0,
      fontSize: '16px',
      minWidth: 64,
    })
    this.add
      .text(GAME_W / 2, pagerY, `${page + 1} / ${WORLDS.length}`, {
        fontSize: '15px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)
    makeButton(this, GAME_W / 2 + 110, pagerY, '▶', () => this.turnPage(1), {
      disabled: page >= WORLDS.length - 1,
      fontSize: '16px',
      minWidth: 64,
    })

    makeButton(this, GAME_W / 2, 616, t('common.back'), () => this.scene.start('MainMenu'), {
      variant: 'secondary',
      fontSize: '15px',
      minWidth: 160,
    })

    makeTutorialTip(this, 1, t('tutorial.step1'), 676)
  }

  /** World name and how much of it is done — the page number alone said nothing. */
  private renderWorldHeader(world: World): void {
    const player = GameState.player!
    const cleared = worldCleared(player, world)

    const name = this.add
      .text(GAME_W / 2 + 12, 74, t(world.nameKey), {
        fontSize: '19px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0.5)
    makeEmoji(this, name.x - name.width / 2 - 16, 74, world.icon, 20)

    this.add
      .text(
        GAME_W / 2,
        96,
        `${t('world.label', { index: world.index, total: WORLDS.length })}  ·  ${t('world.progress', {
          cleared,
          total: world.stages.length,
        })}  ·  ${t(difficultyOf(activeDifficulty(player)).nameKey)}`,
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

    const sprite = makeEmoji(this, 58, top + (boss ? 34 : 30), unlocked ? stage.enemy.sprite : 'icon_lock', boss ? 42 : 34)
    if (boss && unlocked) {
      ambientTween(this, { targets: sprite, scale: { from: sprite.scale, to: sprite.scale * 1.08 }, duration: 800, yoyo: true, repeat: -1 })
    }

    const title = this.add
      .text(92, top + 17, `${stage.order}. ${stage.name}`, {
        fontSize: '16px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: unlocked ? COLORS.text : COLORS.textDisabled,
      })
      .setOrigin(0, 0.5)

    if (boss) {
      // Tag rides after the name so it reads as part of the title line.
      const tagX = Math.min(92 + title.width + 8, 296)
      const tag = this.add
        .text(tagX + 15, top + 17, t('stages.boss'), {
          fontSize: '11px',
          fontFamily: FONT.family,
          fontStyle: 'bold',
          color: COLORS.danger,
        })
        .setOrigin(0, 0.5)
      makeEmoji(this, tagX + 6, top + 17, 'decor_skull', 13)
      tag.setX(tagX + 15)
    }

    if (!unlocked) {
      this.add
        .text(92, top + 40, t('stages.locked', { order: stage.order - 1 }), {
          fontSize: '12px',
          fontFamily: FONT.family,
          color: COLORS.textDim,
        })
        .setOrigin(0, 0.5)
      return
    }

    makeStatRow(
      this,
      92,
      top + 39,
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
        92,
        top + 59,
        outlook.willWin
          ? t('stages.outlook', { tier: t(DIFFICULTY_LABEL_KEYS[outlook.tier]), hp: hpPct })
          : t('stages.outlookLose'),
        { fontSize: '11px', fontFamily: FONT.family, color: TIER_COLOR[outlook.tier] },
      )
      .setOrigin(0, 0.5)

    if (boss) {
      this.add
        .text(92, top + 78, t('stages.bossHint', { turn: stage.enemy.boss!.enrageAfterTurn }), {
          fontSize: '10px',
          fontFamily: FONT.family,
          color: COLORS.textDim,
        })
        .setOrigin(0, 0.5)
    }

    if (cleared) makeEmoji(this, 404, top + 15, 'icon_star', 16)

    makeButton(
      this,
      374,
      top + (boss ? 52 : 44),
      cleared ? t('stages.farm') : t('stages.fight'),
      () => {
        GameState.selectedStage = stage
        GameState.stopAutoBattle()
        // Only this route asks for a plan; auto-battle streaks reuse the choice.
        this.scene.start('PrepareBattle')
      },
      { minWidth: 86, fontSize: '13px', minHeight: 46 },
    )
  }

  private turnPage(dir: number): void {
    GameState.stagePage += dir
    this.scene.restart()
  }
}
