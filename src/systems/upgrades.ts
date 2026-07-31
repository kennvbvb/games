import { BALANCE } from '../data/balance'
import { ITEM_BY_ID } from '../data/items'
import type { Equipment, EquipSlot, PlayerState, PlayerStats, ShopItem, StatBonus, UpgradeType } from '../types'

export function upgradeCost(type: UpgradeType, owned: number): number {
  return Math.round(BALANCE.upgrades[type].baseCost * Math.pow(BALANCE.upgradeCostGrowth, owned))
}

export function upgradeBonus(type: UpgradeType, owned: number): number {
  return BALANCE.upgrades[type].bonus * owned
}

export const EQUIP_SLOTS: EquipSlot[] = ['weapon', 'armor', 'charm']

/** Message keys for slot names; the strings themselves live in src/i18n. */
export const SLOT_LABEL_KEYS = {
  weapon: 'equipment.weapon',
  armor: 'equipment.armor',
  charm: 'equipment.charm',
} as const satisfies Record<EquipSlot, string>

/** Items currently worn, in slot order, skipping empty slots. */
export function equippedItems(state: PlayerState): ShopItem[] {
  return EQUIP_SLOTS.map((slot) => {
    const id = state.equipped[slot]
    return id ? ITEM_BY_ID.get(id) : undefined
  }).filter((item): item is ShopItem => item !== undefined)
}

/**
 * Combined permanent bonuses from shop treats and *equipped* gear. Owning an
 * item is not enough — only what's worn counts, which is what makes choosing
 * between pieces a real decision.
 */
export function totalBonus(state: PlayerState): Required<StatBonus> {
  const total = {
    hp: upgradeBonus('hp', state.upgrades.hp),
    atk: upgradeBonus('atk', state.upgrades.atk),
    def: upgradeBonus('def', state.upgrades.def),
  }
  for (const item of equippedItems(state)) {
    total.hp += item.bonus.hp ?? 0
    total.atk += item.bonus.atk ?? 0
    total.def += item.bonus.def ?? 0
  }
  return total
}

/** Equips an owned item into its own slot, replacing whatever was there. */
export function equipItem(state: PlayerState, itemId: string): PlayerState {
  const item = ITEM_BY_ID.get(itemId)
  if (!item || !state.ownedItemIds.includes(itemId)) return state
  return { ...state, equipped: { ...state.equipped, [item.slot]: itemId } }
}

export function unequipSlot(state: PlayerState, slot: EquipSlot): PlayerState {
  return { ...state, equipped: { ...state.equipped, [slot]: null } }
}

/**
 * Picks the strongest owned item per slot, using cost as the power proxy since
 * the shop ladder is already priced by strength. Used to fill slots for saves
 * written before equipment existed, so nobody loses stats to the migration.
 */
export function bestOwnedPerSlot(ownedItemIds: string[]): Equipment {
  const best: Equipment = { weapon: null, armor: null, charm: null }
  for (const id of ownedItemIds) {
    const item = ITEM_BY_ID.get(id)
    if (!item) continue
    const current = best[item.slot]
    const currentCost = current ? (ITEM_BY_ID.get(current)?.cost ?? 0) : -1
    if (item.cost > currentCost) best[item.slot] = id
  }
  return best
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
    // Wear the new piece straight away — buying something and seeing no
    // change would read as a bug. Swapping back is one tap in Equipment.
    equipped: { ...state.equipped, [item.slot]: itemId },
  }
}
