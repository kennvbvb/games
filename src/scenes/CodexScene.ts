import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { GameState } from '../state/GameState'
import {
  codexProgress,
  itemEntries,
  itemSummary,
  nextMilestone,
  relicEntries,
  setEntries,
  statusEntries,
  traitEntries,
} from '../systems/codex'
import { makeBar } from '../ui/components/makeBar'
import { makeButton } from '../ui/components/makeButton'
import { makeEmoji } from '../ui/components/makeEmoji'
import { makePanel } from '../ui/components/makePanel'
import { makeTitle } from '../ui/components/makeTitle'
import { COLORS, FONT } from '../ui/styles'
import type { PlayerState } from '../types'
import { t } from '../i18n'

interface CodexSceneData {
  tab?: number
  page?: number
}

/** One rendered row, whatever category it came from. */
interface Row {
  icon: string
  title: string
  body: string
  found: boolean
  hintKey: string
}

const ROWS_PER_PAGE = 5
const ROW_TOP = 200
const ROW_GAP = 74
const ROW_H = 66

/**
 * The Codex.
 *
 * Locked rows are shown rather than hidden, with a line saying what would
 * reveal them. A compendium that hides what you have not met cannot tell you
 * how much is left, and "how much is left" is most of why anyone opens one.
 */
export class CodexScene extends Phaser.Scene {
  private tab = 0
  private page = 0

  constructor() {
    super('Codex')
  }

  init(data: CodexSceneData): void {
    this.tab = data.tab ?? 0
    this.page = data.page ?? 0
  }

  create(): void {
    setupScene(this)
    const player = GameState.player!

    const tabs = [
      { label: t('codex.traits'), rows: this.traitRows(player) },
      { label: t('codex.statuses'), rows: this.statusRows(player) },
      { label: t('codex.sets'), rows: this.setRows(player) },
      { label: t('codex.relics'), rows: this.relicRows(player) },
      { label: t('codex.gear'), rows: this.gearRows(player) },
    ]
    const active = Math.min(Math.max(this.tab, 0), tabs.length - 1)
    this.tab = active
    const rows = tabs[active].rows
    const pages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE))
    const page = Math.min(Math.max(this.page, 0), pages - 1)
    this.page = page

    makeTitle(this, 40, t('codex.title'), 'icon_bag', { fontSize: '23px', iconSize: 20 })

    const progress = codexProgress(player)
    this.add
      .text(GAME_W / 2, 72, t('codex.progress', { found: progress.found, total: progress.total }), {
        fontSize: '13px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.gold,
      })
      .setOrigin(0.5)
    makeBar(this, GAME_W / 2, 94, 380, 10, COLORS.expBar).set(progress.found / progress.total)

    // What the next round number costs, rather than only how far along it is —
    // a completion track with no next target is just a percentage.
    const milestone = nextMilestone(progress)
    this.add
      .text(
        GAME_W / 2,
        112,
        milestone
          ? t('codex.milestone', {
              percent: Math.round(milestone.at * 100),
              remaining: milestone.remaining,
            })
          : t('codex.complete'),
        { fontSize: '10px', fontFamily: FONT.family, color: COLORS.textDim },
      )
      .setOrigin(0.5)

    // Four tabs across, each showing its own found count so the player can see
    // which category still has something in it without opening every one.
    tabs.forEach((tab, i) => {
      const found = tab.rows.filter((r) => r.found).length
      makeButton(this, 54 + i * 93, 140, `${tab.label} ${found}/${tab.rows.length}`, () =>
        this.scene.restart({ tab: i, page: 0 }),
      {
        variant: i === active ? 'primary' : 'secondary',
        minWidth: 87,
        minHeight: 44,
        fontSize: '10px',
      })
    })

    const slice = rows.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE)
    slice.forEach((row, i) => this.renderRow(row, ROW_TOP + i * ROW_GAP))

    // Paging buttons are named Previous/Next rather than Back: the Back below
    // leaves the Codex, and two buttons reading "Back" that do different things
    // is a trap the player only finds by falling into it.
    if (pages > 1) {
      makeButton(this, 120, 578, t('codex.prev'), () => this.scene.restart({ tab: active, page: page - 1 }), {
        variant: 'secondary',
        disabled: page === 0,
        minWidth: 110,
        minHeight: 46,
        fontSize: '13px',
      })
      this.add
        .text(240, 578, t('stages.page', { current: page + 1, total: pages }), {
          fontSize: '12px',
          fontFamily: FONT.family,
          color: COLORS.textDim,
        })
        .setOrigin(0.5)
      makeButton(this, 360, 578, t('codex.next'), () => this.scene.restart({ tab: active, page: page + 1 }), {
        variant: 'secondary',
        disabled: page >= pages - 1,
        minWidth: 110,
        minHeight: 46,
        fontSize: '13px',
      })
    }

    makeButton(this, GAME_W / 2, 648, t('common.back'), () => this.scene.start('MainMenu'), {
      variant: 'secondary',
      minWidth: 180,
      minHeight: 44,
      fontSize: '14px',
    })
  }

  private renderRow(row: Row, y: number): void {
    makePanel(this, GAME_W / 2, y, 440, ROW_H)
    makeEmoji(this, 48, y, row.found ? row.icon : 'icon_lock', 26)
    this.add
      .text(80, y - 13, row.found ? row.title : t('codex.unknown'), {
        fontSize: '14px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: row.found ? COLORS.text : COLORS.textDisabled,
      })
      .setOrigin(0, 0.5)
    this.add
      .text(80, y + 13, row.found ? row.body : t(row.hintKey as never), {
        fontSize: '11px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
        wordWrap: { width: 358 },
      })
      .setOrigin(0, 0.5)
  }

  /**
   * The Collection Book. Sorted so a run of owned rows is not broken up by the
   * ones still missing — a shelf reads as a shelf when what is on it is
   * together.
   */
  private gearRows(player: PlayerState): Row[] {
    return itemEntries(player)
      .slice()
      .sort((a, b) => Number(b.found) - Number(a.found))
      .map((entry) => ({
        icon: `item_${entry.value.id}`,
        title: entry.value.name,
        body: itemSummary(player, entry.value),
        found: entry.found,
        hintKey: entry.hintKey,
      }))
  }

  private traitRows(player: PlayerState): Row[] {
    return traitEntries(player).map((entry) => ({
      icon: entry.value.icon,
      title: t(entry.value.nameKey),
      body: t(entry.value.descriptionKey),
      found: entry.found,
      hintKey: entry.hintKey,
    }))
  }

  private statusRows(player: PlayerState): Row[] {
    return statusEntries(player).map((entry) => ({
      icon: entry.value.icon,
      title: t(entry.value.nameKey),
      body: t(entry.value.descriptionKey),
      found: entry.found,
      hintKey: entry.hintKey,
    }))
  }

  private setRows(player: PlayerState): Row[] {
    return setEntries(player).map((entry) => ({
      icon: 'icon_bag',
      title: entry.value.name,
      // Both halves on one line: a set is a decision about four slots, and the
      // two-piece bonus alone does not tell the player what they are buying.
      body: `2· ${entry.value.twoPiece.description}  ·  4· ${entry.value.fourPiece.description}`,
      found: entry.found,
      hintKey: entry.hintKey,
    }))
  }

  private relicRows(player: PlayerState): Row[] {
    return relicEntries(player).map((entry) => ({
      icon: entry.value.sprite,
      title: t(entry.value.nameKey),
      body: t(entry.value.descriptionKey),
      found: entry.found,
      hintKey: entry.hintKey,
    }))
  }
}
