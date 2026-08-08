import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { GameState } from '../state/GameState'
import { WORLDS } from '../data/worlds'
import { REMIX_TIERS } from '../data/bossRemix'
import { ITEM_BY_ID } from '../data/items'
import { traitOf } from '../data/enemyTraits'
import {
  canFightRemix,
  pendingRemixRelic,
  remixConfig,
  remixRelicsWon,
  remixUnlocked,
  tierUnlocked,
  unlockedRemixWorlds,
} from '../systems/bossRemix'
import { stageOutlook } from '../systems/difficulty'
import { makeButton } from '../ui/components/makeButton'
import { makeEmoji } from '../ui/components/makeEmoji'
import { makePanel } from '../ui/components/makePanel'
import { makeTitle } from '../ui/components/makeTitle'
import { COLORS, FONT } from '../ui/styles'
import type { RemixTierId } from '../data/bossRemix'
import type { PlayerState } from '../types'
import { t } from '../i18n'

interface RemixSceneData {
  tier?: RemixTierId
  page?: number
}

const ROWS = 4
const ROW_TOP = 268
const ROW_GAP = 76
const ROW_H = 68

/**
 * Boss Remix: the bosses already beaten, offered back at three difficulties.
 *
 * Laid out tier-first rather than boss-first. A player comes here having
 * decided how hard a fight they want, and the tier is what changes the build
 * they should bring; scrolling twenty bosses inside each tier is the cheaper
 * axis to paginate.
 */
export class RemixScene extends Phaser.Scene {
  private tier: RemixTierId = 'normal'
  private page = 0

  constructor() {
    super('Remix')
  }

  init(data: RemixSceneData): void {
    this.tier = data.tier ?? 'normal'
    this.page = data.page ?? 0
  }

  create(): void {
    setupScene(this)
    const player = GameState.player!

    makeTitle(this, 42, t('remix.title'), 'decor_skull', { fontSize: '23px', iconSize: 20 })

    if (!remixUnlocked(player)) {
      this.renderLocked()
      return
    }

    this.add
      .text(GAME_W / 2, 76, t('remix.relicsWon', { won: remixRelicsWon(player), total: 6 }), {
        fontSize: '12px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)

    this.renderTiers(player)

    const worlds = unlockedRemixWorlds(player)
    const pages = Math.max(1, Math.ceil(worlds.length / ROWS))
    const page = Math.min(Math.max(this.page, 0), pages - 1)
    const shown = worlds.slice(page * ROWS, (page + 1) * ROWS)
    shown.forEach((world, i) => this.renderBoss(player, world, ROW_TOP + i * ROW_GAP))

    if (pages > 1) {
      makeButton(this, GAME_W / 2 - 110, 592, '◀', () => this.scene.restart({ tier: this.tier, page: page - 1 }), {
        variant: 'secondary',
        disabled: page === 0,
        minWidth: 64,
        minHeight: 46,
        fontSize: '16px',
      })
      this.add
        .text(GAME_W / 2, 592, `${page + 1} / ${pages}`, {
          fontSize: '13px',
          fontFamily: FONT.family,
          color: COLORS.textDim,
        })
        .setOrigin(0.5)
      makeButton(this, GAME_W / 2 + 110, 592, '▶', () => this.scene.restart({ tier: this.tier, page: page + 1 }), {
        variant: 'secondary',
        disabled: page >= pages - 1,
        minWidth: 64,
        minHeight: 46,
        fontSize: '16px',
      })
    }

    makeButton(this, GAME_W / 2, 660, t('common.back'), () => this.scene.start('MainMenu'), {
      variant: 'secondary',
      minWidth: 180,
      minHeight: 46,
      fontSize: '15px',
    })
  }

  /** Three tiers across one row; a locked one says what opens it. */
  private renderTiers(player: PlayerState): void {
    REMIX_TIERS.forEach((tier, i) => {
      const open = tierUnlocked(player, tier)
      const x = 88 + i * 152
      makeButton(
        this,
        x,
        128,
        t(tier.nameKey),
        () => this.scene.restart({ tier: tier.id, page: 0 }),
        {
          variant: this.tier === tier.id ? 'primary' : 'secondary',
          disabled: !open,
          minWidth: 138,
          minHeight: 48,
          fontSize: '14px',
        },
      )
    })

    const tier = REMIX_TIERS.find((entry) => entry.id === this.tier)!
    const open = tierUnlocked(player, tier)
    this.add
      .text(
        GAME_W / 2,
        176,
        // Veteran and Mythic are not the multiplier they carry: their stat
        // floors are what actually applies at every boss worth fighting, so
        // quoting the multiplier would print a number the fight does not use.
        open
          ? tier.atkFloor
            ? t('remix.tierHintAnchored')
            : t('remix.tierHint', {
                hp: Math.round((tier.hp - 1) * 100),
                atk: Math.round((tier.atk - 1) * 100),
              })
          : t('remix.tierLocked', { worlds: tier.unlockWorlds }),
        {
          fontSize: '11px',
          fontFamily: FONT.family,
          color: open ? COLORS.textDim : COLORS.danger,
          align: 'center',
          wordWrap: { width: 420 },
        },
      )
      .setOrigin(0.5)

    this.add
      .text(GAME_W / 2, 206, t('remix.pairHint'), {
        fontSize: '11px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
        align: 'center',
        wordWrap: { width: 420 },
      })
      .setOrigin(0.5)
  }

  private renderBoss(player: PlayerState, world: number, y: number): void {
    const stage = remixConfig(world, this.tier)
    const open = canFightRemix(player, world, this.tier)
    const relic = pendingRemixRelic(player, world, this.tier)

    makePanel(this, GAME_W / 2, y, 440, ROW_H)
    makeEmoji(this, 48, y, open ? stage.enemy.sprite : 'icon_lock', 28)

    const name = this.add
      .text(80, y - 14, stage.enemy.name, {
        fontSize: '14px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: open ? COLORS.text : COLORS.textDisabled,
      })
      .setOrigin(0, 0.5)
    this.add
      .text(name.x + name.width + 10, y - 13, t(WORLDS[world - 1].nameKey), {
        fontSize: '9px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0, 0.5)

    if (relic) {
      this.add
        .text(332, y - 14, `★ ${ITEM_BY_ID.get(relic)!.name}`, {
          fontSize: '9px',
          fontFamily: FONT.family,
          fontStyle: 'bold',
          color: COLORS.gold,
        })
        .setOrigin(1, 0.5)
    }

    // The same real simulation the campaign, tower and rift cards run — the
    // forecast has to match the fight, and there is only one way to do that.
    let subtitle = t('remix.sealed')
    let colour: string = COLORS.textDisabled
    if (open) {
      const outlook = stageOutlook(player, stage)
      const trait = t(traitOf(stage.enemy.trait).nameKey)
      subtitle = outlook.willWin
        ? `${trait} · ${t('stages.outlook', { tier: t(`stages.${outlook.tier}`), hp: Math.round(outlook.hpRemaining * 100) })}`
        : `${trait} · ${t('stages.outlookLose')}`
      colour = outlook.willWin ? COLORS.textDim : COLORS.danger
    }
    this.add
      .text(80, y + 12, subtitle, {
        fontSize: '10px',
        fontFamily: FONT.family,
        color: colour,
        wordWrap: { width: 240 },
      })
      .setOrigin(0, 0.5)

    makeButton(
      this,
      386,
      y,
      t('remix.fight'),
      () => {
        GameState.selectedStage = stage
        this.scene.start('PrepareBattle')
      },
      { disabled: !open, minWidth: 92, minHeight: 46, fontSize: '13px' },
    )
  }

  private renderLocked(): void {
    makePanel(this, GAME_W / 2, 300, 420, 180)
    makeEmoji(this, GAME_W / 2, 250, 'icon_lock', 46)
    this.add
      .text(GAME_W / 2, 316, t('remix.locked'), {
        fontSize: '15px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
        align: 'center',
        wordWrap: { width: 380 },
      })
      .setOrigin(0.5)
    this.add
      .text(GAME_W / 2, 356, t('remix.lockedHint'), {
        fontSize: '12px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
        align: 'center',
        wordWrap: { width: 380 },
      })
      .setOrigin(0.5)
    makeButton(this, GAME_W / 2, 440, t('common.back'), () => this.scene.start('MainMenu'), {
      variant: 'secondary',
      minWidth: 180,
      minHeight: 46,
      fontSize: '15px',
    })
  }
}
