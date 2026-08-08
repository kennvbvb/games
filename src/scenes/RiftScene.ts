import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { GameState } from '../state/GameState'
import { traitOf } from '../data/enemyTraits'
import { currentRift, msUntilNextRift, riftCleared, riftUnlocked } from '../systems/rift'
import { formatDuration } from '../systems/idle'
import { stageOutlook } from '../systems/difficulty'
import { makeButton } from '../ui/components/makeButton'
import { makeEmoji } from '../ui/components/makeEmoji'
import { makePanel } from '../ui/components/makePanel'
import { makeTitle } from '../ui/components/makeTitle'
import { COLORS, FONT } from '../ui/styles'
import { t } from '../i18n'

/**
 * The Realm Rift: one rotating fight, shown whole on one screen.
 *
 * No list and no pagination — there is exactly one rift at a time, and the
 * screen's whole job is to answer "what is different this week, and can I take
 * it". Both halves are stated in full before the player commits, because the
 * boon is a large enough swing that a build worth switching to might exist.
 */
export class RiftScene extends Phaser.Scene {
  constructor() {
    super('Rift')
  }

  create(): void {
    setupScene(this)
    const player = GameState.player!

    makeTitle(this, 42, t('rift.title'), 'decor_portal', { fontSize: '23px', iconSize: 20 })

    if (!riftUnlocked(player)) {
      this.renderLocked()
      return
    }

    const rift = currentRift(player)
    const done = riftCleared(player)

    this.add
      .text(GAME_W / 2, 74, `${t('rift.week', { week: rift.week })}  ·  ${t('rift.rotates', { duration: formatDuration(msUntilNextRift()) })}`, {
        fontSize: '12px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)

    // The enemy, with the same forecast the campaign and tower cards carry.
    makePanel(this, GAME_W / 2, 152, 440, 96)
    makeEmoji(this, 60, 152, rift.stage.enemy.sprite, 40)
    this.add
      .text(104, 128, rift.stage.enemy.name, {
        fontSize: '17px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0, 0.5)
    const outlook = stageOutlook(player, rift.stage)
    this.add
      .text(
        104,
        154,
        outlook.willWin
          ? t('stages.outlook', { tier: t(`stages.${outlook.tier}`), hp: Math.round(outlook.hpRemaining * 100) })
          : t('stages.outlookLose'),
        {
          fontSize: '12px',
          fontFamily: FONT.family,
          fontStyle: 'bold',
          color: outlook.willWin ? COLORS.success : COLORS.danger,
        },
      )
      .setOrigin(0, 0.5)
    this.add
      .text(104, 178, t('rift.reward', { gold: rift.stage.rewards.gold, exp: rift.stage.rewards.exp }), {
        fontSize: '11px',
        fontFamily: FONT.family,
        color: COLORS.gold,
      })
      .setOrigin(0, 0.5)

    // 256 and 368, not 228 and 352: the enemy panel ends at y=200 and a 104-tall
    // card centred at 228 starts at 176, which hid the reward line behind it.
    this.renderCard(256, t('rift.boon'), rift.boon.sprite, t(rift.boon.nameKey), t(rift.boon.descriptionKey), COLORS.success)
    this.renderCard(
      368,
      t('rift.bane'),
      rift.bane.sprite,
      `${t(rift.bane.nameKey)} · ${t(traitOf(rift.stage.enemy.trait).nameKey)}`,
      t(rift.bane.descriptionKey),
      COLORS.danger,
    )

    this.add
      .text(GAME_W / 2, 452, t('rift.explain'), {
        fontSize: '11px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
        align: 'center',
        wordWrap: { width: 420 },
      })
      .setOrigin(0.5)

    if (done) {
      this.add
        .text(GAME_W / 2, 494, t('rift.doneHint'), {
          fontSize: '12px',
          fontFamily: FONT.family,
          color: COLORS.textDim,
          align: 'center',
          wordWrap: { width: 400 },
        })
        .setOrigin(0.5)
    }

    // A cleared rift can still be fought — the fight is the fun part and the
    // build test is worth repeating; it simply stops paying, which the label
    // says outright rather than leaving the player to notice a missing reward.
    makeButton(this, GAME_W / 2, 556, done ? t('rift.again') : t('rift.enter'), () => this.enter(), {
      variant: done ? 'secondary' : 'primary',
      minWidth: 260,
      minHeight: 52,
      fontSize: '16px',
      icon: 'decor_portal',
    })
    makeButton(this, GAME_W / 2, 634, t('common.back'), () => this.scene.start('MainMenu'), {
      variant: 'secondary',
      minWidth: 180,
      minHeight: 46,
      fontSize: '15px',
    })
  }

  private renderCard(y: number, label: string, sprite: string, name: string, body: string, accent: string): void {
    makePanel(this, GAME_W / 2, y, 440, 104)
    this.add
      .text(30, y - 38, label, { fontSize: '10px', fontFamily: FONT.family, color: COLORS.textDim })
      .setOrigin(0, 0.5)
    makeEmoji(this, 56, y + 6, sprite, 30)
    this.add
      .text(92, y - 8, name, {
        fontSize: '15px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: accent,
      })
      .setOrigin(0, 0.5)
    this.add
      .text(92, y + 22, body, {
        fontSize: '11px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
        wordWrap: { width: 340 },
      })
      .setOrigin(0, 0.5)
  }

  private renderLocked(): void {
    makePanel(this, GAME_W / 2, 300, 420, 180)
    makeEmoji(this, GAME_W / 2, 250, 'icon_lock', 46)
    this.add
      .text(GAME_W / 2, 316, t('rift.locked'), {
        fontSize: '15px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
        align: 'center',
        wordWrap: { width: 380 },
      })
      .setOrigin(0.5)
    this.add
      .text(GAME_W / 2, 356, t('rift.lockedHint'), {
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

  private enter(): void {
    GameState.selectedStage = currentRift(GameState.player!).stage
    GameState.selectedPlan = null
    GameState.stopAutoBattle()
    this.scene.start('PrepareBattle')
  }
}
