import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { GameState } from '../state/GameState'
import { signOut } from '../services/authService'
import { effectiveStats } from '../systems/upgrades'
import { makeButton } from '../ui/components/makeButton'
import { makePanel } from '../ui/components/makePanel'
import { COLORS, FONT } from '../ui/styles'

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenu')
  }

  create(): void {
    setupScene(this)
    const player = GameState.player!
    const stats = effectiveStats(player)

    this.add
      .text(GAME_W / 2, 64, '🌸 Incremental RPG 🌸', {
        fontSize: '28px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0.5)
    this.add
      .text(GAME_W / 2, 100, GameState.userId ? '☁️ Signed in — progress syncs to the cloud' : '🏠 Guest mode — progress saved on this device', {
        fontSize: '13px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)

    makePanel(this, GAME_W / 2, 210, 400, 150)
    const hero = this.add.text(120, 210, player.avatar, { fontSize: '56px' }).setOrigin(0.5)
    this.tweens.add({ targets: hero, y: 204, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' })

    this.add
      .text(190, 180, `${player.name}  ·  Lv ${player.level}`, {
        fontSize: '20px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0, 0.5)
    this.add
      .text(190, 212, `❤️ ${stats.maxHp}   ⚔️ ${stats.atk}   🛡️ ${stats.def}`, {
        fontSize: '16px',
        fontFamily: FONT.family,
        color: COLORS.text,
      })
      .setOrigin(0, 0.5)
    this.add
      .text(190, 242, `🪙 ${player.gold} gold`, {
        fontSize: '15px',
        fontFamily: FONT.family,
        color: COLORS.gold,
      })
      .setOrigin(0, 0.5)

    makeButton(this, GAME_W / 2, 340, '⚔️ Stages', () => this.scene.start('StageSelect'), { minWidth: 240 })
    makeButton(this, GAME_W / 2, 404, '😺 Character', () => this.scene.start('Character'), { minWidth: 240 })
    makeButton(this, GAME_W / 2, 468, '🛒 Shop', () => this.scene.start('Shop'), { minWidth: 240 })
    makeButton(
      this,
      GAME_W / 2,
      544,
      GameState.userId ? 'Sign Out' : 'Exit Guest Mode',
      () => {
        void this.handleExit()
      },
      { variant: 'secondary', fontSize: '14px' },
    )
  }

  private async handleExit(): Promise<void> {
    if (GameState.userId) await signOut()
    GameState.userId = null
    GameState.player = null
    this.scene.start('Auth')
  }
}
