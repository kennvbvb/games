import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { GameState } from '../state/GameState'
import { persist } from '../services/saveService'
import {
  BONUS_CAP,
  HP_PER_ASCENSION,
  OUTGOING_PER_ASCENSION,
  ascend,
  bonusAscensions,
  canAscend,
} from '../systems/ascension'
import { makeButton } from '../ui/components/makeButton'
import { makeEmoji } from '../ui/components/makeEmoji'
import { makePanel } from '../ui/components/makePanel'
import { makeTitle } from '../ui/components/makeTitle'
import { COLORS, FONT } from '../ui/styles'
import { t } from '../i18n'

/**
 * The ascension confirmation.
 *
 * A whole screen for one button, because the button throws away a hundred
 * stages of progress and cannot be taken back. Everything it will destroy and
 * everything it will keep is listed in full before the player commits, and the
 * confirm is a second tap rather than the first — the same reasoning as the
 * Test Lab's apply token, for the same reason: an irreversible action reached
 * by a single tap is an irreversible action people take by accident.
 */
interface AscendSceneData {
  /** Carried across the restart that redraws the armed state. */
  confirming?: boolean
}

export class AscendScene extends Phaser.Scene {
  private confirming = false

  constructor() {
    super('Ascend')
  }

  // Phaser calls init on every restart, so the flag has to travel in the scene
  // data. Resetting it here unconditionally is what made the first tap look
  // like it did nothing: the restart that redraws the armed state immediately
  // disarmed it again.
  init(data: AscendSceneData): void {
    this.confirming = data.confirming === true
  }

  create(): void {
    setupScene(this)
    const player = GameState.player!
    const next = bonusAscensions(player) + 1
    const capped = bonusAscensions(player) >= BONUS_CAP

    makeTitle(this, 46, t('ascend.title'), 'icon_levelup', { fontSize: '24px', iconSize: 21 })
    this.add
      .text(GAME_W / 2, 80, t('ascend.count', { count: player.ascension.count }), {
        fontSize: '13px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.gold,
      })
      .setOrigin(0.5)

    // What it costs, stated first and in full. A confirmation that leads with
    // the reward is a confirmation designed to be clicked through.
    makePanel(this, GAME_W / 2, 200, 440, 150)
    makeEmoji(this, 52, 152, 'icon_defeat', 24)
    this.add
      .text(84, 152, t('ascend.losesTitle'), {
        fontSize: '15px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.danger,
      })
      .setOrigin(0, 0.5)
    this.add
      .text(52, 210, t('ascend.loses'), {
        fontSize: '12px',
        fontFamily: FONT.family,
        color: COLORS.text,
        wordWrap: { width: 380 },
        lineSpacing: 3,
      })
      .setOrigin(0, 0.5)

    makePanel(this, GAME_W / 2, 366, 440, 150)
    makeEmoji(this, 52, 318, 'icon_star', 24)
    this.add
      .text(84, 318, t('ascend.keepsTitle'), {
        fontSize: '15px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.success,
      })
      .setOrigin(0, 0.5)
    this.add
      .text(52, 376, t('ascend.keeps'), {
        fontSize: '12px',
        fontFamily: FONT.family,
        color: COLORS.text,
        wordWrap: { width: 380 },
        lineSpacing: 3,
      })
      .setOrigin(0, 0.5)

    this.add
      .text(
        GAME_W / 2,
        474,
        capped
          ? t('ascend.gainCapped', { cap: BONUS_CAP })
          : t('ascend.gain', {
              damage: Math.round(OUTGOING_PER_ASCENSION * next * 100),
              health: Math.round(HP_PER_ASCENSION * next * 100),
            }),
        {
          fontSize: '13px',
          fontFamily: FONT.family,
          fontStyle: 'bold',
          color: capped ? COLORS.textDim : COLORS.success,
          align: 'center',
          wordWrap: { width: 420 },
        },
      )
      .setOrigin(0.5)

    if (!canAscend(player)) {
      this.add
        .text(GAME_W / 2, 520, t('ascend.notYet'), {
          fontSize: '12px',
          fontFamily: FONT.family,
          color: COLORS.danger,
          align: 'center',
          wordWrap: { width: 400 },
        })
        .setOrigin(0.5)
    } else if (this.confirming) {
      this.add
        .text(GAME_W / 2, 520, t('ascend.sure'), {
          fontSize: '13px',
          fontFamily: FONT.family,
          fontStyle: 'bold',
          color: COLORS.danger,
          align: 'center',
          wordWrap: { width: 400 },
        })
        .setOrigin(0.5)
    }

    makeButton(
      this,
      GAME_W / 2,
      582,
      this.confirming ? t('ascend.confirm') : t('ascend.begin'),
      () => this.press(),
      {
        variant: this.confirming ? 'primary' : 'secondary',
        disabled: !canAscend(player),
        minWidth: 280,
        minHeight: 54,
        fontSize: '16px',
      },
    )
    makeButton(this, GAME_W / 2, 656, t('common.back'), () => this.scene.start('StageSelect'), {
      variant: 'secondary',
      minWidth: 180,
      minHeight: 46,
      fontSize: '15px',
    })
  }

  private press(): void {
    if (!this.confirming) {
      this.scene.restart({ confirming: true })
      return
    }
    const next = ascend(GameState.player!)
    GameState.player = next
    GameState.stagePage = -1
    GameState.stopAutoBattle()
    void persist(next, GameState.userId).then((stamped) => {
      GameState.player = stamped
    })
    this.scene.start('MainMenu')
  }
}
