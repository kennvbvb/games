import type { ShopItem } from '../types'

// One-time equipment purchases. Higher-tier pieces are level-gated so big
// stat jumps can't be bought early by grinding gold on low stages.
export const ITEMS: ShopItem[] = [
  { id: 'wooden-sword', name: 'Wooden Sword', emoji: '🗡️', bonus: { atk: 2 }, cost: 60 },
  { id: 'leather-shield', name: 'Leather Shield', emoji: '🛡️', bonus: { def: 2 }, cost: 60 },
  { id: 'lucky-ribbon', name: 'Lucky Ribbon', emoji: '🎀', bonus: { hp: 15 }, cost: 70 },
  { id: 'swift-boots', name: 'Swift Boots', emoji: '👢', bonus: { atk: 1, def: 1 }, cost: 90 },
  { id: 'brave-gloves', name: 'Brave Gloves', emoji: '🧤', bonus: { atk: 3 }, cost: 110, minLevel: 3 },
  { id: 'cozy-hat', name: 'Cozy Hat', emoji: '🎩', bonus: { hp: 20 }, cost: 120, minLevel: 3 },
  { id: 'iron-sword', name: 'Iron Sword', emoji: '⚔️', bonus: { atk: 5 }, cost: 180, minLevel: 5 },
  { id: 'iron-shield', name: 'Iron Shield', emoji: '🔰', bonus: { def: 4 }, cost: 180, minLevel: 5 },
  { id: 'ruby-ring', name: 'Ruby Ring', emoji: '💍', bonus: { hp: 25, atk: 2 }, cost: 240, minLevel: 6 },
  { id: 'guard-amulet', name: 'Guard Amulet', emoji: '📿', bonus: { hp: 15, def: 3 }, cost: 240, minLevel: 6 },
  { id: 'knight-blade', name: 'Knight Blade', emoji: '🗡️', bonus: { atk: 8 }, cost: 350, minLevel: 8 },
  { id: 'knight-armor', name: 'Knight Armor', emoji: '🥋', bonus: { hp: 20, def: 6 }, cost: 350, minLevel: 8 },
  { id: 'elven-bow', name: 'Elven Bow', emoji: '🏹', bonus: { atk: 10 }, cost: 480, minLevel: 10 },
  { id: 'elven-cloak', name: 'Elven Cloak', emoji: '🧣', bonus: { hp: 25, def: 8 }, cost: 480, minLevel: 10 },
  { id: 'wizard-orb', name: 'Wizard Orb', emoji: '🔮', bonus: { hp: 20, atk: 12 }, cost: 650, minLevel: 12 },
  { id: 'royal-crown', name: 'Royal Crown', emoji: '👑', bonus: { hp: 40, def: 10 }, cost: 700, minLevel: 12 },
  { id: 'dragonfang', name: 'Dragonfang', emoji: '🦷', bonus: { atk: 16 }, cost: 900, minLevel: 15 },
  { id: 'dragonscale-mail', name: 'Dragonscale Mail', emoji: '🐲', bonus: { hp: 50, def: 12 }, cost: 950, minLevel: 15 },
  { id: 'storm-talisman', name: 'Storm Talisman', emoji: '⚡', bonus: { atk: 20, def: 5 }, cost: 1300, minLevel: 18 },
  { id: 'heros-emblem', name: "Hero's Emblem", emoji: '🌟', bonus: { hp: 80, atk: 25, def: 15 }, cost: 2000, minLevel: 20 },
]

export const ITEM_BY_ID = new Map(ITEMS.map((item) => [item.id, item]))
