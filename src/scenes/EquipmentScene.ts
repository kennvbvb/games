import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { ITEMS_BY_SLOT, ITEM_BY_ID } from '../data/items'
import { GameState } from '../state/GameState'
import { persist } from '../services/saveService'
import { EQUIP_SLOTS, SLOT_LABEL_KEYS, effectiveStats, equipItem, unequipSlot } from '../systems/upgrades'
import { makeButton } from '../ui/components/makeButton'
import { makePanel } from '../ui/components/makePanel'
import { makeEmoji } from '../ui/components/makeEmoji'
import { makeStatRow, type StatEntry } from '../ui/components/makeStatRow'
import { makeTitle } from '../ui/components/makeTitle'
import { COLORS, FONT } from '../ui/styles'
import type { EquipSlot, ShopItem, StatBonus } from '../types'
import { t } from '../i18n'

/** Footer row for the picker, below five choice rows. */
const PICKER_FOOTER_Y = 578

const SLOT_ICON: Record<EquipSlot, string> = {
  weapon: 'icon_atk',
  armor: 'icon_def',
  charm: 'icon_hp',
}

interface EquipmentSceneData {
  /** When set, the scene shows the picker for this slot instead of the overview. */
  picking?: EquipSlot | null
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

  constructor() {
    super('Equipment')
  }

  init(data: EquipmentSceneData): void {
    this.picking = data.picking ?? null
  }

  create(): void {
    setupScene(this)
    makeTitle(this, 46, this.picking ? t(SLOT_LABEL_KEYS[this.picking]) : t('equipment.title'), 'icon_bag')

    if (this.picking) this.renderPicker(this.picking)
    else this.renderOverview()
  }

  private renderOverview(): void {
    const player = GameState.player!
    const stats = effectiveStats(player)

    this.add
      .text(GAME_W / 2, 82, t('equipment.subtitle'), {
        fontSize: '13px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)

    EQUIP_SLOTS.forEach((slot, i) => {
      const y = 150 + i * 104
      const equippedId = player.equipped[slot]
      const item = equippedId ? ITEM_BY_ID.get(equippedId) : undefined
      const ownedInSlot = ITEMS_BY_SLOT[slot].filter((it) => player.ownedItemIds.includes(it.id))

      makePanel(this, GAME_W / 2, y, 430, 92)
      const icon = makeEmoji(this, 62, y - 10, item ? `item_${item.id}` : SLOT_ICON[slot], 38)
      if (!item) icon.setAlpha(0.3)

      this.add
        .text(100, y - 26, t(SLOT_LABEL_KEYS[slot]), {
          fontSize: '13px',
          fontFamily: FONT.family,
          color: COLORS.textDim,
        })
        .setOrigin(0, 0.5)
      this.add
        .text(100, y - 4, item ? item.name : t('equipment.empty'), {
          fontSize: '16px',
          fontFamily: FONT.family,
          fontStyle: 'bold',
          color: item ? COLORS.text : COLORS.textDisabled,
        })
        .setOrigin(0, 0.5)

      if (item) makeStatRow(this, 100, y + 22, bonusEntries(item.bonus), { fontSize: '13px', iconSize: 15, gap: 12 })
      else
        this.add
          .text(100, y + 22, ownedInSlot.length ? t('equipment.available', { count: ownedInSlot.length }) : t('equipment.nothingOwned'), {
            fontSize: '12px',
            fontFamily: FONT.family,
            color: COLORS.textDim,
          })
          .setOrigin(0, 0.5)

      makeButton(this, 372, y, t('equipment.change'), () => this.scene.restart({ picking: slot } satisfies EquipmentSceneData), {
        disabled: ownedInSlot.length === 0,
        minWidth: 100,
        fontSize: '14px',
        minHeight: 50,
      })
    })

    makePanel(this, GAME_W / 2, 494, 430, 62)
    this.add
      .text(70, 494, t('equipment.total'), { fontSize: '15px', fontFamily: FONT.family, fontStyle: 'bold', color: COLORS.text })
      .setOrigin(0, 0.5)
    makeStatRow(
      this,
      140,
      494,
      [
        { icon: 'icon_hp', value: stats.maxHp },
        { icon: 'icon_atk', value: stats.atk },
        { icon: 'icon_def', value: stats.def },
      ],
      { fontSize: '16px', iconSize: 18, gap: 20 },
    )

    makeButton(this, GAME_W / 2, 576, t('common.back'), () => this.scene.start('Character'), {
      variant: 'secondary',
      minWidth: 180,
      fontSize: '15px',
    })
  }

  private renderPicker(slot: EquipSlot): void {
    const player = GameState.player!
    const owned = ITEMS_BY_SLOT[slot].filter((item) => player.ownedItemIds.includes(item.id))

    this.add
      .text(GAME_W / 2, 82, t('equipment.pick'), {
        fontSize: '13px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)

    owned.slice(0, 5).forEach((item, i) => this.renderChoice(item, 140 + i * 82, slot))

    makeButton(
      this,
      GAME_W / 2 - 92,
      PICKER_FOOTER_Y,
      t('equipment.unequip'),
      () => {
        this.commit(unequipSlot(player, slot))
      },
      { variant: 'secondary', minWidth: 150, fontSize: '15px', disabled: player.equipped[slot] === null },
    )
    makeButton(this, GAME_W / 2 + 92, PICKER_FOOTER_Y, t('common.back'), () => this.scene.restart({ picking: null }), {
      variant: 'secondary',
      minWidth: 150,
      fontSize: '15px',
    })
  }

  private renderChoice(item: ShopItem, y: number, slot: EquipSlot): void {
    const player = GameState.player!
    const isEquipped = player.equipped[slot] === item.id

    makePanel(this, GAME_W / 2, y, 430, 72)
    makeEmoji(this, 62, y, `item_${item.id}`, 36)
    this.add
      .text(100, y - 12, item.name, {
        fontSize: '16px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0, 0.5)
    makeStatRow(this, 100, y + 12, bonusEntries(item.bonus), { fontSize: '13px', iconSize: 15, gap: 12 })

    if (isEquipped) {
      this.add
        .text(378, y, t('equipment.worn'), {
          fontSize: '14px',
          fontFamily: FONT.family,
          fontStyle: 'bold',
          color: COLORS.success,
        })
        .setOrigin(0.5)
    } else {
      makeButton(this, 378, y, t('equipment.equip'), () => this.commit(equipItem(player, item.id)), {
        minWidth: 96,
        fontSize: '14px',
        minHeight: 48,
      })
    }
  }

  private commit(next: typeof GameState.player): void {
    if (!next) return
    GameState.player = next
    void persist(next, GameState.userId).then((stamped) => {
      GameState.player = stamped
    })
    this.scene.restart({ picking: null } satisfies EquipmentSceneData)
  }
}

