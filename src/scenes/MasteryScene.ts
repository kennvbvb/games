import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { GameState } from '../state/GameState'
import { persist } from '../services/saveService'
import { raceOf } from '../data/races'
import { relicsForRace } from '../data/relics'
import {
  MAX_MASTERY_RANK,
  equipRelic,
  masteryProgress,
  rankModifiers,
  unequipRelic,
} from '../systems/mastery'
import { makeBar } from '../ui/components/makeBar'
import { makeButton } from '../ui/components/makeButton'
import { makeEmoji } from '../ui/components/makeEmoji'
import { makePanel } from '../ui/components/makePanel'
import { makeTitle } from '../ui/components/makeTitle'
import { COLORS, FONT } from '../ui/styles'
import type { RelicConfig } from '../data/relics'
import type { PlayerState } from '../types'
import { t } from '../i18n'

const CARD_YS = [298, 410, 522]
const CARD_H = 104

/**
 * The mastery track for the kin the player chose.
 *
 * Everything on this screen except the relic choice is read-only, and that is
 * the point: mastery is the one progression the player cannot spend their way
 * along, so the page is mostly a record of miles walked. Showing the rank ramp
 * as plain numbers rather than hiding it keeps that honest — a bonus the player
 * cannot see is a bonus they cannot plan around.
 */
export class MasteryScene extends Phaser.Scene {
  constructor() {
    super('Mastery')
  }

  create(): void {
    setupScene(this)
    const player = GameState.player!
    const race = raceOf(player.raceId)
    const progress = masteryProgress(player)

    makeTitle(this, 40, t('mastery.title'), 'icon_levelup', { fontSize: '22px', iconSize: 19 })
    this.add
      .text(GAME_W / 2, 72, t('mastery.kinRank', { kin: t(race.nameKey), rank: progress.rank, max: MAX_MASTERY_RANK }), {
        fontSize: '13px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.gold,
      })
      .setOrigin(0.5)

    makePanel(this, GAME_W / 2, 130, 440, 96)
    makeBar(this, GAME_W / 2, 112, 380, 14, COLORS.expBar).set(progress.fraction)
    // Counted from the start of the current rank rather than from zero, so the
    // number matches the bar beside it. Total-against-total reads as two thirds
    // of the way there on a bar that has just reset to empty.
    this.add
      .text(
        GAME_W / 2,
        138,
        progress.nextAt === null
          ? t('mastery.capped', { xp: progress.xp })
          : t('mastery.toNext', {
              xp: progress.xp - progress.rankStart,
              next: progress.nextAt - progress.rankStart,
            }),
        { fontSize: '12px', fontFamily: FONT.family, color: COLORS.textDim },
      )
      .setOrigin(0.5)

    // Percentages rather than the raw multipliers: nobody reads x1.015^7 as
    // "eleven percent", and eleven percent is the number that decides a fight.
    const mods = rankModifiers(progress.rank)
    const dealt = Math.round((mods.outgoing! - 1) * 1000) / 10
    const taken = Math.round((1 - mods.incoming!) * 1000) / 10
    this.add
      .text(GAME_W / 2, 162, t('mastery.ramp', { dealt, taken }), {
        fontSize: '12px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.success,
      })
      .setOrigin(0.5)

    this.add
      .text(GAME_W / 2, 198, t('mastery.howToEarn'), {
        fontSize: '11px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
        align: 'center',
        wordWrap: { width: 424 },
      })
      .setOrigin(0.5)

    this.add
      .text(28, 240, t('mastery.relics'), {
        fontSize: '13px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0, 0.5)
    this.add
      .text(GAME_W - 28, 240, t('mastery.oneAtATime'), {
        fontSize: '10px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(1, 0.5)

    relicsForRace(player.raceId).forEach((relic, i) =>
      this.renderRelic(relic, CARD_YS[i], player, progress.rank),
    )

    makeButton(this, GAME_W / 2, 640, t('common.back'), () => this.scene.start('Character'), {
      variant: 'secondary',
      minWidth: 180,
      minHeight: 46,
      fontSize: '15px',
    })
  }

  private renderRelic(relic: RelicConfig, y: number, player: PlayerState, rank: number): void {
    const locked = relic.unlockRank > rank
    const equipped = player.equippedRelicId === relic.id
    const top = y - CARD_H / 2

    makePanel(this, GAME_W / 2, y, 440, CARD_H)
    makeEmoji(this, 54, y - 10, locked ? 'icon_lock' : relic.sprite, 30)
    this.add
      .text(54, y + 22, t('mastery.rankShort', { rank: relic.unlockRank }), {
        fontSize: '10px',
        fontFamily: FONT.family,
        color: locked ? COLORS.textDisabled : COLORS.textDim,
      })
      .setOrigin(0.5)

    const title = this.add
      .text(88, top + 24, t(relic.nameKey), {
        fontSize: '15px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: locked ? COLORS.textDisabled : COLORS.text,
      })
      .setOrigin(0, 0.5)

    if (equipped) {
      this.add
        .text(title.x + title.width + 10, top + 24, '●', {
          fontSize: '13px',
          fontFamily: FONT.family,
          color: COLORS.success,
        })
        .setOrigin(0, 0.5)
    }

    this.add
      .text(
        88,
        top + 56,
        locked ? t('mastery.locked', { rank: relic.unlockRank }) : t(relic.descriptionKey),
        {
          fontSize: '11px',
          fontFamily: FONT.family,
          color: COLORS.textDim,
          wordWrap: { width: 236 },
        },
      )
      .setOrigin(0, 0.5)

    makeButton(
      this,
      386,
      y,
      equipped ? t('mastery.remove') : t('mastery.carry'),
      () => this.toggle(relic, equipped),
      {
        variant: equipped ? 'secondary' : 'primary',
        disabled: locked,
        minWidth: 96,
        minHeight: 48,
        fontSize: '12px',
      },
    )
  }

  private toggle(relic: RelicConfig, equipped: boolean): void {
    const player = GameState.player!
    const next = equipped ? unequipRelic(player) : equipRelic(player, relic.id)
    GameState.player = next
    void persist(next, GameState.userId).then((stamped) => {
      GameState.player = stamped
    })
    this.scene.restart()
  }
}
