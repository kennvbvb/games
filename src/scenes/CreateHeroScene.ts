import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { AVATAR_IDS, DEFAULT_AVATAR, type AvatarId } from '../data/avatars'
import { GameState } from '../state/GameState'
import { createDefaultPlayerState } from '../state/playerState'
import { persist } from '../services/saveService'
import { makeButton } from '../ui/components/makeButton'
import { makePanel } from '../ui/components/makePanel'
import { makeEmoji } from '../ui/components/makeEmoji'
import { ambientTween } from '../ui/motion'
import { COLORS, FONT } from '../ui/styles'
import { t } from '../i18n'

export class CreateHeroScene extends Phaser.Scene {
  private selected: AvatarId = DEFAULT_AVATAR
  private rings = new Map<AvatarId, Phaser.GameObjects.Graphics>()
  private preview!: Phaser.GameObjects.Image

  constructor() {
    super('CreateHero')
  }

  private slotPos(i: number): { x: number; y: number } {
    return { x: GAME_W / 2 + ((i % 3) - 1) * 90, y: 312 + Math.floor(i / 3) * 84 }
  }

  create(): void {
    setupScene(this)
    this.selected = DEFAULT_AVATAR
    this.rings = new Map()

    this.add
      .text(GAME_W / 2, 60, t('hero.create'), {
        fontSize: '27px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0.5)

    makePanel(this, GAME_W / 2, 162, 170, 132)
    this.preview = makeEmoji(this, GAME_W / 2, 158, `avatar_${this.selected}`, 76)
    ambientTween(this, { targets: this.preview, y: 150, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' })

    this.add
      .text(GAME_W / 2, 254, t('hero.chooseBuddy'), { fontSize: '15px', fontFamily: FONT.family, color: COLORS.textDim })
      .setOrigin(0.5)

    AVATAR_IDS.forEach((id, i) => {
      const { x, y } = this.slotPos(i)
      const ring = this.add.graphics()
      this.rings.set(id, ring)
      this.drawRing(ring, x, y, id === this.selected)

      const face = makeEmoji(this, x, y, `avatar_${id}`, 46)
      face.setInteractive({ useHandCursor: true })
      face.on('pointerdown', () => this.select(id))
      face.on('pointerover', () => this.tweens.add({ targets: face, scale: face.scale * 1.12, duration: 100 }))
      face.on('pointerout', () => this.tweens.add({ targets: face, scale: 46 / face.width, duration: 100 }))
    })

    this.add
      .text(GAME_W / 2, 456, t('hero.nameYours'), { fontSize: '15px', fontFamily: FONT.family, color: COLORS.textDim })
      .setOrigin(0.5)

    const inputStyle =
      "padding:10px 14px;font-size:16px;text-align:center;border-radius:14px;border:2px solid #f3d9e5;background:#fff;color:#5d4a66;outline:none;font-family:'Fredoka','Trebuchet MS',sans-serif;width:200px"
    const dom = this.add
      .dom(GAME_W / 2, 496)
      .createFromHTML(`<input id="hero-name" type="text" maxlength="14" placeholder="${t('hero.namePlaceholder')}" style="${inputStyle}" />`)
    const nameInput = dom.getChildByID('hero-name') as HTMLInputElement

    makeButton(
      this,
      GAME_W / 2,
      574,
      t('hero.start'),
      () => {
        void this.startGame(nameInput.value)
      },
      { minWidth: 250, icon: 'icon_levelup' },
    )
  }

  private drawRing(ring: Phaser.GameObjects.Graphics, x: number, y: number, selected: boolean): void {
    ring.clear()
    ring.fillStyle(selected ? COLORS.primary : COLORS.panel, selected ? 0.28 : 1)
    ring.fillCircle(x, y, 34)
    ring.lineStyle(3, selected ? COLORS.primary : COLORS.panelStroke, 1)
    ring.strokeCircle(x, y, 34)
  }

  private select(id: AvatarId): void {
    this.selected = id
    this.preview.setTexture(`avatar_${id}`).setDisplaySize(76, 76)
    AVATAR_IDS.forEach((other, i) => {
      const { x, y } = this.slotPos(i)
      this.drawRing(this.rings.get(other)!, x, y, other === id)
    })
  }

  private async startGame(rawName: string): Promise<void> {
    const name = rawName.trim().slice(0, 14) || 'Hero'
    const state = createDefaultPlayerState(name, this.selected)
    GameState.player = await persist(state, GameState.userId)
    this.scene.start('MainMenu')
  }
}
