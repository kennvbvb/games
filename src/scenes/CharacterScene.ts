import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { STAGES } from '../data/stages'
import { GameState } from '../state/GameState'
import { expToNext } from '../systems/leveling'
import { effectiveStats, totalBonus } from '../systems/upgrades'
import { makeButton } from '../ui/components/makeButton'
import { makePanel } from '../ui/components/makePanel'
import { makeBar } from '../ui/components/makeBar'
import { makeEmoji } from '../ui/components/makeEmoji'
import { makeTitle } from '../ui/components/makeTitle'
import { COLORS, FONT } from '../ui/styles'

export class CharacterScene extends Phaser.Scene {
  constructor() {
    super('Character')
  }

  create(): void {
    setupScene(this)
    const player = GameState.player!
    const stats = effectiveStats(player)
    const bonus = totalBonus(player)
    const nextExp = expToNext(player.level)

    makeTitle(this, 48, 'Character', 'icon_face')

    // Hero card with level + EXP progress
    makePanel(this, GAME_W / 2, 170, 400, 170)
    const hero = makeEmoji(this, GAME_W / 2, 138, `avatar_${player.avatar}`, 70)
    this.tweens.add({ targets: hero, angle: { from: -4, to: 4 }, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
    this.add
      .text(GAME_W / 2, 192, `${player.name}  ·  Lv ${player.level}`, {
        fontSize: '19px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0.5)
    makeBar(this, GAME_W / 2, 220, 320, 14, COLORS.expBar).set(player.exp / nextExp)
    const expLabel = this.add
      .text(GAME_W / 2 + 8, 240, `EXP ${player.exp} / ${nextExp}`, {
        fontSize: '12px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)
    makeEmoji(this, expLabel.x - expLabel.width / 2 - 10, 240, 'icon_exp', 14)

    // Stats card: base (from level) + bonus (treats and gear)
    makePanel(this, GAME_W / 2, 360, 400, 180)
    const rows = [
      { icon: 'icon_hp', label: 'HP', base: player.stats.maxHp, bonus: bonus.hp, total: stats.maxHp },
      { icon: 'icon_atk', label: 'ATK', base: player.stats.atk, bonus: bonus.atk, total: stats.atk },
      { icon: 'icon_def', label: 'DEF', base: player.stats.def, bonus: bonus.def, total: stats.def },
    ]
    rows.forEach((row, i) => {
      const y = 312 + i * 40
      makeEmoji(this, 78, y, row.icon, 20)
      this.add
        .text(98, y, row.label, { fontSize: '17px', fontFamily: FONT.family, color: COLORS.text })
        .setOrigin(0, 0.5)
      this.add
        .text(402, y, row.bonus > 0 ? `${row.total}` : `${row.total}`, {
          fontSize: '18px',
          fontFamily: FONT.family,
          fontStyle: 'bold',
          color: COLORS.text,
        })
        .setOrigin(1, 0.5)
      if (row.bonus > 0) {
        this.add
          .text(402, y + 15, `${row.base} + ${row.bonus}`, {
            fontSize: '11px',
            fontFamily: FONT.family,
            color: COLORS.success,
          })
          .setOrigin(1, 0.5)
      }
    })
    makeEmoji(this, GAME_W / 2 - 42, 428, 'icon_gold', 17)
    this.add
      .text(GAME_W / 2 - 28, 428, `${player.gold} gold`, {
        fontSize: '15px',
        fontFamily: FONT.family,
        color: COLORS.gold,
      })
      .setOrigin(0, 0.5)

    const cleared = player.stageProgress.completedStageIds.length
    makeEmoji(this, 128, 472, 'icon_star', 17)
    this.add
      .text(146, 472, `Stages cleared: ${cleared} / ${STAGES.length}`, {
        fontSize: '15px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0, 0.5)
    makeEmoji(this, 128, 500, 'icon_bag', 17)
    this.add
      .text(146, 500, `Gear owned: ${player.ownedItemIds.length}`, {
        fontSize: '15px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0, 0.5)

    makeButton(this, GAME_W / 2, 556, 'Shop', () => this.scene.start('Shop'), { minWidth: 200, icon: 'icon_cart' })
    makeButton(this, GAME_W / 2, 620, 'Back', () => this.scene.start('MainMenu'), {
      variant: 'secondary',
      fontSize: '14px',
    })
  }
}
