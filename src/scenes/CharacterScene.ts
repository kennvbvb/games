import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { STAGES } from '../data/stages'
import { GameState } from '../state/GameState'
import { expToNext } from '../systems/leveling'
import { effectiveStats, totalBonus } from '../systems/upgrades'
import { makeButton } from '../ui/components/makeButton'
import { makePanel } from '../ui/components/makePanel'
import { makeBar } from '../ui/components/makeBar'
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

    this.add
      .text(GAME_W / 2, 48, '😺 Character', {
        fontSize: '26px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0.5)

    // Hero card with level + EXP progress
    makePanel(this, GAME_W / 2, 170, 400, 170)
    const hero = this.add.text(GAME_W / 2, 140, player.avatar, { fontSize: '64px' }).setOrigin(0.5)
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
    this.add
      .text(GAME_W / 2, 240, `✨ EXP ${player.exp} / ${nextExp}`, {
        fontSize: '12px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)

    // Stats card: base (from level) + bonus (treats and gear)
    makePanel(this, GAME_W / 2, 360, 400, 180)
    const rows = [
      { icon: '❤️', label: 'HP', base: player.stats.maxHp, bonus: bonus.hp, total: stats.maxHp },
      { icon: '⚔️', label: 'ATK', base: player.stats.atk, bonus: bonus.atk, total: stats.atk },
      { icon: '🛡️', label: 'DEF', base: player.stats.def, bonus: bonus.def, total: stats.def },
    ]
    rows.forEach((row, i) => {
      const y = 312 + i * 40
      this.add
        .text(70, y, `${row.icon} ${row.label}`, { fontSize: '17px', fontFamily: FONT.family, color: COLORS.text })
        .setOrigin(0, 0.5)
      this.add
        .text(410, y, row.bonus > 0 ? `${row.total}  (${row.base} +${row.bonus})` : `${row.total}`, {
          fontSize: '17px',
          fontFamily: FONT.family,
          fontStyle: 'bold',
          color: COLORS.text,
        })
        .setOrigin(1, 0.5)
    })
    this.add
      .text(GAME_W / 2, 428, `🪙 ${player.gold} gold`, { fontSize: '15px', fontFamily: FONT.family, color: COLORS.gold })
      .setOrigin(0.5)

    const cleared = player.stageProgress.completedStageIds.length
    this.add
      .text(GAME_W / 2, 470, `⭐ Stages cleared: ${cleared} / ${STAGES.length}`, {
        fontSize: '15px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)
    this.add
      .text(GAME_W / 2, 496, `🎒 Gear owned: ${player.ownedItemIds.length}`, {
        fontSize: '15px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)

    makeButton(this, GAME_W / 2, 552, '🛒 Shop', () => this.scene.start('Shop'), { minWidth: 200 })
    makeButton(this, GAME_W / 2, 616, 'Back', () => this.scene.start('MainMenu'), { variant: 'secondary', fontSize: '14px' })
  }
}
