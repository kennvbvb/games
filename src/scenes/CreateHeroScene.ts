import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { GameState } from '../state/GameState'
import { createDefaultPlayerState } from '../state/playerState'
import { persist } from '../services/saveService'
import { makeButton } from '../ui/components/makeButton'
import { makePanel } from '../ui/components/makePanel'
import { COLORS, FONT } from '../ui/styles'

const AVATARS = ['🐱', '🐶', '🦊', '🐰', '🐼', '🐸']

export class CreateHeroScene extends Phaser.Scene {
  private selectedAvatar = AVATARS[0]
  private rings: Map<string, Phaser.GameObjects.Graphics> = new Map()
  private preview!: Phaser.GameObjects.Text

  constructor() {
    super('CreateHero')
  }

  create(): void {
    setupScene(this)
    this.selectedAvatar = AVATARS[0]
    this.rings = new Map()

    this.add
      .text(GAME_W / 2, 60, '✨ Create Your Hero ✨', {
        fontSize: '26px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0.5)

    // Big preview of the chosen avatar
    makePanel(this, GAME_W / 2, 160, 170, 130)
    this.preview = this.add.text(GAME_W / 2, 155, this.selectedAvatar, { fontSize: '64px' }).setOrigin(0.5)
    this.tweens.add({ targets: this.preview, y: 148, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' })

    this.add
      .text(GAME_W / 2, 250, 'Choose your buddy', { fontSize: '15px', fontFamily: FONT.family, color: COLORS.textDim })
      .setOrigin(0.5)

    // Avatar picker grid (2 rows x 3)
    AVATARS.forEach((avatar, i) => {
      const x = GAME_W / 2 + (i % 3 - 1) * 90
      const y = 310 + Math.floor(i / 3) * 84
      const ring = this.add.graphics()
      this.rings.set(avatar, ring)
      this.drawRing(ring, x, y, avatar === this.selectedAvatar)

      const face = this.add.text(x, y, avatar, { fontSize: '40px' }).setOrigin(0.5)
      face.setInteractive({ useHandCursor: true })
      face.on('pointerdown', () => this.select(avatar))
      face.on('pointerover', () => this.tweens.add({ targets: face, scale: 1.15, duration: 100 }))
      face.on('pointerout', () => this.tweens.add({ targets: face, scale: 1, duration: 100 }))
    })

    this.add
      .text(GAME_W / 2, 452, 'Name your hero', { fontSize: '15px', fontFamily: FONT.family, color: COLORS.textDim })
      .setOrigin(0.5)

    const inputStyle =
      'padding:10px 14px;font-size:16px;text-align:center;border-radius:14px;border:2px solid #f3d9e5;background:#fff;color:#5d4a66;outline:none;font-family:inherit;width:200px'
    const dom = this.add
      .dom(GAME_W / 2, 492)
      .createFromHTML(
        `<input id="hero-name" type="text" maxlength="14" placeholder="Hero" style="${inputStyle}" />`,
      )
    const nameInput = dom.getChildByID('hero-name') as HTMLInputElement

    makeButton(
      this,
      GAME_W / 2,
      570,
      '🌟 Start Adventure!',
      () => {
        void this.startGame(nameInput.value)
      },
      { minWidth: 240 },
    )
  }

  private drawRing(ring: Phaser.GameObjects.Graphics, x: number, y: number, selected: boolean): void {
    ring.clear()
    ring.fillStyle(selected ? COLORS.primary : COLORS.panel, selected ? 0.25 : 1)
    ring.fillCircle(x, y, 34)
    ring.lineStyle(3, selected ? COLORS.primary : COLORS.panelStroke, 1)
    ring.strokeCircle(x, y, 34)
  }

  private select(avatar: string): void {
    this.selectedAvatar = avatar
    this.preview.setText(avatar)
    AVATARS.forEach((a, i) => {
      const x = GAME_W / 2 + (i % 3 - 1) * 90
      const y = 310 + Math.floor(i / 3) * 84
      this.drawRing(this.rings.get(a)!, x, y, a === avatar)
    })
  }

  private async startGame(rawName: string): Promise<void> {
    const name = rawName.trim().slice(0, 14) || 'Hero'
    const state = createDefaultPlayerState(name, this.selectedAvatar)
    GameState.player = state
    await persist(state, GameState.userId)
    this.scene.start('MainMenu')
  }
}
