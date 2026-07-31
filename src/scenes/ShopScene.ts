import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { BALANCE } from '../data/balance'
import { ITEMS } from '../data/items'
import { GameState } from '../state/GameState'
import { persist } from '../services/saveService'
import { buyItem, buyUpgrade, upgradeCost } from '../systems/upgrades'
import { makeButton } from '../ui/components/makeButton'
import { makePanel } from '../ui/components/makePanel'
import { makeEmoji } from '../ui/components/makeEmoji'
import { makeStatRow, type StatEntry } from '../ui/components/makeStatRow'
import { makeTitle } from '../ui/components/makeTitle'
import { advanceTutorial } from '../ui/components/makeTutorialTip'
import { COLORS, FONT } from '../ui/styles'
import { TUTORIAL_DONE, type ShopItem, type StatBonus, type UpgradeType } from '../types'
import { t } from '../i18n'

const UPGRADE_TYPES: UpgradeType[] = ['hp', 'atk', 'def']
const ITEMS_PER_PAGE = 4
const ROW_YS = [218, 312, 406, 500]

type Tab = 'treats' | 'gear'

interface ShopSceneData {
  tab?: Tab
  page?: number
}

function bonusEntries(bonus: StatBonus): StatEntry[] {
  const entries: StatEntry[] = []
  if (bonus.hp) entries.push({ icon: 'icon_hp', value: `+${bonus.hp}` })
  if (bonus.atk) entries.push({ icon: 'icon_atk', value: `+${bonus.atk}` })
  if (bonus.def) entries.push({ icon: 'icon_def', value: `+${bonus.def}` })
  return entries
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

    advanceTutorial(TUTORIAL_DONE)
    makeTitle(this, 44, t('shop.title'), 'icon_cart')

    const goldLabel = this.add
      .text(GAME_W / 2 + 10, 80, t('menu.gold', { gold: player.gold }), {
        fontSize: '18px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.gold,
      })
      .setOrigin(0.5)
    makeEmoji(this, goldLabel.x - goldLabel.width / 2 - 12, 80, 'icon_gold', 20)

    makeButton(this, GAME_W / 2 - 85, 122, t('shop.treats'), () => this.switchTab('treats'), {
      variant: this.tab === 'treats' ? 'primary' : 'secondary',
      minWidth: 150,
      fontSize: '15px',
      icon: 'icon_candy',
    })
    makeButton(this, GAME_W / 2 + 85, 122, t('shop.gear'), () => this.switchTab('gear'), {
      variant: this.tab === 'gear' ? 'primary' : 'secondary',
      minWidth: 150,
      fontSize: '15px',
      icon: 'icon_bag',
    })

    if (this.tab === 'treats') {
      this.renderTreats()
    } else {
      this.renderGear()
    }

    makeButton(this, GAME_W / 2, 646, t('common.back'), () => this.scene.start('MainMenu'), {
      variant: 'secondary',
      fontSize: '14px',
    })
  }

  private switchTab(tab: Tab): void {
    if (tab !== this.tab) this.scene.restart({ tab, page: 0 } satisfies ShopSceneData)
  }

  private subtitle(text: string): void {
    this.add
      .text(GAME_W / 2, 164, text, { fontSize: '13px', fontFamily: FONT.family, color: COLORS.textDim })
      .setOrigin(0.5)
  }

  private renderTreats(): void {
    const player = GameState.player!
    this.subtitle(t('shop.treatsHint'))

    UPGRADE_TYPES.forEach((type, i) => {
      const cfg = BALANCE.upgrades[type]
      const owned = player.upgrades[type]
      const cost = upgradeCost(type, owned)

      this.renderCard({
        y: ROW_YS[i],
        icon: `treat_${type}`,
        name: cfg.name,
        bonus: bonusEntries(type === 'hp' ? { hp: cfg.bonus } : type === 'atk' ? { atk: cfg.bonus } : { def: cfg.bonus }),
        note: t('shop.owned', { count: owned }),
        cost,
        disabled: player.gold < cost,
        onBuy: () => {
          const next = buyUpgrade(GameState.player!, type)
          if (!next) return
          this.commit(next)
        },
      })
    })
  }

  private renderGear(): void {
    const pageCount = Math.ceil(ITEMS.length / ITEMS_PER_PAGE)
    this.page = Math.min(this.page, pageCount - 1)
    const pageItems = ITEMS.slice(this.page * ITEMS_PER_PAGE, (this.page + 1) * ITEMS_PER_PAGE)

    this.subtitle(t('shop.gearHint'))
    pageItems.forEach((item, i) => this.renderGearCard(item, ROW_YS[i]))

    makeButton(this, GAME_W / 2 - 110, 572, '◀', () => this.turnPage(-1), {
      disabled: this.page === 0,
      fontSize: '14px',
    })
    this.add
      .text(GAME_W / 2, 572, `Page ${this.page + 1} / ${pageCount}`, {
        fontSize: '14px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)
    makeButton(this, GAME_W / 2 + 110, 572, '▶', () => this.turnPage(1), {
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
      icon: `item_${item.id}`,
      name: item.name,
      bonus: bonusEntries(item.bonus),
      note: owned ? t('shop.inBag') : locked ? t('shop.requiresLevel', { level: item.minLevel ?? 0 }) : '',
      noteIcon: locked ? 'icon_lock' : undefined,
      cost: owned ? null : item.cost,
      disabled: locked || player.gold < item.cost,
      ownedTag: owned,
      onBuy: () => {
        const next = buyItem(GameState.player!, item.id)
        if (!next) return
        this.commit(next)
      },
    })
  }

  private renderCard(opts: {
    y: number
    icon: string
    name: string
    bonus: StatEntry[]
    note: string
    noteIcon?: string
    cost: number | null
    disabled: boolean
    ownedTag?: boolean
    onBuy: () => void
  }): void {
    makePanel(this, GAME_W / 2, opts.y, 430, 84)
    makeEmoji(this, 64, opts.y, opts.icon, 40)
    this.add
      .text(100, opts.y - 20, opts.name, {
        fontSize: '16px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0, 0.5)
    makeStatRow(this, 100, opts.y + 3, opts.bonus, { fontSize: '13px', iconSize: 15, gap: 12 })

    if (opts.note) {
      const noteX = opts.noteIcon ? 114 : 100
      if (opts.noteIcon) makeEmoji(this, 106, opts.y + 25, opts.noteIcon, 12)
      this.add
        .text(noteX, opts.y + 25, opts.note, {
          fontSize: '11px',
          fontFamily: FONT.family,
          color: opts.ownedTag ? COLORS.success : COLORS.textDim,
        })
        .setOrigin(0, 0.5)
    }

    if (opts.ownedTag) {
      this.add
        .text(388, opts.y, '✓', {
          fontSize: '26px',
          fontFamily: FONT.family,
          fontStyle: 'bold',
          color: COLORS.success,
        })
        .setOrigin(0.5)
    } else if (opts.cost !== null) {
      makeButton(this, 378, opts.y, `${opts.cost}`, opts.onBuy, {
        disabled: opts.disabled,
        minWidth: 92,
        fontSize: '14px',
        icon: 'icon_gold',
      })
    }
  }

  private commit(next: NonNullable<ReturnType<typeof buyItem>>): void {
    GameState.player = next
    void persist(next, GameState.userId).then((stamped) => {
      GameState.player = stamped
    })
    this.scene.restart({ tab: this.tab, page: this.page } satisfies ShopSceneData)
  }

  private turnPage(dir: number): void {
    this.scene.restart({ tab: this.tab, page: this.page + dir } satisfies ShopSceneData)
  }
}
