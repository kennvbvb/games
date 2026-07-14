import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { BALANCE } from '../data/balance'
import { ITEMS } from '../data/items'
import { GameState } from '../state/GameState'
import { persist } from '../services/saveService'
import { buyItem, buyUpgrade, upgradeCost } from '../systems/upgrades'
import { makeButton } from '../ui/components/makeButton'
import { makePanel } from '../ui/components/makePanel'
import { COLORS, FONT } from '../ui/styles'
import type { ShopItem, StatBonus, UpgradeType } from '../types'

const UPGRADE_TYPES: UpgradeType[] = ['hp', 'atk', 'def']
const ITEMS_PER_PAGE = 4
const ROW_YS = [212, 306, 400, 494]

type Tab = 'treats' | 'gear'

interface ShopSceneData {
  tab?: Tab
  page?: number
}

function bonusLabel(bonus: StatBonus): string {
  const parts: string[] = []
  if (bonus.hp) parts.push(`❤️ +${bonus.hp}`)
  if (bonus.atk) parts.push(`⚔️ +${bonus.atk}`)
  if (bonus.def) parts.push(`🛡️ +${bonus.def}`)
  return parts.join('   ')
}

export class ShopScene extends Phaser.Scene {
  private tab: Tab = 'treats'
  private page = 0

  constructor() {
    super('Shop')
  }

  init(data: ShopSceneData): void {
    this.tab = data.tab ?? 'treats'
    this.page = data.page ?? 0
  }

  create(): void {
    setupScene(this)
    const player = GameState.player!

    this.add
      .text(GAME_W / 2, 44, '🛒 Shop', {
        fontSize: '26px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0.5)
    this.add
      .text(GAME_W / 2, 80, `🪙 ${player.gold} gold`, {
        fontSize: '18px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.gold,
      })
      .setOrigin(0.5)

    makeButton(this, GAME_W / 2 - 85, 128, '🍬 Treats', () => this.switchTab('treats'), {
      variant: this.tab === 'treats' ? 'primary' : 'secondary',
      minWidth: 150,
      fontSize: '15px',
    })
    makeButton(this, GAME_W / 2 + 85, 128, '🎒 Gear', () => this.switchTab('gear'), {
      variant: this.tab === 'gear' ? 'primary' : 'secondary',
      minWidth: 150,
      fontSize: '15px',
    })

    if (this.tab === 'treats') {
      this.renderTreats()
    } else {
      this.renderGear()
    }

    makeButton(this, GAME_W / 2, 640, 'Back', () => this.scene.start('MainMenu'), {
      variant: 'secondary',
      fontSize: '14px',
    })
  }

  private switchTab(tab: Tab): void {
    if (tab !== this.tab) this.scene.restart({ tab, page: 0 } satisfies ShopSceneData)
  }

  private renderTreats(): void {
    const player = GameState.player!
    this.add
      .text(GAME_W / 2, 157, 'Repeatable snacks — every bite counts!', {
        fontSize: '13px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)

    UPGRADE_TYPES.forEach((type, i) => {
      const cfg = BALANCE.upgrades[type]
      const owned = player.upgrades[type]
      const cost = upgradeCost(type, owned)
      const y = ROW_YS[i]

      this.renderCard({
        y,
        emoji: cfg.emoji,
        name: cfg.name,
        desc: cfg.description,
        note: `Owned: ${owned}`,
        cost,
        disabled: player.gold < cost,
        onBuy: () => {
          const next = buyUpgrade(GameState.player!, type)
          if (!next) return
          GameState.player = next
          void persist(next, GameState.userId)
          this.scene.restart({ tab: this.tab, page: this.page } satisfies ShopSceneData)
        },
      })
    })
  }

  private renderGear(): void {
    const pageCount = Math.ceil(ITEMS.length / ITEMS_PER_PAGE)
    this.page = Math.min(this.page, pageCount - 1)
    const pageItems = ITEMS.slice(this.page * ITEMS_PER_PAGE, (this.page + 1) * ITEMS_PER_PAGE)

    this.add
      .text(GAME_W / 2, 157, 'One-of-a-kind gear — strong pieces need a higher level!', {
        fontSize: '13px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)

    pageItems.forEach((item, i) => this.renderGearCard(item, ROW_YS[i]))

    makeButton(this, GAME_W / 2 - 110, 566, '◀', () => this.turnPage(-1), {
      disabled: this.page === 0,
      fontSize: '14px',
    })
    this.add
      .text(GAME_W / 2, 566, `Page ${this.page + 1} / ${pageCount}`, {
        fontSize: '14px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)
    makeButton(this, GAME_W / 2 + 110, 566, '▶', () => this.turnPage(1), {
      disabled: this.page >= pageCount - 1,
      fontSize: '14px',
    })
  }

  private renderGearCard(item: ShopItem, y: number): void {
    const player = GameState.player!
    const owned = player.ownedItemIds.includes(item.id)
    const locked = Boolean(item.minLevel && player.level < item.minLevel)

    this.renderCard({
      y,
      emoji: item.emoji,
      name: item.name,
      desc: bonusLabel(item.bonus),
      note: owned ? 'In your bag!' : locked ? `🔒 Requires Lv ${item.minLevel}` : '',
      cost: owned ? null : item.cost,
      disabled: locked || player.gold < item.cost,
      ownedTag: owned,
      onBuy: () => {
        const next = buyItem(GameState.player!, item.id)
        if (!next) return
        GameState.player = next
        void persist(next, GameState.userId)
        this.scene.restart({ tab: this.tab, page: this.page } satisfies ShopSceneData)
      },
    })
  }

  private renderCard(opts: {
    y: number
    emoji: string
    name: string
    desc: string
    note: string
    cost: number | null
    disabled: boolean
    ownedTag?: boolean
    onBuy: () => void
  }): void {
    makePanel(this, GAME_W / 2, opts.y, 430, 84)
    this.add.text(64, opts.y, opts.emoji, { fontSize: '34px' }).setOrigin(0.5)
    this.add
      .text(100, opts.y - 20, opts.name, { fontSize: '16px', fontFamily: FONT.family, fontStyle: 'bold', color: COLORS.text })
      .setOrigin(0, 0.5)
    this.add
      .text(100, opts.y + 2, opts.desc, { fontSize: '13px', fontFamily: FONT.family, color: COLORS.textDim })
      .setOrigin(0, 0.5)
    if (opts.note) {
      this.add
        .text(100, opts.y + 23, opts.note, {
          fontSize: '11px',
          fontFamily: FONT.family,
          color: opts.ownedTag ? COLORS.success : COLORS.textDim,
        })
        .setOrigin(0, 0.5)
    }

    if (opts.ownedTag) {
      this.add
        .text(388, opts.y, '✓', { fontSize: '24px', fontFamily: FONT.family, fontStyle: 'bold', color: COLORS.success })
        .setOrigin(0.5)
    } else if (opts.cost !== null) {
      makeButton(this, 378, opts.y, `🪙 ${opts.cost}`, opts.onBuy, {
        disabled: opts.disabled,
        minWidth: 86,
        fontSize: '14px',
      })
    }
  }

  private turnPage(dir: number): void {
    this.scene.restart({ tab: this.tab, page: this.page + dir } satisfies ShopSceneData)
  }
}
