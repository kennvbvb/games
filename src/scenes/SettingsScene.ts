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

const SPEEDS: BattleSpeed[] = [1, 2, 4]

interface ToggleRow {
  key: Exclude<keyof GameSettings, 'battleSpeed'>
  label: string
  hint: string
}

const TOGGLES: ToggleRow[] = [
  { key: 'skipCleared', label: 'Skip cleared stages', hint: 'Jump to the result on stages you have already beaten' },
  { key: 'autoAdvance', label: 'Auto-advance', hint: 'Move to the next stage during an auto-battle streak' },
  { key: 'reducedMotion', label: 'Reduce motion', hint: 'Turn off bobbing, drifting and pulsing effects' },
]

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('Settings')
  }

  create(): void {
    setupScene(this)
    const player = GameState.player!
    makeTitle(this, 46, 'Settings', 'icon_bolt')

    makePanel(this, GAME_W / 2, 132, 430, 84)
    this.add
      .text(66, 108, 'Battle speed', {
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
        .text(66, y - 16, row.label, {
          fontSize: '16px',
          fontFamily: FONT.family,
          fontStyle: 'bold',
          color: COLORS.text,
        })
        .setOrigin(0, 0.5)
      this.add
        .text(66, y + 12, row.hint, {
          fontSize: '12px',
          fontFamily: FONT.family,
          color: COLORS.textDim,
          wordWrap: { width: 260 },
        })
        .setOrigin(0, 0.5)
      makeButton(this, 372, y, on ? 'On' : 'Off', () => this.applySetting({ [row.key]: !on } as Partial<GameSettings>), {
        variant: on ? 'primary' : 'secondary',
        minWidth: 88,
        fontSize: '15px',
        minHeight: 50,
      })
    })

    this.add
      .text(GAME_W / 2, 534, 'Tip: use Tab and arrow keys to move, Enter to select', {
        fontSize: '12px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)

    makeButton(this, GAME_W / 2, 584, 'Back', () => this.scene.start('MainMenu'), {
      variant: 'secondary',
      minWidth: 180,
      fontSize: '15px',
    })
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
