import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { GameState } from '../state/GameState'
import { resolveConflict } from '../services/saveService'
import { summarize, suggestedSource } from '../systems/conflict'
import { formatDuration } from '../systems/idle'
import { STAGES } from '../data/stages'
import { makeButton } from '../ui/components/makeButton'
import { makePanel } from '../ui/components/makePanel'
import { makeEmoji } from '../ui/components/makeEmoji'
import { makeTitle } from '../ui/components/makeTitle'
import { COLORS, FONT } from '../ui/styles'
import type { ResolutionSource } from '../systems/conflict'
import type { PlayerState } from '../types'
import { t } from '../i18n'

export interface ConflictSceneData {
  local: PlayerState
  cloud: PlayerState
}

const CARD_YS: Record<ResolutionSource, number> = { local: 250, cloud: 436 }
const CARD_H = 168

/**
 * Shown when two devices both played on from the same point. There is no merge
 * on offer: combining divergent saves would invent a state neither device ever
 * had. The player picks one, and the other is kept as a backup.
 */
export class ConflictScene extends Phaser.Scene {
  private local!: PlayerState
  private cloud!: PlayerState

  constructor() {
    super('Conflict')
  }

  init(data: ConflictSceneData): void {
    this.local = data.local
    this.cloud = data.cloud
  }

  create(): void {
    setupScene(this)
    const suggested = suggestedSource(this.local, this.cloud)

    makeTitle(this, 62, t('conflict.title'), 'icon_cloud')
    this.add
      .text(GAME_W / 2, 108, t('conflict.explain'), {
        fontSize: '13px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
        align: 'center',
        wordWrap: { width: 400 },
      })
      .setOrigin(0.5)

    this.renderCard('local', this.local, suggested === 'local')
    this.renderCard('cloud', this.cloud, suggested === 'cloud')

    this.add
      .text(GAME_W / 2, 574, t('conflict.backupNote'), {
        fontSize: '11px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
        align: 'center',
        wordWrap: { width: 400 },
      })
      .setOrigin(0.5)
  }

  private renderCard(source: ResolutionSource, state: PlayerState, suggested: boolean): void {
    const y = CARD_YS[source]
    const info = summarize(state)
    makePanel(this, GAME_W / 2, y, 430, CARD_H)
    const top = y - CARD_H / 2

    makeEmoji(this, 66, top + 32, `avatar_${info.avatar}`, 34)
    const heading = this.add
      .text(96, top + 24, t(source === 'local' ? 'conflict.thisDevice' : 'conflict.cloudCopy'), {
        fontSize: '16px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0, 0.5)

    if (suggested) {
      this.add
        .text(heading.x + heading.width + 10, top + 24, t('conflict.furthest'), {
          fontSize: '11px',
          fontFamily: FONT.family,
          fontStyle: 'bold',
          color: COLORS.success,
        })
        .setOrigin(0, 0.5)
    }

    this.add
      .text(96, top + 48, `${info.name}  ·  Lv ${info.level}`, {
        fontSize: '14px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0, 0.5)

    this.add
      .text(
        66,
        top + 78,
        `${t('conflict.stages', { cleared: info.stagesCleared, total: STAGES.length })}   ·   ${t('conflict.gold', {
          gold: info.gold,
        })}`,
        { fontSize: '13px', fontFamily: FONT.family, color: COLORS.text },
      )
      .setOrigin(0, 0.5)

    this.add
      .text(66, top + 100, this.lastPlayed(info.updatedAt), {
        fontSize: '11px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0, 0.5)

    makeButton(
      this,
      GAME_W / 2,
      top + 136,
      t(source === 'local' ? 'conflict.keepThis' : 'conflict.keepCloud'),
      () => {
        void this.choose(source)
      },
      { variant: suggested ? 'primary' : 'secondary', minWidth: 260, fontSize: '15px', minHeight: 52 },
    )
  }

  private lastPlayed(at: number): string {
    if (at === 0) return t('conflict.lastPlayedUnknown')
    const ago = Date.now() - at
    if (ago < 60_000) return t('conflict.lastPlayedJustNow')
    return t('conflict.lastPlayed', { duration: formatDuration(ago) })
  }

  private async choose(source: ResolutionSource): Promise<void> {
    const keep = source === 'local' ? this.local : this.cloud
    const discard = source === 'local' ? this.cloud : this.local
    const resolved = await resolveConflict(GameState.userId!, keep, discard)
    GameState.player = resolved
    this.scene.start('MainMenu')
  }
}
