import type { EquipSlot, ShopItem } from '../types'

// One-time equipment purchases, one per slot at a time. Higher-tier pieces are
// level-gated so big stat jumps can't be bought early by grinding gold on low
// stages, and each slot has its own ladder so upgrading means choosing.
export const ITEMS: ShopItem[] = [
  { id: 'wooden-sword', slot: 'weapon', name: 'Wooden Sword', emoji: '🗡️', bonus: { atk: 2 }, cost: 60 },
  { id: 'leather-shield', slot: 'armor', name: 'Leather Shield', emoji: '🛡️', bonus: { def: 2 }, cost: 60 },
  { id: 'lucky-ribbon', slot: 'charm', name: 'Lucky Ribbon', emoji: '🎀', bonus: { hp: 15 }, cost: 70 },
  { id: 'swift-boots', slot: 'armor', name: 'Swift Boots', emoji: '👢', bonus: { atk: 1, def: 1 }, cost: 90 },
  { id: 'brave-gloves', slot: 'weapon', name: 'Brave Gloves', emoji: '🧤', bonus: { atk: 3 }, cost: 110, minLevel: 3 },
  { id: 'cozy-hat', slot: 'armor', name: 'Cozy Hat', emoji: '🎩', bonus: { hp: 20 }, cost: 120, minLevel: 3 },
  { id: 'iron-sword', slot: 'weapon', name: 'Iron Sword', emoji: '⚔️', bonus: { atk: 5 }, cost: 180, minLevel: 5 },
  { id: 'iron-shield', slot: 'armor', name: 'Iron Shield', emoji: '🔰', bonus: { def: 4 }, cost: 180, minLevel: 5 },
  { id: 'ruby-ring', slot: 'charm', name: 'Ruby Ring', emoji: '💍', bonus: { hp: 25, atk: 2 }, cost: 240, minLevel: 6 },
  { id: 'guard-amulet', slot: 'charm', name: 'Guard Amulet', emoji: '📿', bonus: { hp: 15, def: 3 }, cost: 240, minLevel: 6 },
  { id: 'knight-blade', slot: 'weapon', name: 'Knight Blade', emoji: '🗡️', bonus: { atk: 8 }, cost: 350, minLevel: 8 },
  { id: 'knight-armor', slot: 'armor', name: 'Knight Armor', emoji: '🥋', bonus: { hp: 20, def: 6 }, cost: 350, minLevel: 8 },
  { id: 'elven-bow', slot: 'weapon', name: 'Elven Bow', emoji: '🏹', bonus: { atk: 10 }, cost: 480, minLevel: 10 },
  { id: 'elven-cloak', slot: 'armor', name: 'Elven Cloak', emoji: '🧣', bonus: { hp: 25, def: 8 }, cost: 480, minLevel: 10 },
  { id: 'wizard-orb', slot: 'charm', name: 'Wizard Orb', emoji: '🔮', bonus: { hp: 20, atk: 12 }, cost: 650, minLevel: 12 },
  { id: 'royal-crown', slot: 'charm', name: 'Royal Crown', emoji: '👑', bonus: { hp: 40, def: 10 }, cost: 700, minLevel: 12 },
  { id: 'dragonfang', slot: 'weapon', name: 'Dragonfang', emoji: '🦷', bonus: { atk: 16 }, cost: 900, minLevel: 15 },
  { id: 'dragonscale-mail', slot: 'armor', name: 'Dragonscale Mail', emoji: '🐲', bonus: { hp: 50, def: 12 }, cost: 950, minLevel: 15 },
  { id: 'storm-talisman', slot: 'charm', name: 'Storm Talisman', emoji: '⚡', bonus: { atk: 20, def: 5 }, cost: 1300, minLevel: 18 },
  // Was +80/+25/+15, which beat every other charm on every stat at once and so
  // ended the slot as a choice. Now strong but one-sided, like its neighbours.
  { id: 'heros-emblem', slot: 'charm', name: "Hero's Emblem", emoji: '🌟', bonus: { hp: 55, atk: 16, def: 8 }, cost: 2000, minLevel: 19 },

  // --- Tier 2: Worlds 4-6 ---
  { id: 'runed-spear', slot: 'weapon', name: 'Runed Spear', emoji: '🔱', bonus: { atk: 13 }, cost: 620, minLevel: 11 },
  { id: 'mithril-vest', slot: 'armor', name: 'Mithril Vest', emoji: '🦺', bonus: { hp: 40, def: 7 }, cost: 640, minLevel: 11 },
  { id: 'emberheart', slot: 'charm', name: 'Emberheart', emoji: '🧡', bonus: { hp: 35, atk: 9 }, cost: 700, minLevel: 12 },

  // --- Tier 3: Worlds 7-9. Each slot forks here: raw power, or power with
  // some padding. Neither line dominates, so the pick depends on the fight.
  { id: 'sunsteel-blade', slot: 'weapon', name: 'Sunsteel Blade', emoji: '🪓', bonus: { atk: 22 }, cost: 1500, minLevel: 15 },
  { id: 'twin-daggers', slot: 'weapon', name: 'Twin Daggers', emoji: '🔪', bonus: { atk: 17, def: 4 }, cost: 1500, minLevel: 15 },
  { id: 'titan-plate', slot: 'armor', name: 'Titan Plate', emoji: '⛑️', bonus: { hp: 40, def: 20 }, cost: 1600, minLevel: 16 },
  { id: 'phantom-shroud', slot: 'armor', name: 'Phantom Shroud', emoji: '👻', bonus: { hp: 75, def: 9 }, cost: 1600, minLevel: 16 },
  { id: 'soul-lantern', slot: 'charm', name: 'Soul Lantern', emoji: '🏮', bonus: { hp: 60, atk: 11 }, cost: 1800, minLevel: 17 },

  // --- Tier 4: Worlds 10-12 ---
  { id: 'worldbreaker', slot: 'weapon', name: 'Worldbreaker', emoji: '🔨', bonus: { atk: 34 }, cost: 3600, minLevel: 19 },
  { id: 'starfall-glaive', slot: 'weapon', name: 'Starfall Glaive', emoji: '🌠', bonus: { hp: 45, atk: 26 }, cost: 3600, minLevel: 19 },
  { id: 'aegis-of-dawn', slot: 'armor', name: 'Aegis of Dawn', emoji: '🌅', bonus: { hp: 60, def: 30 }, cost: 3900, minLevel: 20 },
  { id: 'voidweave-cloak', slot: 'armor', name: 'Voidweave Cloak', emoji: '🕸️', bonus: { hp: 120, def: 16 }, cost: 3900, minLevel: 20 },
  { id: 'eternity-shard', slot: 'charm', name: 'Eternity Shard', emoji: '💎', bonus: { atk: 30, def: 12 }, cost: 5200, minLevel: 22 },
  { id: 'heartstone', slot: 'charm', name: 'Heartstone', emoji: '❤️‍🔥', bonus: { hp: 160, def: 18 }, cost: 5200, minLevel: 22 },
]

export const ITEM_BY_ID = new Map(ITEMS.map((item) => [item.id, item]))

export const ITEMS_BY_SLOT: Record<EquipSlot, ShopItem[]> = {
  weapon: ITEMS.filter((i) => i.slot === 'weapon'),
  armor: ITEMS.filter((i) => i.slot === 'armor'),
  charm: ITEMS.filter((i) => i.slot === 'charm'),
}
