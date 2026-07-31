import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { GameState } from '../state/GameState'
import { persist } from '../services/saveService'
import { makeButton } from '../ui/components/makeButton'
import { makePanel } from '../ui/components/makePanel'
import { makeTitle } from '../ui/components/makeTitle'
import { setReducedMotionPreference } from '../ui/motion'
import { COLORS, FONT } from '../ui/styles'
import type { BattleSpeed, GameSettings, PlayerState } from '../types'
import { LOCALES, LOCALE_LABELS, setLocale, t, type Locale, type MessageKey } from '../i18n'

const SPEEDS: BattleSpeed[] = [1, 2, 4]

interface ToggleRow {
  key: Exclude<keyof GameSettings, 'battleSpeed' | 'locale'>
  labelKey: MessageKey
  hintKey: MessageKey
}

// Message keys, not strings: this list is built once at import time, so holding
// translated text here would freeze it at whichever locale loaded first.
const TOGGLES: ToggleRow[] = [
  { key: 'skipCleared', labelKey: 'settings.skipCleared', hintKey: 'settings.skipClearedHint' },
  { key: 'autoAdvance', labelKey: 'settings.autoAdvance', hintKey: 'settings.autoAdvanceHint' },
  { key: 'reducedMotion', labelKey: 'settings.reducedMotion', hintKey: 'settings.reducedMotionHint' },
]

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('Settings')
  }

  create(): void {
    setupScene(this)
    const player = GameState.player!
    makeTitle(this, 46, t('settings.title'), 'icon_bolt')

    makePanel(this, GAME_W / 2, 132, 430, 84)
    this.add
      .text(66, 108, t('settings.battleSpeed'), {
        fontSize: '16px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0, 0.5)
    SPEEDS.forEach((speed, i) => {
      makeButton(this, 300 + i * 62, 140, `×${speed}`, () => this.applySetting({ battleSpeed: speed }), {
        variant: player.settings.battleSpeed === speed ? 'primary' : 'secondary',
        minWidth: 56,
        fontSize: '14px',
        minHeight: 48,
      })
    })

    TOGGLES.forEach((row, i) => {
      const y = 236 + i * 96
      const on = player.settings[row.key]
      makePanel(this, GAME_W / 2, y, 430, 84)
      this.add
        .text(66, y - 16, t(row.labelKey), {
          fontSize: '16px',
          fontFamily: FONT.family,
          fontStyle: 'bold',
          color: COLORS.text,
        })
        .setOrigin(0, 0.5)
      this.add
        .text(66, y + 12, t(row.hintKey), {
          fontSize: '12px',
          fontFamily: FONT.family,
          color: COLORS.textDim,
          wordWrap: { width: 260 },
        })
        .setOrigin(0, 0.5)
      makeButton(this, 372, y, on ? t('settings.on') : t('settings.off'), () => this.applySetting({ [row.key]: !on } as Partial<GameSettings>), {
        variant: on ? 'primary' : 'secondary',
        minWidth: 88,
        fontSize: '15px',
        minHeight: 50,
      })
    })

    const langY = 236 + TOGGLES.length * 96
    makePanel(this, GAME_W / 2, langY, 430, 84)
    this.add
      .text(66, langY - 16, t('settings.language'), {
        fontSize: '16px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0, 0.5)
    this.add
      .text(66, langY + 12, t('settings.languageHint'), {
        fontSize: '12px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
        wordWrap: { width: 240 },
      })
      .setOrigin(0, 0.5)
    LOCALES.forEach((locale, i) => {
      makeButton(this, 330 + i * 78, langY, LOCALE_LABELS[locale], () => this.applyLocale(locale), {
        variant: player.settings.locale === locale ? 'primary' : 'secondary',
        minWidth: 70,
        fontSize: '14px',
        minHeight: 50,
      })
    })

    this.add
      .text(GAME_W / 2, 630, t('settings.keyboardHint'), {
        fontSize: '12px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)

    makeButton(this, GAME_W / 2, 672, t('common.back'), () => this.scene.start('MainMenu'), {
      variant: 'secondary',
      minWidth: 180,
      fontSize: '15px',
    })
  }

  /** Language changes take effect immediately, so the scene redraws translated. */
  private applyLocale(locale: Locale): void {
    setLocale(locale)
    this.applySetting({ locale })
  }

  private applySetting(patch: Partial<GameSettings>): void {
    const player = GameState.player!
    const next: PlayerState = { ...player, settings: { ...player.settings, ...patch } }
    // Keep the motion module in step so the change applies on this very redraw.
    if (patch.reducedMotion !== undefined) setReducedMotionPreference(patch.reducedMotion)
    GameState.player = next
    void persist(next, GameState.userId).then((stamped) => {
      GameState.player = stamped
    })
    this.scene.restart()
  }
}
