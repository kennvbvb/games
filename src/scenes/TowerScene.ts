import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { GameState } from '../state/GameState'
import { isTowerBossFloor } from '../data/tower'
import { traitOf } from '../data/enemyTraits'
import { bestFloor, canAttempt, floorConfig, nextFloor, towerUnlocked } from '../systems/tower'
import { stageOutlook } from '../systems/difficulty'
import { makeButton } from '../ui/components/makeButton'
import { makeEmoji } from '../ui/components/makeEmoji'
import { makePanel } from '../ui/components/makePanel'
import { makeTitle } from '../ui/components/makeTitle'
import { COLORS, FONT } from '../ui/styles'
import type { PlayerState } from '../types'
import { t } from '../i18n'

interface TowerSceneData {
  /** Top of the visible window; defaults to sitting just under the next floor. */
  from?: number
}

const ROWS = 5
const ROW_TOP = 250
const ROW_GAP = 74
const ROW_H = 66

/**
 * The Endless Tower.
 *
 * Shown as a short window onto an infinite list rather than a page count: there
 * is no last page to number, so the only honest navigation is "up from here"
 * and "down from here". The window opens on the floor the player is actually
 * on, because that is the only floor they came here to fight.
 */
export class TowerScene extends Phaser.Scene {
  private from = 1

  constructor() {
    super('Tower')
  }

  init(data: TowerSceneData): void {
    this.from = data.from ?? 0
  }

  create(): void {
    setupScene(this)
    const player = GameState.player!

    makeTitle(this, 42, t('tower.title'), 'decor_tower', { fontSize: '23px', iconSize: 20 })

    if (!towerUnlocked(player)) {
      this.renderLocked()
      return
    }

    // Default window: the next floor sits second from the top, so the floors
    // already beaten stay visible as a record without pushing the live one off.
    const next = nextFloor(player)
    if (this.from <= 0) this.from = Math.max(1, next - 1)

    const best = bestFloor(player)
    makePanel(this, GAME_W / 2, 150, 440, 96)
    this.add
      .text(GAME_W / 2, 122, t('tower.best', { floor: best }), {
        fontSize: '19px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.gold,
      })
      .setOrigin(0.5)
    this.add
      .text(GAME_W / 2, 152, t('tower.nextUp', { floor: next }), {
        fontSize: '13px',
        fontFamily: FONT.family,
        color: COLORS.text,
      })
      .setOrigin(0.5)
    this.add
      .text(GAME_W / 2, 178, t('tower.explain'), {
        fontSize: '11px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
        align: 'center',
        wordWrap: { width: 410 },
      })
      .setOrigin(0.5)

    for (let i = 0; i < ROWS; i++) this.renderFloor(player, this.from + i, ROW_TOP + i * ROW_GAP)

    // Down is disabled at the bottom of the tower rather than hidden: a button
    // that vanishes moves everything under it and costs the player their place.
    makeButton(this, 120, 630, t('tower.down'), () => this.scene.restart({ from: Math.max(1, this.from - ROWS) }), {
      variant: 'secondary',
      disabled: this.from <= 1,
      minWidth: 110,
      minHeight: 46,
      fontSize: '13px',
    })
    makeButton(this, 240, 630, t('tower.up'), () => this.scene.restart({ from: this.from + ROWS }), {
      variant: 'secondary',
      minWidth: 110,
      minHeight: 46,
      fontSize: '13px',
    })
    makeButton(this, 372, 630, t('common.back'), () => this.scene.start('MainMenu'), {
      variant: 'secondary',
      minWidth: 130,
      minHeight: 46,
      fontSize: '14px',
    })
  }

  private renderLocked(): void {
    makePanel(this, GAME_W / 2, 300, 420, 180)
    makeEmoji(this, GAME_W / 2, 250, 'icon_lock', 46)
    this.add
      .text(GAME_W / 2, 316, t('tower.locked'), {
        fontSize: '15px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
        align: 'center',
        wordWrap: { width: 380 },
      })
      .setOrigin(0.5)
    this.add
      .text(GAME_W / 2, 356, t('tower.lockedHint'), {
        fontSize: '12px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
        align: 'center',
        wordWrap: { width: 380 },
      })
      .setOrigin(0.5)
    makeButton(this, GAME_W / 2, 440, t('common.back'), () => this.scene.start('MainMenu'), {
      variant: 'secondary',
      minWidth: 180,
      minHeight: 46,
      fontSize: '15px',
    })
  }

  private renderFloor(player: PlayerState, floor: number, y: number): void {
    const stage = floorConfig(floor)
    const beaten = floor <= bestFloor(player)
    const open = canAttempt(player, floor)
    const boss = isTowerBossFloor(floor)

    makePanel(this, GAME_W / 2, y, 440, ROW_H)
    makeEmoji(this, 48, y, open || beaten ? stage.enemy.sprite : 'icon_lock', 28)

    const title = this.add
      .text(80, y - 13, t('tower.floor', { floor }), {
        fontSize: '15px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: open || beaten ? COLORS.text : COLORS.textDisabled,
      })
      .setOrigin(0, 0.5)

    if (boss) {
      this.add
        .text(title.x + title.width + 10, y - 13, t('stages.boss'), {
          fontSize: '10px',
          fontFamily: FONT.family,
          fontStyle: 'bold',
          color: COLORS.danger,
        })
        .setOrigin(0, 0.5)
    } else if (beaten) {
      this.add
        .text(title.x + title.width + 10, y - 13, '✓', {
          fontSize: '13px',
          fontFamily: FONT.family,
          color: COLORS.success,
        })
        .setOrigin(0, 0.5)
    }

    // The forecast is the real simulation, same as the campaign's stage cards —
    // it is the only way to know a floor is a wall without losing to it first.
    let subtitle = t('tower.sealed')
    let colour: string = COLORS.textDisabled
    if (open || beaten) {
      const outlook = stageOutlook(player, stage)
      const trait = t(traitOf(stage.enemy.trait).nameKey)
      subtitle = outlook.willWin
        ? `${trait} · ${t('stages.outlook', { tier: t(`stages.${outlook.tier}`), hp: Math.round(outlook.hpRemaining * 100) })}`
        : `${trait} · ${t('stages.outlookLose')}`
      colour = outlook.willWin ? COLORS.textDim : COLORS.danger
    }
    this.add
      .text(80, y + 12, subtitle, { fontSize: '11px', fontFamily: FONT.family, color: colour })
      .setOrigin(0, 0.5)

    makeButton(
      this,
      396,
      y,
      beaten ? t('tower.again') : t('stages.fight'),
      () => {
        GameState.selectedStage = stage
        GameState.selectedPlan = null
        GameState.stopAutoBattle()
        this.scene.start('PrepareBattle')
      },
      { variant: open && !beaten ? 'primary' : 'secondary', disabled: !open, minWidth: 92, minHeight: 48, fontSize: '12px' },
    )
  }
}
