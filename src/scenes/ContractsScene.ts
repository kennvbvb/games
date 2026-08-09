import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { GameState } from '../state/GameState'
import { persist } from '../services/saveService'
import {
  CONTRACTS_TO_CLEAR,
  CONTRACT_GRACE_WEEKS,
  CONTRACT_REWARD,
  MS_PER_WEEK,
  contractWeek,
} from '../data/contracts'
import { PLAN_BY_ID } from '../data/battlePlans'
import { traitOf } from '../data/enemyTraits'
import { claimContracts, claimableWeeks, clearedThisWeek, contractViews } from '../systems/contracts'
import { formatDuration } from '../systems/idle'
import { makeBar } from '../ui/components/makeBar'
import { makeButton } from '../ui/components/makeButton'
import { makeEmoji } from '../ui/components/makeEmoji'
import { makePanel } from '../ui/components/makePanel'
import { makeTitle } from '../ui/components/makeTitle'
import { COLORS, FONT } from '../ui/styles'
import type { ContractView } from '../systems/contracts'
import { t } from '../i18n'

const ROW_TOP = 236
const ROW_GAP = 96
const ROW_H = 84

/**
 * Weekly Contracts: three jobs, shown whole on one screen.
 *
 * No list and no paging — there are exactly three, and hiding any of them
 * behind a page would defeat the point of offering three to require two. The
 * player has to be able to see all three at once to decide which one to ignore.
 */
export class ContractsScene extends Phaser.Scene {
  constructor() {
    super('Contracts')
  }

  create(): void {
    setupScene(this)
    const player = GameState.player!

    makeTitle(this, 42, t('contracts.title'), 'icon_star', { fontSize: '22px', iconSize: 20 })

    const views = contractViews(player)
    const done = clearedThisWeek(player)
    const owed = claimableWeeks(player)

    this.add
      .text(GAME_W / 2, 76, t('contracts.subtitle'), {
        fontSize: '11px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
        align: 'center',
        wordWrap: { width: 420 },
      })
      .setOrigin(0.5)

    this.add
      .text(GAME_W / 2, 108, t('contracts.progress', { done, need: CONTRACTS_TO_CLEAR }), {
        fontSize: '15px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: done >= CONTRACTS_TO_CLEAR ? COLORS.success : COLORS.text,
      })
      .setOrigin(0.5)
    makeBar(this, GAME_W / 2, 130, 320, 9, COLORS.expBar).set(Math.min(1, done / CONTRACTS_TO_CLEAR))

    const untilNext = (contractWeek() + 1) * MS_PER_WEEK - Date.now()
    this.add
      .text(GAME_W / 2, 156, t('contracts.rotates', { duration: formatDuration(untilNext) }), {
        fontSize: '10px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)
    this.add
      .text(GAME_W / 2, 178, t('contracts.grace', { weeks: CONTRACT_GRACE_WEEKS }), {
        fontSize: '10px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
        align: 'center',
        wordWrap: { width: 420 },
      })
      .setOrigin(0.5)
    views.forEach((view, i) => this.renderContract(view, ROW_TOP + i * ROW_GAP))

    makeButton(
      this,
      GAME_W / 2,
      556,
      owed.length > 1 ? t('contracts.claimMany', { count: owed.length }) : owed.length === 1 ? t('contracts.claimOne') : t('contracts.nothing'),
      () => this.claim(),
      {
        variant: owed.length > 0 ? 'primary' : 'secondary',
        disabled: owed.length === 0,
        minWidth: 280,
        minHeight: 52,
        fontSize: '15px',
        icon: 'icon_gold',
      },
    )

    this.add
      .text(GAME_W / 2, 592, t('contracts.reward', { gold: CONTRACT_REWARD.gold, exp: CONTRACT_REWARD.exp }), {
        fontSize: '10px',
        fontFamily: FONT.family,
        color: COLORS.gold,
      })
      .setOrigin(0.5)

    makeButton(this, GAME_W / 2, 640, t('common.back'), () => this.scene.start('MainMenu'), {
      variant: 'secondary',
      minWidth: 180,
      minHeight: 46,
      fontSize: '15px',
    })
  }

  private renderContract(view: ContractView, y: number): void {
    const { config, count, done } = view
    makePanel(this, GAME_W / 2, y, 440, ROW_H)
    makeEmoji(this, 50, y - 8, done ? 'icon_star' : 'icon_bolt', 24)

    this.add
      .text(82, y - 18, this.label(view), {
        fontSize: '13px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: done ? COLORS.success : COLORS.text,
        wordWrap: { width: 340 },
      })
      .setOrigin(0, 0.5)

    makeBar(this, GAME_W / 2, y + 14, 380, 8, done ? COLORS.hpBar : COLORS.expBar).set(
      config.target > 0 ? count / config.target : 0,
    )
    this.add
      .text(GAME_W / 2, y + 30, done ? t('contracts.done') : `${count} / ${config.target}`, {
        fontSize: '10px',
        fontFamily: FONT.family,
        color: done ? COLORS.success : COLORS.textDim,
      })
      .setOrigin(0.5)
  }

  /** One label per kind, filled from whichever field that kind uses. */
  private label(view: ContractView): string {
    const { config } = view
    return t(config.labelKey, {
      target: config.target,
      plan: config.plan ? t(PLAN_BY_ID.get(config.plan)!.nameKey) : '',
      trait: config.trait ? t(traitOf(config.trait).nameKey) : '',
      percent: Math.round((config.healthAbove ?? 0) * 100),
    })
  }

  private claim(): void {
    const next = claimContracts(GameState.player!)
    GameState.player = next
    void persist(next, GameState.userId).then((stamped) => {
      GameState.player = stamped
    })
    this.scene.restart()
  }
}
