import Phaser from 'phaser'
import { STAGES } from '../data/stages'
import { GameState } from '../state/GameState'
import { expToNext } from '../systems/leveling'
import { effectiveStats, upgradeBonus } from '../systems/upgrades'
import { makeButton } from '../ui/components/makeButton'
import { makePanel } from '../ui/components/makePanel'
import { makeBar } from '../ui/components/makeBar'
import { COLORS, FONT } from '../ui/styles'
import type { UpgradeType } from '../types'

export class CharacterScene extends Phaser.Scene {
  constructor() {
    super('Character')
  }

  create(): void {
    const { width } = this.scale
    const player = GameState.player!
    const stats = effectiveStats(player)
    const nextExp = expToNext(player.level)

    this.add
      .text(width / 2, 48, '😺 Character', {
        fontSize: '26px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0.5)

    // Hero card with level + EXP progress
    makePanel(this, width / 2, 170, 400, 170)
    const hero = this.add.text(width / 2, 140, '🐱', { fontSize: '64px' }).setOrigin(0.5)
    this.tweens.add({ targets: hero, angle: { from: -4, to: 4 }, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
    this.add
      .text(width / 2, 192, `${player.name}  ·  Lv ${player.level}`, {
        fontSize: '19px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0.5)
    makeBar(this, width / 2, 220, 320, 14, COLORS.expBar).set(player.exp / nextExp)
    this.add
      .text(width / 2, 240, `✨ EXP ${player.exp} / ${nextExp}`, {
        fontSize: '12px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)

    // Stats card: base (from level) + bonus (from shop treats)
    makePanel(this, width / 2, 360, 400, 180)
    const rows: Array<{ icon: string; label: string; base: number; type: UpgradeType }> = [
      { icon: '❤️', label: 'HP', base: player.stats.maxHp, type: 'hp' },
      { icon: '⚔️', label: 'ATK', base: player.stats.atk, type: 'atk' },
      { icon: '🛡️', label: 'DEF', base: player.stats.def, type: 'def' },
    ]
    rows.forEach((row, i) => {
      const y = 312 + i * 40
      const bonus = upgradeBonus(row.type, player.upgrades[row.type])
      const total = row.type === 'hp' ? stats.maxHp : row.type === 'atk' ? stats.atk : stats.def
      this.add
        .text(70, y, `${row.icon} ${row.label}`, { fontSize: '17px', fontFamily: FONT.family, color: COLORS.text })
        .setOrigin(0, 0.5)
      this.add
        .text(410, y, bonus > 0 ? `${total}  (${row.base} +${bonus})` : `${total}`, {
          fontSize: '17px',
          fontFamily: FONT.family,
          fontStyle: 'bold',
          color: COLORS.text,
        })
        .setOrigin(1, 0.5)
    })
    this.add
      .text(width / 2, 428, `🪙 ${player.gold} gold`, { fontSize: '15px', fontFamily: FONT.family, color: COLORS.gold })
      .setOrigin(0.5)

    const cleared = player.stageProgress.completedStageIds.length
    this.add
      .text(width / 2, 486, `⭐ Stages cleared: ${cleared} / ${STAGES.length}`, {
        fontSize: '15px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)

    makeButton(this, width / 2, 550, '🛒 Shop', () => this.scene.start('Shop'), { minWidth: 200 })
    makeButton(this, width / 2, 614, 'Back', () => this.scene.start('MainMenu'), { variant: 'secondary', fontSize: '14px' })
  }
}
