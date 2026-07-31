import Phaser from 'phaser'
import { GAME_W, GAME_H, setupScene } from '../config/layout'
import EMOJI_ASSETS from '../data/emojiAssets.json'
import { COLORS, FONT } from '../ui/styles'
import { t } from '../i18n'

/** Texture keys available after this scene runs — every key in the manifest. */
export type EmojiKey = keyof typeof EMOJI_ASSETS

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload')
  }

  preload(): void {
    setupScene(this)

    const barW = 260
    const barH = 16
    const cx = GAME_W / 2
    const cy = GAME_H / 2

    this.add
      .text(cx, cy - 60, t('app.loading'), {
        fontSize: '22px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0.5)

    const bar = this.add.graphics()
    const drawBar = (pct: number) => {
      bar.clear()
      bar.fillStyle(COLORS.barBg, 1).fillRoundedRect(cx - barW / 2, cy - barH / 2, barW, barH, barH / 2)
      if (pct > 0) {
        bar
          .fillStyle(COLORS.primary, 1)
          .fillRoundedRect(cx - barW / 2, cy - barH / 2, Math.max(barH, barW * pct), barH, barH / 2)
      }
    }
    drawBar(0)
    this.load.on('progress', drawBar)

    const base = import.meta.env.BASE_URL
    for (const key of Object.keys(EMOJI_ASSETS)) {
      this.load.image(key, `${base}assets/emoji/${key}.png`)
    }
  }

  async create(): Promise<void> {
    // Phaser measures text against whatever font is ready at draw time, so make
    // sure Fredoka has actually arrived before any scene lays out its labels.
    try {
      await Promise.all([
        document.fonts.load('700 16px Fredoka'),
        document.fonts.load('400 16px Fredoka'),
        // Thai glyphs come from Mitr, so it has to be ready too.
        document.fonts.load('600 16px Mitr', 'ก'),
        document.fonts.load('400 16px Mitr', 'ก'),
      ])
    } catch {
      // Non-fatal: the CSS stack falls back to Trebuchet MS.
    }
    this.scene.start('Auth')
  }
}
