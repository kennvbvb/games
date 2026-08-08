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
/**
 * The four ungated starter pieces are tagged `flexible` on purpose. A player
 * two stages in has no build yet and no way to know what the campaign will ask
 * of them, so the first thing they buy should not quietly commit them to an
 * answer — and resonance is a mid-game reward for a lean taken deliberately,
 * not something the tutorial hands out.
 */
export const ITEMS: ShopItem[] = [
  // --- Weapons -------------------------------------------------------------
  { id: 'wooden-sword', kind: 'weapon', name: 'Wooden Sword', emoji: '🗡️', bonus: { atk: 2 }, cost: 60, buildTag: 'flexible', rarity: 'common' },
  { id: 'brave-gloves', kind: 'weapon', name: 'Brave Gloves', emoji: '🧤', bonus: { atk: 3 }, cost: 110, minLevel: 3, buildTag: 'breaker', rarity: 'common' },
  { id: 'iron-sword', kind: 'weapon', name: 'Iron Sword', emoji: '⚔️', bonus: { atk: 5 }, cost: 180, minLevel: 5, buildTag: 'breaker', rarity: 'uncommon', setId: 'ironclad' },
  { id: 'knight-blade', kind: 'weapon', name: 'Knight Blade', emoji: '🗡️', bonus: { atk: 8 }, cost: 350, minLevel: 8, buildTag: 'breaker', rarity: 'uncommon' },
  { id: 'elven-bow', kind: 'weapon', name: 'Elven Bow', emoji: '🏹', bonus: { atk: 10 }, cost: 480, minLevel: 10, buildTag: 'breaker', rarity: 'rare', setId: 'trickster' },
  { id: 'runed-spear', kind: 'weapon', name: 'Runed Spear', emoji: '🔱', bonus: { atk: 13 }, cost: 620, minLevel: 11, buildTag: 'breaker', rarity: 'rare' },
  { id: 'dragonfang', kind: 'weapon', name: 'Dragonfang', emoji: '🦷', bonus: { atk: 16 }, cost: 900, minLevel: 15, buildTag: 'breaker', rarity: 'rare' },
  { id: 'sunsteel-blade', kind: 'weapon', name: 'Sunsteel Blade', emoji: '🪓', bonus: { atk: 22 }, cost: 1500, minLevel: 15, buildTag: 'breaker', rarity: 'epic' },
  { id: 'twin-daggers', kind: 'weapon', name: 'Twin Daggers', emoji: '🔪', bonus: { atk: 17, def: 4 }, cost: 1500, minLevel: 15, buildTag: 'breaker', rarity: 'epic' },
  { id: 'worldbreaker', kind: 'weapon', name: 'Worldbreaker', emoji: '🔨', bonus: { atk: 34 }, cost: 3600, minLevel: 19, buildTag: 'breaker', rarity: 'legendary', setId: 'berserker' },
  { id: 'starfall-glaive', kind: 'weapon', name: 'Starfall Glaive', emoji: '🌠', bonus: { hp: 45, atk: 26 }, cost: 3600, minLevel: 19, buildTag: 'breaker', rarity: 'legendary', setId: 'celestial' },

  // --- Head ----------------------------------------------------------------
  { id: 'cozy-hat', kind: 'head', name: 'Cozy Hat', emoji: '🎩', bonus: { hp: 20 }, cost: 120, minLevel: 3, buildTag: 'bulwark', rarity: 'common' },
  { id: 'iron-helm', kind: 'head', name: 'Iron Helm', emoji: '⛑️', bonus: { hp: 16, def: 3 }, cost: 200, minLevel: 5, buildTag: 'bulwark', rarity: 'uncommon', setId: 'ironclad' },
  { id: 'hood-of-whispers', kind: 'head', name: 'Hood of Whispers', emoji: '🥷', bonus: { atk: 4, def: 2 }, cost: 420, minLevel: 9, buildTag: 'breaker', rarity: 'rare', setId: 'trickster' },
  { id: 'horned-casque', kind: 'head', name: 'Horned Casque', emoji: '🪖', bonus: { hp: 30, atk: 5 }, cost: 760, minLevel: 12, buildTag: 'tempo', rarity: 'rare', setId: 'berserker' },
  { id: 'royal-crown', kind: 'head', name: 'Royal Crown', emoji: '👑', bonus: { hp: 40, def: 10 }, cost: 900, minLevel: 12, buildTag: 'bulwark', rarity: 'epic' },
  { id: 'seers-circlet', kind: 'head', name: "Seer's Circlet", emoji: '🔯', bonus: { hp: 34, atk: 9 }, cost: 1700, minLevel: 16, buildTag: 'tempo', rarity: 'epic', setId: 'celestial' },
  { id: 'crown-of-dawn', kind: 'head', name: 'Crown of Dawn', emoji: '🌅', bonus: { hp: 70, def: 16 }, cost: 3800, minLevel: 20, buildTag: 'bulwark', rarity: 'legendary' },

  // --- Body ----------------------------------------------------------------
  { id: 'leather-shield', kind: 'body', name: 'Leather Shield', emoji: '🛡️', bonus: { def: 2 }, cost: 60, buildTag: 'flexible', rarity: 'common' },
  { id: 'iron-shield', kind: 'body', name: 'Iron Shield', emoji: '🔰', bonus: { def: 4 }, cost: 180, minLevel: 5, buildTag: 'bulwark', rarity: 'uncommon', setId: 'ironclad' },
  { id: 'knight-armor', kind: 'body', name: 'Knight Armor', emoji: '🥋', bonus: { hp: 20, def: 6 }, cost: 350, minLevel: 8, buildTag: 'bulwark', rarity: 'uncommon' },
  { id: 'elven-cloak', kind: 'body', name: 'Elven Cloak', emoji: '🧣', bonus: { hp: 25, def: 8 }, cost: 480, minLevel: 10, buildTag: 'bulwark', rarity: 'rare', setId: 'trickster' },
  { id: 'mithril-vest', kind: 'body', name: 'Mithril Vest', emoji: '🦺', bonus: { hp: 40, def: 7 }, cost: 640, minLevel: 11, buildTag: 'bulwark', rarity: 'rare' },
  { id: 'dragonscale-mail', kind: 'body', name: 'Dragonscale Mail', emoji: '🐲', bonus: { hp: 50, def: 12 }, cost: 950, minLevel: 15, buildTag: 'bulwark', rarity: 'rare', setId: 'berserker' },
  { id: 'titan-plate', kind: 'body', name: 'Titan Plate', emoji: '⛑️', bonus: { hp: 40, def: 20 }, cost: 1600, minLevel: 16, buildTag: 'bulwark', rarity: 'epic' },
  { id: 'phantom-shroud', kind: 'body', name: 'Phantom Shroud', emoji: '👻', bonus: { hp: 75, def: 9 }, cost: 1600, minLevel: 16, buildTag: 'bulwark', rarity: 'epic', setId: 'celestial' },
  { id: 'aegis-of-dawn', kind: 'body', name: 'Aegis of Dawn', emoji: '🌅', bonus: { hp: 60, def: 30 }, cost: 3900, minLevel: 20, buildTag: 'bulwark', rarity: 'legendary' },
  { id: 'voidweave-cloak', kind: 'body', name: 'Voidweave Cloak', emoji: '🕸️', bonus: { hp: 120, def: 16 }, cost: 3900, minLevel: 20, buildTag: 'bulwark', rarity: 'legendary' },

  // --- Boots ---------------------------------------------------------------
  { id: 'swift-boots', kind: 'boots', name: 'Swift Boots', emoji: '👢', bonus: { atk: 1, def: 1 }, cost: 90, buildTag: 'flexible', rarity: 'common' },
  { id: 'studded-greaves', kind: 'boots', name: 'Studded Greaves', emoji: '🥾', bonus: { hp: 14, def: 3 }, cost: 210, minLevel: 5, buildTag: 'bulwark', rarity: 'uncommon', setId: 'ironclad' },
  { id: 'silent-steps', kind: 'boots', name: 'Silent Steps', emoji: '🩰', bonus: { atk: 3, def: 3 }, cost: 460, minLevel: 9, buildTag: 'tempo', rarity: 'rare', setId: 'trickster' },
  { id: 'ironshod-stompers', kind: 'boots', name: 'Ironshod Stompers', emoji: '🦿', bonus: { hp: 34, atk: 4 }, cost: 820, minLevel: 12, buildTag: 'tempo', rarity: 'rare', setId: 'berserker' },
  { id: 'windwalkers', kind: 'boots', name: 'Windwalkers', emoji: '🪽', bonus: { hp: 28, atk: 8 }, cost: 1550, minLevel: 16, buildTag: 'tempo', rarity: 'epic' },
  { id: 'starlit-sandals', kind: 'boots', name: 'Starlit Sandals', emoji: '✨', bonus: { hp: 40, def: 9 }, cost: 1750, minLevel: 17, buildTag: 'bulwark', rarity: 'epic', setId: 'celestial' },
  { id: 'treads-of-the-titan', kind: 'boots', name: 'Treads of the Titan', emoji: '🗿', bonus: { hp: 90, def: 18 }, cost: 3700, minLevel: 20, buildTag: 'bulwark', rarity: 'legendary' },

  // --- Accessories ---------------------------------------------------------
  { id: 'lucky-ribbon', kind: 'accessory', name: 'Lucky Ribbon', emoji: '🎀', bonus: { hp: 15 }, cost: 70, buildTag: 'flexible', rarity: 'common' },
  { id: 'ruby-ring', kind: 'accessory', name: 'Ruby Ring', emoji: '💍', bonus: { hp: 25, atk: 2 }, cost: 240, minLevel: 6, buildTag: 'bulwark', rarity: 'uncommon' },
  { id: 'guard-amulet', kind: 'accessory', name: 'Guard Amulet', emoji: '📿', bonus: { hp: 15, def: 3 }, cost: 240, minLevel: 6, buildTag: 'bulwark', rarity: 'uncommon' },
  { id: 'wizard-orb', kind: 'accessory', name: 'Wizard Orb', emoji: '🔮', bonus: { hp: 20, atk: 12 }, cost: 650, minLevel: 12, buildTag: 'breaker', rarity: 'rare' },
  { id: 'emberheart', kind: 'accessory', name: 'Emberheart', emoji: '🧡', bonus: { hp: 35, atk: 9 }, cost: 700, minLevel: 12, buildTag: 'tempo', rarity: 'rare' },
  { id: 'storm-talisman', kind: 'accessory', name: 'Storm Talisman', emoji: '⚡', bonus: { atk: 20, def: 5 }, cost: 1300, minLevel: 18, buildTag: 'breaker', rarity: 'rare' },
  { id: 'soul-lantern', kind: 'accessory', name: 'Soul Lantern', emoji: '🏮', bonus: { hp: 60, atk: 11 }, cost: 1800, minLevel: 17, buildTag: 'tempo', rarity: 'epic' },
  // Was +80/+25/+15, which beat every other charm on every stat at once and so
  // ended the slot as a choice. Now strong but one-sided, like its neighbours.
  { id: 'heros-emblem', kind: 'accessory', name: "Hero's Emblem", emoji: '🌟', bonus: { hp: 55, atk: 16, def: 8 }, cost: 2000, minLevel: 19, buildTag: 'tempo', rarity: 'epic' },
  { id: 'eternity-shard', kind: 'accessory', name: 'Eternity Shard', emoji: '💎', bonus: { atk: 30, def: 12 }, cost: 5200, minLevel: 22, buildTag: 'breaker', rarity: 'legendary' },
  { id: 'heartstone', kind: 'accessory', name: 'Heartstone', emoji: '❤️‍🔥', bonus: { hp: 160, def: 18 }, cost: 5200, minLevel: 22, buildTag: 'bulwark', rarity: 'legendary' },
  // Filling holes the build matrix had once every piece was tagged: Bulwark
  // owned no weapon at all, Tempo no body piece and Breaker no boots, so those
  // builds could not be led by the slot that defines them. Ordinary gear, not
  // relics — they exist to make each build assemblable, not to be exciting.
  { id: 'anchor-mace', kind: 'weapon', name: 'Anchor Mace', emoji: '⚓', bonus: { atk: 15, def: 10 }, cost: 1500, minLevel: 12, buildTag: 'bulwark', rarity: 'epic' },
  { id: 'guardian-spear', kind: 'weapon', name: 'Guardian Spear', emoji: '🔰', bonus: { hp: 70, atk: 16, def: 14 }, cost: 3400, minLevel: 18, buildTag: 'bulwark', rarity: 'epic' },
  { id: 'windrunner-coat', kind: 'body', name: 'Windrunner Coat', emoji: '🧥', bonus: { hp: 95, atk: 8, def: 17 }, cost: 3300, minLevel: 18, buildTag: 'tempo', rarity: 'epic' },
  { id: 'fangstep-greaves', kind: 'boots', name: 'Fangstep Greaves', emoji: '🦶', bonus: { atk: 16, def: 6 }, cost: 1400, minLevel: 11, buildTag: 'breaker', rarity: 'rare' },

  // ---------------------------------------------------------------------------
  // Relic tier: the first six pieces that exist for an *effect* rather than a
  // stat line. Two per build, so each of the three has a real pair to lean on
  // and the two-piece resonance is reachable without wearing a whole set.
  //
  // Won from the tower, never bought. Every one is a guaranteed first-clear
  // reward on a boss floor — see systems/tower for which floor pays which. A
  // relic on a shop shelf is a relic with a gold price rather than a reason to
  // climb, and the tower's whole job is to be the reason.
  // ---------------------------------------------------------------------------
  { id: 'void-pike', kind: 'weapon', name: 'Void Pike', emoji: '🔱', bonus: { atk: 32 }, cost: 5200, minLevel: 22, buildTag: 'breaker', rarity: 'legendary', source: 'tower', effect: { description: 'Strips 6 defence from every enemy', mods: { pierce: 6 } } },
  { id: 'hunter-mantle', kind: 'body', name: "Hunter's Mantle", emoji: '🥷', bonus: { hp: 75, atk: 12, def: 18 }, cost: 5000, minLevel: 22, buildTag: 'breaker', rarity: 'legendary', source: 'tower', effect: { description: 'Below 35% health, deal 30% more', mods: { execute: 1.3, executeBelow: 0.35 } } },
  { id: 'bastion-mail', kind: 'body', name: 'Bastion Mail', emoji: '🛡️', bonus: { hp: 110, def: 28 }, cost: 5200, minLevel: 22, buildTag: 'bulwark', rarity: 'legendary', source: 'tower', effect: { description: 'Start behind a 22% shield, take 7% less', mods: { shield: 0.22, incoming: 0.93 } } },
  { id: 'crown-of-resolve', kind: 'head', name: 'Crown of Resolve', emoji: '👑', bonus: { hp: 85, def: 14 }, cost: 5000, minLevel: 22, buildTag: 'bulwark', rarity: 'legendary', source: 'tower', effect: { description: 'Take 10% less from every hit', mods: { incoming: 0.9 } } },
  { id: 'clockwork-blades', kind: 'weapon', name: 'Clockwork Blades', emoji: '⚙️', bonus: { atk: 29 }, cost: 5200, minLevel: 22, buildTag: 'tempo', rarity: 'legendary', source: 'tower', effect: { description: 'Every 3rd blow hits 35% harder', mods: { comboEvery: 3, combo: 1.35 } } },
  { id: 'spring-totem', kind: 'accessory', name: 'Spring Totem', emoji: '💧', bonus: { hp: 75, atk: 12 }, cost: 5000, minLevel: 22, buildTag: 'tempo', rarity: 'legendary', source: 'tower', effect: { description: 'Mend 3% of health every 3rd attack', mods: { heal: 0.03, healEvery: 3 } } },

]

export const ITEM_BY_ID = new Map(ITEMS.map((item) => [item.id, item]))

/**
 * The pieces the shop actually sells. Everything else in the catalogue is won,
 * and still lives in `ITEMS` so it can be worn, compared and collected exactly
 * like a bought piece once it has been earned.
 */
export const SHOP_ITEMS = ITEMS.filter((item) => (item.source ?? 'shop') === 'shop')

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
