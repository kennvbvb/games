import Phaser from 'phaser'
import { BALANCE } from '../data/balance'
import { GameState } from '../state/GameState'
import { persist } from '../services/saveService'
import { buyUpgrade, upgradeCost } from '../systems/upgrades'
import { makeButton } from '../ui/components/makeButton'
import { makePanel } from '../ui/components/makePanel'
import { COLORS, FONT } from '../ui/styles'
import type { UpgradeType } from '../types'

const UPGRADE_TYPES: UpgradeType[] = ['hp', 'atk', 'def']

export class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop')
  }

  create(): void {
    const { width } = this.scale
    const player = GameState.player!

    this.add
      .text(width / 2, 48, '🛒 Treat Shop', {
        fontSize: '26px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0.5)
    this.add
      .text(width / 2, 84, 'Sweet treats make your hero permanently stronger!', {
        fontSize: '13px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)
    this.add
      .text(width / 2, 118, `🪙 ${player.gold} gold`, {
        fontSize: '18px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.gold,
      })
      .setOrigin(0.5)

    UPGRADE_TYPES.forEach((type, i) => {
      const cfg = BALANCE.upgrades[type]
      const owned = player.upgrades[type]
      const cost = upgradeCost(type, owned)
      const y = 200 + i * 120

      makePanel(this, width / 2, y, 420, 100)
      this.add.text(70, y, cfg.emoji, { fontSize: '40px' }).setOrigin(0.5)
      this.add
        .text(110, y - 22, cfg.name, { fontSize: '17px', fontFamily: FONT.family, fontStyle: 'bold', color: COLORS.text })
        .setOrigin(0, 0.5)
      this.add
        .text(110, y + 2, cfg.description, { fontSize: '14px', fontFamily: FONT.family, color: COLORS.textDim })
        .setOrigin(0, 0.5)
      this.add
        .text(110, y + 26, `Owned: ${owned}`, { fontSize: '12px', fontFamily: FONT.family, color: COLORS.textDim })
        .setOrigin(0, 0.5)

      makeButton(this, 375, y, `🪙 ${cost}`, () => this.handleBuy(type), {
        disabled: player.gold < cost,
        minWidth: 90,
        fontSize: '15px',
      })
    })

    makeButton(this, width / 2, 610, 'Back', () => this.scene.start('MainMenu'), { variant: 'secondary', fontSize: '14px' })
  }

  private handleBuy(type: UpgradeType): void {
    const next = buyUpgrade(GameState.player!, type)
    if (!next) return
    GameState.player = next
    void persist(next, GameState.userId)
    this.scene.restart()
  }
}
