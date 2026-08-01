import type { EquipSlot, ItemKind, ShopItem } from '../types'

/**
 * One-time equipment purchases across six worn slots. Higher-tier pieces are
 * level-gated so big stat jumps cannot be bought early by grinding gold on low
 * stages, and each kind has its own ladder so upgrading means choosing.
 *
 * Ids are stable: every piece that existed when there were three slots keeps
 * its id and its numbers, so an existing save loses nothing when armour becomes
 * "body" and charms become "accessory".
 *
 * Rarity is not a second power axis on top of cost — it decides how many
 * affixes a piece carries (see data/affixes), which is what turns two
 * similarly-priced items into two different playstyles rather than two numbers.
 */
export const ITEMS: ShopItem[] = [
  // --- Weapons -------------------------------------------------------------
  { id: 'wooden-sword', kind: 'weapon', name: 'Wooden Sword', emoji: '🗡️', bonus: { atk: 2 }, cost: 60, rarity: 'common' },
  { id: 'brave-gloves', kind: 'weapon', name: 'Brave Gloves', emoji: '🧤', bonus: { atk: 3 }, cost: 110, minLevel: 3, rarity: 'common' },
  { id: 'iron-sword', kind: 'weapon', name: 'Iron Sword', emoji: '⚔️', bonus: { atk: 5 }, cost: 180, minLevel: 5, rarity: 'uncommon', setId: 'ironclad' },
  { id: 'knight-blade', kind: 'weapon', name: 'Knight Blade', emoji: '🗡️', bonus: { atk: 8 }, cost: 350, minLevel: 8, rarity: 'uncommon' },
  { id: 'elven-bow', kind: 'weapon', name: 'Elven Bow', emoji: '🏹', bonus: { atk: 10 }, cost: 480, minLevel: 10, rarity: 'rare', setId: 'trickster' },
  { id: 'runed-spear', kind: 'weapon', name: 'Runed Spear', emoji: '🔱', bonus: { atk: 13 }, cost: 620, minLevel: 11, rarity: 'rare' },
  { id: 'dragonfang', kind: 'weapon', name: 'Dragonfang', emoji: '🦷', bonus: { atk: 16 }, cost: 900, minLevel: 15, rarity: 'rare' },
  { id: 'sunsteel-blade', kind: 'weapon', name: 'Sunsteel Blade', emoji: '🪓', bonus: { atk: 22 }, cost: 1500, minLevel: 15, rarity: 'epic' },
  { id: 'twin-daggers', kind: 'weapon', name: 'Twin Daggers', emoji: '🔪', bonus: { atk: 17, def: 4 }, cost: 1500, minLevel: 15, rarity: 'epic' },
  { id: 'worldbreaker', kind: 'weapon', name: 'Worldbreaker', emoji: '🔨', bonus: { atk: 34 }, cost: 3600, minLevel: 19, rarity: 'legendary', setId: 'berserker' },
  { id: 'starfall-glaive', kind: 'weapon', name: 'Starfall Glaive', emoji: '🌠', bonus: { hp: 45, atk: 26 }, cost: 3600, minLevel: 19, rarity: 'legendary', setId: 'celestial' },

  // --- Head ----------------------------------------------------------------
  { id: 'cozy-hat', kind: 'head', name: 'Cozy Hat', emoji: '🎩', bonus: { hp: 20 }, cost: 120, minLevel: 3, rarity: 'common' },
  { id: 'iron-helm', kind: 'head', name: 'Iron Helm', emoji: '⛑️', bonus: { hp: 16, def: 3 }, cost: 200, minLevel: 5, rarity: 'uncommon', setId: 'ironclad' },
  { id: 'hood-of-whispers', kind: 'head', name: 'Hood of Whispers', emoji: '🥷', bonus: { atk: 4, def: 2 }, cost: 420, minLevel: 9, rarity: 'rare', setId: 'trickster' },
  { id: 'horned-casque', kind: 'head', name: 'Horned Casque', emoji: '🪖', bonus: { hp: 30, atk: 5 }, cost: 760, minLevel: 12, rarity: 'rare', setId: 'berserker' },
  { id: 'royal-crown', kind: 'head', name: 'Royal Crown', emoji: '👑', bonus: { hp: 40, def: 10 }, cost: 900, minLevel: 12, rarity: 'epic' },
  { id: 'seers-circlet', kind: 'head', name: "Seer's Circlet", emoji: '🔯', bonus: { hp: 34, atk: 9 }, cost: 1700, minLevel: 16, rarity: 'epic', setId: 'celestial' },
  { id: 'crown-of-dawn', kind: 'head', name: 'Crown of Dawn', emoji: '🌅', bonus: { hp: 70, def: 16 }, cost: 3800, minLevel: 20, rarity: 'legendary' },

  // --- Body ----------------------------------------------------------------
  { id: 'leather-shield', kind: 'body', name: 'Leather Shield', emoji: '🛡️', bonus: { def: 2 }, cost: 60, rarity: 'common' },
  { id: 'iron-shield', kind: 'body', name: 'Iron Shield', emoji: '🔰', bonus: { def: 4 }, cost: 180, minLevel: 5, rarity: 'uncommon', setId: 'ironclad' },
  { id: 'knight-armor', kind: 'body', name: 'Knight Armor', emoji: '🥋', bonus: { hp: 20, def: 6 }, cost: 350, minLevel: 8, rarity: 'uncommon' },
  { id: 'elven-cloak', kind: 'body', name: 'Elven Cloak', emoji: '🧣', bonus: { hp: 25, def: 8 }, cost: 480, minLevel: 10, rarity: 'rare', setId: 'trickster' },
  { id: 'mithril-vest', kind: 'body', name: 'Mithril Vest', emoji: '🦺', bonus: { hp: 40, def: 7 }, cost: 640, minLevel: 11, rarity: 'rare' },
  { id: 'dragonscale-mail', kind: 'body', name: 'Dragonscale Mail', emoji: '🐲', bonus: { hp: 50, def: 12 }, cost: 950, minLevel: 15, rarity: 'rare', setId: 'berserker' },
  { id: 'titan-plate', kind: 'body', name: 'Titan Plate', emoji: '⛑️', bonus: { hp: 40, def: 20 }, cost: 1600, minLevel: 16, rarity: 'epic' },
  { id: 'phantom-shroud', kind: 'body', name: 'Phantom Shroud', emoji: '👻', bonus: { hp: 75, def: 9 }, cost: 1600, minLevel: 16, rarity: 'epic', setId: 'celestial' },
  { id: 'aegis-of-dawn', kind: 'body', name: 'Aegis of Dawn', emoji: '🌅', bonus: { hp: 60, def: 30 }, cost: 3900, minLevel: 20, rarity: 'legendary' },
  { id: 'voidweave-cloak', kind: 'body', name: 'Voidweave Cloak', emoji: '🕸️', bonus: { hp: 120, def: 16 }, cost: 3900, minLevel: 20, rarity: 'legendary' },

  // --- Boots ---------------------------------------------------------------
  { id: 'swift-boots', kind: 'boots', name: 'Swift Boots', emoji: '👢', bonus: { atk: 1, def: 1 }, cost: 90, rarity: 'common' },
  { id: 'studded-greaves', kind: 'boots', name: 'Studded Greaves', emoji: '🥾', bonus: { hp: 14, def: 3 }, cost: 210, minLevel: 5, rarity: 'uncommon', setId: 'ironclad' },
  { id: 'silent-steps', kind: 'boots', name: 'Silent Steps', emoji: '🩰', bonus: { atk: 3, def: 3 }, cost: 460, minLevel: 9, rarity: 'rare', setId: 'trickster' },
  { id: 'ironshod-stompers', kind: 'boots', name: 'Ironshod Stompers', emoji: '🦿', bonus: { hp: 34, atk: 4 }, cost: 820, minLevel: 12, rarity: 'rare', setId: 'berserker' },
  { id: 'windwalkers', kind: 'boots', name: 'Windwalkers', emoji: '🪽', bonus: { hp: 28, atk: 8 }, cost: 1550, minLevel: 16, rarity: 'epic' },
  { id: 'starlit-sandals', kind: 'boots', name: 'Starlit Sandals', emoji: '✨', bonus: { hp: 40, def: 9 }, cost: 1750, minLevel: 17, rarity: 'epic', setId: 'celestial' },
  { id: 'treads-of-the-titan', kind: 'boots', name: 'Treads of the Titan', emoji: '🗿', bonus: { hp: 90, def: 18 }, cost: 3700, minLevel: 20, rarity: 'legendary' },

  // --- Accessories ---------------------------------------------------------
  { id: 'lucky-ribbon', kind: 'accessory', name: 'Lucky Ribbon', emoji: '🎀', bonus: { hp: 15 }, cost: 70, rarity: 'common' },
  { id: 'ruby-ring', kind: 'accessory', name: 'Ruby Ring', emoji: '💍', bonus: { hp: 25, atk: 2 }, cost: 240, minLevel: 6, rarity: 'uncommon' },
  { id: 'guard-amulet', kind: 'accessory', name: 'Guard Amulet', emoji: '📿', bonus: { hp: 15, def: 3 }, cost: 240, minLevel: 6, rarity: 'uncommon' },
  { id: 'wizard-orb', kind: 'accessory', name: 'Wizard Orb', emoji: '🔮', bonus: { hp: 20, atk: 12 }, cost: 650, minLevel: 12, rarity: 'rare' },
  { id: 'emberheart', kind: 'accessory', name: 'Emberheart', emoji: '🧡', bonus: { hp: 35, atk: 9 }, cost: 700, minLevel: 12, rarity: 'rare' },
  { id: 'storm-talisman', kind: 'accessory', name: 'Storm Talisman', emoji: '⚡', bonus: { atk: 20, def: 5 }, cost: 1300, minLevel: 18, rarity: 'rare' },
  { id: 'soul-lantern', kind: 'accessory', name: 'Soul Lantern', emoji: '🏮', bonus: { hp: 60, atk: 11 }, cost: 1800, minLevel: 17, rarity: 'epic' },
  // Was +80/+25/+15, which beat every other charm on every stat at once and so
  // ended the slot as a choice. Now strong but one-sided, like its neighbours.
  { id: 'heros-emblem', kind: 'accessory', name: "Hero's Emblem", emoji: '🌟', bonus: { hp: 55, atk: 16, def: 8 }, cost: 2000, minLevel: 19, rarity: 'epic' },
  { id: 'eternity-shard', kind: 'accessory', name: 'Eternity Shard', emoji: '💎', bonus: { atk: 30, def: 12 }, cost: 5200, minLevel: 22, rarity: 'legendary' },
  { id: 'heartstone', kind: 'accessory', name: 'Heartstone', emoji: '❤️‍🔥', bonus: { hp: 160, def: 18 }, cost: 5200, minLevel: 22, rarity: 'legendary' },
]

export const ITEM_BY_ID = new Map(ITEMS.map((item) => [item.id, item]))

export const ITEM_KINDS: ItemKind[] = ['weapon', 'head', 'body', 'boots', 'accessory']

export const ITEMS_BY_KIND: Record<ItemKind, ShopItem[]> = {
  weapon: ITEMS.filter((i) => i.kind === 'weapon'),
  head: ITEMS.filter((i) => i.kind === 'head'),
  body: ITEMS.filter((i) => i.kind === 'body'),
  boots: ITEMS.filter((i) => i.kind === 'boots'),
  accessory: ITEMS.filter((i) => i.kind === 'accessory'),
}

/** The worn slot an item of this kind goes into; accessories fit either. */
export function slotsForKind(kind: ItemKind): EquipSlot[] {
  return kind === 'accessory' ? ['accessory1', 'accessory2'] : [kind]
}

export function kindForSlot(slot: EquipSlot): ItemKind {
  return slot === 'accessory1' || slot === 'accessory2' ? 'accessory' : slot
}

export function itemsForSlot(slot: EquipSlot): ShopItem[] {
  return ITEMS_BY_KIND[kindForSlot(slot)]
}
