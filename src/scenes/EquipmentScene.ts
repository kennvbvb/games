import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { ITEM_BY_ID, itemsForSlot } from '../data/items'
import { RARITY_COLOR, RARITY_LABEL_KEYS } from '../data/affixes'
import { activeSets } from '../data/sets'
import { GameState } from '../state/GameState'
import { persist } from '../services/saveService'
import {
  EQUIP_SLOTS,
  SLOT_LABEL_KEYS,
  affixesOf,
  effectiveStats,
  equipItem,
  equippedItems,
  unequipSlot,
} from '../systems/upgrades'
import { makeButton } from '../ui/components/makeButton'
import { makePanel } from '../ui/components/makePanel'
import { makeEmoji } from '../ui/components/makeEmoji'
import { makeStatRow, type StatEntry } from '../ui/components/makeStatRow'
import { makeTitle } from '../ui/components/makeTitle'
import { COLORS, FONT } from '../ui/styles'
import type { EquipSlot, PlayerState, ShopItem, StatBonus } from '../types'
import { t } from '../i18n'

/**
 * Six slots do not fit as six full-width cards, so the overview is a
 * two-column grid of compact tiles. The detail those cards used to carry —
 * rarity, affixes — moves to the picker, which is where a player is actually
 * comparing one piece against another.
 */
const GRID_X = [GAME_W / 2 - 108, GAME_W / 2 + 108]
const GRID_Y = [158, 246, 334]
const TILE_W = 206
const TILE_H = 80

const PICKER_ROWS = [162, 240, 318, 396, 474]
const PICKER_FOOTER_Y = 546

const SLOT_ICON: Record<EquipSlot, string> = {
  weapon: 'icon_atk',
  head: 'icon_face',
  body: 'icon_def',
  boots: 'icon_bolt',
  accessory1: 'icon_hp',
  accessory2: 'icon_star',
}

interface EquipmentSceneData {
  /** When set, the scene shows the picker for this slot instead of the overview. */
  picking?: EquipSlot | null
  page?: number
}

function bonusEntries(bonus: StatBonus): StatEntry[] {
  const entries: StatEntry[] = []
  if (bonus.hp) entries.push({ icon: 'icon_hp', value: `+${bonus.hp}` })
  if (bonus.atk) entries.push({ icon: 'icon_atk', value: `+${bonus.atk}` })
  if (bonus.def) entries.push({ icon: 'icon_def', value: `+${bonus.def}` })
  return entries
}

export class EquipmentScene extends Phaser.Scene {
  private picking: EquipSlot | null = null
  private page = 0

  constructor() {
    super('Equipment')
  }

  init(data: EquipmentSceneData): void {
    this.picking = data.picking ?? null
    this.page = data.page ?? 0
  }

  create(): void {
    setupScene(this)
    makeTitle(this, 44, this.picking ? t(SLOT_LABEL_KEYS[this.picking]) : t('equipment.title'), 'icon_bag')

    if (this.picking) this.renderPicker(this.picking)
    else this.renderOverview()
  }

  private renderOverview(): void {
    const player = GameState.player!
    const stats = effectiveStats(player)

    this.add
      .text(GAME_W / 2, 76, t('equipment.subtitle'), {
        fontSize: '12px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)

    EQUIP_SLOTS.forEach((slot, i) => {
      this.renderSlotTile(slot, GRID_X[i % 2], GRID_Y[Math.floor(i / 2)])
    })

    this.renderSets()

    makeStatRow(
      this,
      GAME_W / 2 - 92,
      556,
      [
        { icon: 'icon_hp', value: stats.maxHp },
        { icon: 'icon_atk', value: stats.atk },
        { icon: 'icon_def', value: stats.def },
      ],
      { fontSize: '16px', iconSize: 18, gap: 26 },
    )

    makeButton(this, GAME_W / 2, 640, t('common.back'), () => this.scene.start('Character'), {
      variant: 'secondary',
      minWidth: 180,
      fontSize: '15px',
    })
  }

  private renderSlotTile(slot: EquipSlot, cx: number, cy: number): void {
    const player = GameState.player!
    const id = player.equipped[slot]
    const item = id ? ITEM_BY_ID.get(id) : undefined
    const owned = itemsForSlot(slot).filter((it) => player.ownedItemIds.includes(it.id))

    makePanel(this, cx, cy, TILE_W, TILE_H)
    const left = cx - TILE_W / 2

    const icon = makeEmoji(this, left + 30, cy - 6, item ? `item_${item.id}` : SLOT_ICON[slot], 28)
    if (!item) icon.setAlpha(0.28)

    this.add
      .text(left + 52, cy - 22, t(SLOT_LABEL_KEYS[slot]), {
        fontSize: '10px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0, 0.5)
    this.add
      .text(left + 52, cy - 3, item ? item.name : t('equipment.empty'), {
        fontSize: '12px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: item ? RARITY_COLOR[item.rarity] : COLORS.textDisabled,
        wordWrap: { width: TILE_W - 64 },
      })
      .setOrigin(0, 0.5)

    if (item) {
      makeStatRow(this, left + 52, cy + 22, bonusEntries(item.bonus), {
        fontSize: '11px',
        iconSize: 12,
        gap: 10,
      })
      const extra = affixesOf(item).length
      if (extra > 0) {
        this.add
          .text(cx + TILE_W / 2 - 12, cy + 22, `+${extra}`, {
            fontSize: '11px',
            fontFamily: FONT.family,
            fontStyle: 'bold',
            color: RARITY_COLOR[item.rarity],
          })
          .setOrigin(1, 0.5)
      }
    } else {
      this.add
        .text(left + 52, cy + 22, t('equipment.available', { count: owned.length }), {
          fontSize: '10px',
          fontFamily: FONT.family,
          color: COLORS.textDim,
        })
        .setOrigin(0, 0.5)
    }

    const hit = this.add.rectangle(cx, cy, TILE_W, TILE_H, 0xffffff, 0.001).setInteractive({ useHandCursor: true })
    hit.on('pointerdown', () => this.scene.restart({ picking: slot, page: 0 }))
  }

  /** Sets only pay at two and four pieces, so partial progress has to be visible. */
  private renderSets(): void {
    const sets = activeSets(equippedItems(GameState.player!).map((item) => item.id))
    this.add
      .text(GAME_W / 2, 406, t('equipment.sets'), {
        fontSize: '12px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0.5)

    if (sets.length === 0) {
      this.add
        .text(GAME_W / 2, 430, t('equipment.noSets'), {
          fontSize: '11px',
          fontFamily: FONT.family,
          color: COLORS.textDisabled,
        })
        .setOrigin(0.5)
      return
    }

    sets.slice(0, 3).forEach((active, i) => {
      const y = 432 + i * 32
      this.add
        .text(38, y, t('equipment.setProgress', { name: active.set.name, worn: active.worn }), {
          fontSize: '12px',
          fontFamily: FONT.family,
          fontStyle: 'bold',
          color: active.twoActive ? COLORS.success : COLORS.textDim,
        })
        .setOrigin(0, 0.5)
      this.add
        .text(
          160,
          y,
          active.fourActive ? active.set.fourPiece.description : active.set.twoPiece.description,
          {
            fontSize: '10px',
            fontFamily: FONT.family,
            color: active.twoActive ? COLORS.textDim : COLORS.textDisabled,
            wordWrap: { width: 282 },
          },
        )
        .setOrigin(0, 0.5)
    })
  }

  /** Every owned piece for this slot, five per page with the affixes spelled out. */
  private renderPicker(slot: EquipSlot): void {
    const player = GameState.player!
    const owned = itemsForSlot(slot).filter((item) => player.ownedItemIds.includes(item.id))
    const pages = Math.max(1, Math.ceil(owned.length / PICKER_ROWS.length))
    const page = Math.min(Math.max(this.page, 0), pages - 1)
    const shown = owned.slice(page * PICKER_ROWS.length, (page + 1) * PICKER_ROWS.length)

    this.add
      .text(GAME_W / 2, 76, t('equipment.pick'), {
        fontSize: '12px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)

    if (owned.length === 0) {
      this.add
        .text(GAME_W / 2, 260, t('equipment.nothingOwned'), {
          fontSize: '14px',
          fontFamily: FONT.family,
          color: COLORS.textDim,
        })
        .setOrigin(0.5)
    }

    shown.forEach((item, i) => this.renderPickerRow(item, slot, PICKER_ROWS[i]))

    if (pages > 1) {
      makeButton(
        this,
        GAME_W / 2 - 110,
        PICKER_FOOTER_Y,
        '◀',
        () => this.scene.restart({ picking: slot, page: page - 1 }),
        { disabled: page === 0, minWidth: 64, minHeight: 46, fontSize: '16px' },
      )
      this.add
        .text(GAME_W / 2, PICKER_FOOTER_Y, `${page + 1} / ${pages}`, {
          fontSize: '14px',
          fontFamily: FONT.family,
          color: COLORS.textDim,
        })
        .setOrigin(0.5)
      makeButton(
        this,
        GAME_W / 2 + 110,
        PICKER_FOOTER_Y,
        '▶',
        () => this.scene.restart({ picking: slot, page: page + 1 }),
        { disabled: page >= pages - 1, minWidth: 64, minHeight: 46, fontSize: '16px' },
      )
    }

    const worn = player.equipped[slot]
    makeButton(
      this,
      GAME_W / 2 - 96,
      626,
      t('equipment.empty'),
      () => this.commit(unequipSlot(player, slot), slot),
      { variant: 'secondary', disabled: worn === null, minWidth: 156, fontSize: '14px' },
    )
    makeButton(this, GAME_W / 2 + 96, 626, t('common.back'), () => this.scene.restart({ picking: null }), {
      variant: 'secondary',
      minWidth: 156,
      fontSize: '14px',
    })
  }

  private renderPickerRow(item: ShopItem, slot: EquipSlot, y: number): void {
    const player = GameState.player!
    const wornHere = player.equipped[slot] === item.id
    // An accessory worn in the *other* accessory slot is not available here.
    // Saying so beats a button that silently moves the piece across.
    const wornElsewhere = !wornHere && equippedItems(player).some((i) => i.id === item.id)
    const affixes = affixesOf(item)

    makePanel(this, GAME_W / 2, y, 440, 70)
    const top = y - 35

    makeEmoji(this, 48, y - 6, `item_${item.id}`, 30)
    const name = this.add
      .text(78, top + 18, item.name, {
        fontSize: '14px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0, 0.5)
    this.add
      .text(name.x + name.width + 10, top + 18, t(RARITY_LABEL_KEYS[item.rarity]), {
        fontSize: '9px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: RARITY_COLOR[item.rarity],
      })
      .setOrigin(0, 0.5)

    makeStatRow(this, 78, top + 37, bonusEntries(item.bonus), { fontSize: '11px', iconSize: 12, gap: 12 })

    if (affixes.length > 0) {
      this.add
        .text(78, top + 56, affixes.map((a) => `${a.config.name} ${a.text}`).join('  ·  '), {
          fontSize: '9px',
          fontFamily: FONT.family,
          color: RARITY_COLOR[item.rarity],
          wordWrap: { width: 250 },
        })
        .setOrigin(0, 0.5)
    }

    makeButton(
      this,
      386,
      y,
      wornHere ? t('equipment.equipped') : wornElsewhere ? t('equipment.elsewhere') : t('equipment.equip'),
      () => this.commit(equipItem(player, item.id, slot), slot),
      {
        variant: wornHere ? 'secondary' : 'primary',
        disabled: wornHere || wornElsewhere,
        minWidth: 92,
        minHeight: 46,
        fontSize: '12px',
      },
    )
  }

  private commit(next: PlayerState, slot: EquipSlot): void {
    GameState.player = next
    void persist(next, GameState.userId).then((stamped) => {
      GameState.player = stamped
    })
    this.scene.restart({ picking: slot, page: this.page })
  }
}
