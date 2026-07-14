import Phaser from 'phaser'
import { GameState } from '../state/GameState'
import { signOut } from '../services/authService'
import { makeButton } from '../ui/components/makeButton'
import { COLORS } from '../ui/styles'

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenu')
  }

  create(): void {
    const { width } = this.scale
    const player = GameState.player!

    this.add.text(width / 2, 60, `Welcome, ${player.name}`, { fontSize: '24px', color: COLORS.text }).setOrigin(0.5)
    this.add
      .text(width / 2, 96, GameState.userId ? 'Signed in' : 'Guest mode (progress saved on this device)', {
        fontSize: '13px',
        color: COLORS.textDim,
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, 150, `Level ${player.level}   |   Gold ${player.gold}`, { fontSize: '18px', color: COLORS.text })
      .setOrigin(0.5)
    this.add
      .text(width / 2, 180, `HP ${player.stats.maxHp}   ATK ${player.stats.atk}   DEF ${player.stats.def}`, {
        fontSize: '15px',
        color: COLORS.textDim,
      })
      .setOrigin(0.5)

    makeButton(this, width / 2, 260, 'Stages', () => this.scene.start('StageSelect'))
    makeButton(this, width / 2, 320, GameState.userId ? 'Sign Out' : 'Exit Guest Mode', () => {
      void this.handleExit()
    })
  }

  private async handleExit(): Promise<void> {
    if (GameState.userId) await signOut()
    GameState.userId = null
    GameState.player = null
    this.scene.start('Auth')
  }
}
