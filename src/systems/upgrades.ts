import { BALANCE } from '../data/balance'
import { ITEM_BY_ID, kindForSlot, slotsForKind } from '../data/items'
import { affixModifiers, affixesFor } from '../data/affixes'
import { setModifiers } from '../data/sets'
import type { RolledAffix } from '../data/affixes'
import type { ModifierSource } from './combatModifiers'
import type { Equipment, EquipSlot, PlayerState, PlayerStats, ShopItem, StatBonus, UpgradeType } from '../types'

export function upgradeCost(type: UpgradeType, owned: number): number {
  return Math.round(BALANCE.upgrades[type].baseCost * Math.pow(BALANCE.upgradeCostGrowth, owned))
}

export function upgradeBonus(type: UpgradeType, owned: number): number {
  return BALANCE.upgrades[type].bonus * owned
}

export const EQUIP_SLOTS: EquipSlot[] = ['weapon', 'head', 'body', 'boots', 'accessory1', 'accessory2']

export const EMPTY_EQUIPMENT: Equipment = {
  weapon: null,
  head: null,
  body: null,
  boots: null,
  accessory1: null,
  accessory2: null,
}

/** Message keys for slot names; the strings themselves live in src/i18n. */
export const SLOT_LABEL_KEYS = {
  weapon: 'equipment.weapon',
  head: 'equipment.head',
  body: 'equipment.body',
  boots: 'equipment.boots',
  accessory1: 'equipment.accessory1',
  accessory2: 'equipment.accessory2',
} as const satisfies Record<EquipSlot, string>

/** Items currently worn, in slot order, skipping empty slots. */
export function equippedItems(state: PlayerState): ShopItem[] {
  return EQUIP_SLOTS.map((slot) => {
    const id = state.equipped[slot]
    return id ? ITEM_BY_ID.get(id) : undefined
  }).filter((item): item is ShopItem => item !== undefined)
}

/** The affixes an item carries, derived from its id — see data/affixes. */
export function affixesOf(item: ShopItem): RolledAffix[] {
  return affixesFor(item.id, item.kind, item.rarity)
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

/**
 * Everything worn gear contributes beyond flat stats: each piece's own affixes,
 * plus whatever sets the worn pieces add up to. Folded into the same product as
 * plans, race passives and skills — see systems/combatModifiers.
 */
export function gearModifiers(state: PlayerState): ModifierSource[] {
  const worn = equippedItems(state)
  return [
    ...worn.flatMap((item) => affixModifiers(affixesOf(item))),
    ...setModifiers(worn.map((item) => item.id)),
  ]
}

/**
 * Equips an owned item. Accessories fit two slots: an explicit `slot` says
 * which, and without one the piece goes to the first free accessory slot,
 * falling back to the first so a tap always does something visible.
 */
export function equipItem(state: PlayerState, itemId: string, slot?: EquipSlot): PlayerState {
  const item = ITEM_BY_ID.get(itemId)
  if (!item || !state.ownedItemIds.includes(itemId)) return state
  const candidates = slotsForKind(item.kind)
  const target =
    slot && candidates.includes(slot)
      ? slot
      : (candidates.find((s) => state.equipped[s] === null) ?? candidates[0])

  const equipped = { ...state.equipped, [target]: itemId }
  // One copy of a piece, worn once: filling both accessory slots with the same
  // trinket would pay its stats and its affixes twice for a single purchase.
  for (const other of candidates) {
    if (other !== target && equipped[other] === itemId) equipped[other] = null
  }
  return { ...state, equipped }
}

export function unequipSlot(state: PlayerState, slot: EquipSlot): PlayerState {
  return { ...state, equipped: { ...state.equipped, [slot]: null } }
}

/**
 * Picks the strongest owned items, using cost as the power proxy since the shop
 * ladder is already priced by strength. Used to fill slots for saves written
 * before equipment existed, so nobody loses stats to the migration.
 *
 * Dearest first, so the two accessory slots take the two best trinkets rather
 * than whichever two happened to come first in the owned list.
 */
export function bestOwnedPerSlot(ownedItemIds: string[]): Equipment {
  const best: Equipment = { ...EMPTY_EQUIPMENT }
  const owned = ownedItemIds
    .map((id) => ITEM_BY_ID.get(id))
    .filter((item): item is ShopItem => item !== undefined)
    .sort((a, b) => b.cost - a.cost || a.id.localeCompare(b.id))

  for (const item of owned) {
    const free = slotsForKind(item.kind).find((slot) => best[slot] === null)
    if (free) best[free] = item.id
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
  const bought = {
    ...state,
    gold: state.gold - item.cost,
    ownedItemIds: [...state.ownedItemIds, itemId],
  }
  // Wear the new piece straight away — buying something and seeing no change
  // would read as a bug. Swapping back is one tap in Equipment.
  return equipItem(bought, itemId)
}

export { kindForSlot, slotsForKind }
