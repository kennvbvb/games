import { BALANCE } from '../data/balance'
import { ITEM_BY_ID } from '../data/items'
import type { PlayerState, PlayerStats, StatBonus, UpgradeType } from '../types'

export function upgradeCost(type: UpgradeType, owned: number): number {
  return Math.round(BALANCE.upgrades[type].baseCost * Math.pow(BALANCE.upgradeCostGrowth, owned))
}

export function upgradeBonus(type: UpgradeType, owned: number): number {
  return BALANCE.upgrades[type].bonus * owned
}

/** Combined permanent bonuses from shop treats and owned equipment. */
export function totalBonus(state: PlayerState): Required<StatBonus> {
  const total = {
    hp: upgradeBonus('hp', state.upgrades.hp),
    atk: upgradeBonus('atk', state.upgrades.atk),
    def: upgradeBonus('def', state.upgrades.def),
  }
  for (const id of state.ownedItemIds) {
    const item = ITEM_BY_ID.get(id)
    if (!item) continue
    total.hp += item.bonus.hp ?? 0
    total.atk += item.bonus.atk ?? 0
    total.def += item.bonus.def ?? 0
  }
  return total
}

/** Level-derived base stats plus all permanent shop bonuses. */
export function effectiveStats(state: PlayerState): PlayerStats {
  const bonus = totalBonus(state)
  return {
    maxHp: state.stats.maxHp + bonus.hp,
    atk: state.stats.atk + bonus.atk,
    def: state.stats.def + bonus.def,
  }
}

/** Returns the new state, or null if the player can't afford the upgrade. */
export function buyUpgrade(state: PlayerState, type: UpgradeType): PlayerState | null {
  const cost = upgradeCost(type, state.upgrades[type])
  if (state.gold < cost) return null
  return {
    ...state,
    gold: state.gold - cost,
    upgrades: { ...state.upgrades, [type]: state.upgrades[type] + 1 },
  }
}

/** Returns the new state, or null if the item is owned, level-locked, or unaffordable. */
export function buyItem(state: PlayerState, itemId: string): PlayerState | null {
  const item = ITEM_BY_ID.get(itemId)
  if (!item) return null
  if (state.ownedItemIds.includes(itemId)) return null
  if (item.minLevel && state.level < item.minLevel) return null
  if (state.gold < item.cost) return null
  return {
    ...state,
    gold: state.gold - item.cost,
    ownedItemIds: [...state.ownedItemIds, itemId],
  }
}
