import { backgroundFor } from './biomes'
import type { StageVisual } from './biomes'
import type { BossPhase, EnemyConfig, StageConfig } from '../types'
import type { TraitId } from './enemyTraits'

interface StageDef {
  name: string
  trait: TraitId
  visual: StageVisual
  enemy: string
}

/**
 * A hundred stages in twenty worlds of five.
 *
 * Ids are positional (`stage-<order>`) and every stage that already existed
 * keeps both its id and its name, so an existing save's cleared list still
 * points at the same places and its unlock progress means the same thing.
 */
const STAGE_DEFS: StageDef[] = [
  // World 1 — Whispering Wilds
  { name: 'Whispering Woods', trait: 'straightforward', enemy: 'Grub', visual: { biome: 'forest', landmark: 'decor_tree' } },
  { name: 'Bramble Hollow', trait: 'slippery', enemy: 'Prickle', visual: { biome: 'forest', landmark: 'decor_herb', weather: 'decor_leaf' } },
  { name: 'Stonefang Ridge', trait: 'fierce', enemy: 'Tusker', visual: { biome: 'ridge', landmark: 'decor_mountain' } },
  { name: 'Sunken Marsh', trait: 'mending', enemy: 'Bog Warden', visual: { biome: 'marsh', landmark: 'decor_lotus' } },
  { name: 'Ashen Crypt', trait: 'slippery', enemy: 'Wisp', visual: { biome: 'crypt', landmark: 'decor_candle' } },

  // World 2 — Peaks & Depths
  { name: 'Frostpeak Pass', trait: 'fierce', enemy: 'Howler', visual: { biome: 'frost', landmark: 'decor_snowman' } },
  { name: 'Ember Caverns', trait: 'mending', enemy: 'Emberling', visual: { biome: 'ember', landmark: 'decor_volcano' } },
  { name: 'Shattered Coast', trait: 'slippery', enemy: 'Tidecaller', visual: { biome: 'coast', landmark: 'decor_anchor' } },
  { name: 'Wraith Hollow', trait: 'mending', enemy: 'Flitter', visual: { biome: 'crypt', landmark: 'decor_owl', weather: 'decor_fog' } },
  { name: 'Obsidian Spire', trait: 'fierce', enemy: 'Weaver', visual: { biome: 'spire', landmark: 'decor_tower' } },

  // World 3 — Cursed Frontier
  { name: 'Storm Bastion', trait: 'slippery', enemy: 'Screecher', visual: { biome: 'spire', landmark: 'decor_castle', weather: 'decor_storm' } },
  { name: "Dragon's Maw", trait: 'fierce', enemy: 'Elder Wyrm', visual: { biome: 'ember', landmark: 'decor_skull' } },
  { name: 'Crystal Grotto', trait: 'mending', enemy: 'Glimmerwing', visual: { biome: 'spire', landmark: 'decor_crystal', weather: 'decor_sparkle' } },
  { name: 'Moonlit Ruins', trait: 'slippery', enemy: 'Pale Moth', visual: { biome: 'crypt', landmark: 'decor_ring', weather: 'decor_moon' } },
  { name: 'Ancient Canopy', trait: 'fierce', enemy: 'Old Bough', visual: { biome: 'forest', landmark: 'decor_lantern', weather: 'decor_sparkle' } },

  // World 4 — Beyond the Sky
  { name: 'Coral Abyss', trait: 'mending', enemy: 'Reefkin', visual: { biome: 'coast', landmark: 'decor_coral', weather: 'decor_bubble' } },
  { name: 'Golden Savanna', trait: 'fierce', enemy: 'Sunmane', visual: { biome: 'desert', landmark: 'decor_wheat' } },
  { name: 'Starfall Observatory', trait: 'slippery', enemy: 'Comet', visual: { biome: 'spire', landmark: 'decor_galaxy', weather: 'decor_comet' } },
  { name: 'Void Labyrinth', trait: 'mending', enemy: 'Spiral', visual: { biome: 'rift', landmark: 'decor_portal' } },
  { name: 'Celestial Throne', trait: 'fierce', enemy: 'Seraph', visual: { biome: 'divine', landmark: 'decor_castle', weather: 'icon_cloud' } },

  // World 5 — Arcane Dominion
  { name: 'Apprentice Quarter', trait: 'straightforward', enemy: 'Adept', visual: { biome: 'arcane', landmark: 'decor_lantern' } },
  { name: 'Rune Gardens', trait: 'mending', enemy: 'Runeling', visual: { biome: 'arcane', landmark: 'decor_flower', weather: 'decor_sparkle' } },
  { name: 'Mirror Hall', trait: 'slippery', enemy: 'Reflection', visual: { biome: 'arcane', landmark: 'decor_crystal' } },
  { name: 'Mana Reactor', trait: 'fierce', enemy: 'Arc', visual: { biome: 'arcane', landmark: 'decor_bolt', weather: 'decor_bolt' } },
  { name: 'Grand Arcanum', trait: 'mending', enemy: 'Archmage', visual: { biome: 'arcane', landmark: 'decor_tower', weather: 'decor_portal' } },

  // World 6 — Iron Kingdom
  { name: 'Gearwood Outpost', trait: 'slippery', enemy: 'Cogling', visual: { biome: 'iron', landmark: 'decor_tree' } },
  { name: 'Clockwork Foundry', trait: 'fierce', enemy: 'Hammerhead', visual: { biome: 'iron', landmark: 'decor_gear', weather: 'decor_fire' } },
  { name: 'Steelway Bridge', trait: 'straightforward', enemy: 'Spanbreaker', visual: { biome: 'iron', landmark: 'decor_wave' } },
  { name: 'Iron Citadel', trait: 'mending', enemy: 'Bulwark', visual: { biome: 'iron', landmark: 'decor_castle' } },
  { name: 'Titan Forge', trait: 'fierce', enemy: 'Moltenheart', visual: { biome: 'iron', landmark: 'decor_volcano', weather: 'decor_fire' } },

  // World 7 — Sunscorch Empire
  { name: 'Sunscorch Dunes', trait: 'fierce', enemy: 'Scorpid', visual: { biome: 'desert', landmark: 'decor_sand' } },
  { name: 'Oasis Mirage', trait: 'slippery', enemy: 'Thornspire', visual: { biome: 'desert', landmark: 'decor_cactus', weather: 'icon_cloud' } },
  { name: 'Scorpion Tomb', trait: 'mending', enemy: 'Sandcrawler', visual: { biome: 'desert', landmark: 'decor_headstone', weather: 'decor_fog' } },
  { name: 'Sandstorm Palace', trait: 'slippery', enemy: 'Duststorm', visual: { biome: 'desert', landmark: 'decor_tower', weather: 'decor_storm' } },
  { name: 'Solar Colossus', trait: 'fierce', enemy: 'Sunward', visual: { biome: 'desert', landmark: 'decor_ring', weather: 'decor_sun' } },

  // World 8 — The Underrealm
  { name: 'Fungal Depths', trait: 'mending', enemy: 'Sporecap', visual: { biome: 'underrealm', landmark: 'decor_mushroom' } },
  { name: 'Bone Mines', trait: 'fierce', enemy: 'Gravepick', visual: { biome: 'underrealm', landmark: 'decor_skull' } },
  { name: 'Bloodstone Chasm', trait: 'mending', enemy: 'Bloodstone', visual: { biome: 'underrealm', landmark: 'decor_gem', weather: 'decor_fog' } },
  { name: 'Demon Gate', trait: 'slippery', enemy: 'Gatekeeper', visual: { biome: 'underrealm', landmark: 'decor_portal' } },
  { name: "Underlord's Throne", trait: 'fierce', enemy: 'Underlord', visual: { biome: 'underrealm', landmark: 'decor_castle', weather: 'decor_fire' } },

  // World 9 — Spirit Frontier
  { name: 'Bamboo Valley', trait: 'slippery', enemy: 'Reedstalker', visual: { biome: 'spirit', landmark: 'decor_bamboo' } },
  { name: 'Sakura Shrine', trait: 'mending', enemy: 'Petalkeeper', visual: { biome: 'spirit', landmark: 'decor_sakura' } },
  { name: 'Thunder Prairie', trait: 'fierce', enemy: 'Stormcaller', visual: { biome: 'spirit', landmark: 'decor_wheat', weather: 'decor_storm' } },
  { name: 'Beast King Arena', trait: 'straightforward', enemy: 'Beast King', visual: { biome: 'spirit', landmark: 'decor_ring' } },
  { name: 'Spirit Summit', trait: 'mending', enemy: 'Mountainheart', visual: { biome: 'spirit', landmark: 'decor_mountain', weather: 'decor_sparkle' } },

  // World 10 — Frozen Eternity
  { name: 'Aurora Tundra', trait: 'slippery', enemy: 'Frostpelt', visual: { biome: 'frost', landmark: 'decor_galaxy' } },
  { name: 'Icebound Village', trait: 'mending', enemy: 'Hearthkeeper', visual: { biome: 'frost', landmark: 'decor_lantern' } },
  { name: 'Crystal Glacier', trait: 'fierce', enemy: 'Glacierborn', visual: { biome: 'frost', landmark: 'decor_crystal' } },
  { name: 'Frozen Keep', trait: 'slippery', enemy: 'Rimewarden', visual: { biome: 'frost', landmark: 'decor_castle', weather: 'decor_snowcloud' } },
  { name: 'Winter Titan', trait: 'fierce', enemy: 'Winter Titan', visual: { biome: 'frost', landmark: 'decor_skull', weather: 'decor_storm' } },

  // World 11 — Rift of Worlds
  { name: 'Fragmented Realm', trait: 'slippery', enemy: 'Shardling', visual: { biome: 'rift', landmark: 'decor_crystal' } },
  { name: 'Timeworn Path', trait: 'mending', enemy: 'Hourglass', visual: { biome: 'rift', landmark: 'decor_clock' } },
  { name: 'Gravity Well', trait: 'fierce', enemy: 'Orbital', visual: { biome: 'rift', landmark: 'decor_rock', weather: 'decor_galaxy' } },
  { name: 'Chaos Nexus', trait: 'slippery', enemy: 'Masque', visual: { biome: 'rift', landmark: 'decor_orb', weather: 'decor_portal' } },
  { name: 'Rift Sovereign', trait: 'fierce', enemy: 'Rift Sovereign', visual: { biome: 'rift', landmark: 'decor_tower', weather: 'decor_comet' } },

  // World 12 — Divine Ascension
  { name: 'Dawn Stairway', trait: 'straightforward', enemy: 'Dawnward', visual: { biome: 'divine', landmark: 'decor_mountain', weather: 'icon_cloud' } },
  { name: 'Seraphic Garden', trait: 'mending', enemy: 'Plumekeeper', visual: { biome: 'divine', landmark: 'decor_feather' } },
  { name: 'Hall of Trials', trait: 'fierce', enemy: 'Arbiter', visual: { biome: 'divine', landmark: 'decor_scales' } },
  { name: 'Crown of Stars', trait: 'slippery', enemy: 'Starcrown', visual: { biome: 'divine', landmark: 'decor_galaxy', weather: 'decor_sparkle' } },
  { name: "Eternity's End", trait: 'fierce', enemy: 'Eternity', visual: { biome: 'divine', landmark: 'decor_castle', weather: 'decor_comet' } },
  // World 13 — Oceanic Dominion
  { name: 'Pearl Coast', trait: 'straightforward', enemy: 'Pearlback', visual: { biome: 'ocean', landmark: 'decor_shell' } },
  { name: 'Kelpwood Maze', trait: 'slippery', enemy: 'Kelpstrider', visual: { biome: 'ocean', landmark: 'decor_herb', weather: 'decor_bubble' } },
  { name: 'Siren Ruins', trait: 'venomous', enemy: 'Siren', visual: { biome: 'ocean', landmark: 'decor_tower' } },
  { name: 'Leviathan Trench', trait: 'vampiric', enemy: 'Leviathan', visual: { biome: 'ocean', landmark: 'decor_wave', weather: 'decor_fog' } },
  { name: 'Tidal Crown', trait: 'shielded', enemy: 'Tidewarden', visual: { biome: 'ocean', landmark: 'decor_coral', weather: 'decor_storm' } },

  // World 14 — Verdant Rebirth
  { name: 'Mossborn Village', trait: 'mending', enemy: 'Mossling', visual: { biome: 'verdant', landmark: 'decor_mushroom' } },
  { name: 'Blooming Labyrinth', trait: 'venomous', enemy: 'Petalmaze', visual: { biome: 'verdant', landmark: 'decor_flower', weather: 'decor_leaf' } },
  { name: 'Living Temple', trait: 'armored', enemy: 'Templeheart', visual: { biome: 'verdant', landmark: 'decor_castle' } },
  { name: 'Heartwood Sanctum', trait: 'mending', enemy: 'Heartwood', visual: { biome: 'verdant', landmark: 'decor_tree', weather: 'decor_sparkle' } },
  { name: 'Worldroot Avatar', trait: 'vampiric', enemy: 'Worldroot', visual: { biome: 'verdant', landmark: 'decor_herb', weather: 'decor_storm' } },

  // World 15 — Shadow Empire
  { name: 'Dusk Market', trait: 'slippery', enemy: 'Cutpurse', visual: { biome: 'shadow', landmark: 'decor_lantern' } },
  { name: 'Moonless Canal', trait: 'disruptive', enemy: 'Canalstalker', visual: { biome: 'shadow', landmark: 'decor_wave', weather: 'decor_fog' } },
  { name: 'Assassin Citadel', trait: 'countering', enemy: 'Nightblade', visual: { biome: 'shadow', landmark: 'decor_castle' } },
  { name: 'Eclipse Court', trait: 'phasebound', enemy: 'Eclipsed', visual: { biome: 'shadow', landmark: 'decor_moon' } },
  { name: 'Shadow Emperor', trait: 'disruptive', enemy: 'Shadow Emperor', visual: { biome: 'shadow', landmark: 'decor_skull', weather: 'decor_fog' } },

  // World 16 — Infernal Crusade
  { name: 'Cinder Wastes', trait: 'fierce', enemy: 'Cinderling', visual: { biome: 'infernal', landmark: 'decor_rock' } },
  { name: 'Chain Fortress', trait: 'armored', enemy: 'Chainwarden', visual: { biome: 'infernal', landmark: 'decor_castle' } },
  { name: 'Furnace Cathedral', trait: 'venomous', enemy: 'Forgepriest', visual: { biome: 'infernal', landmark: 'decor_volcano', weather: 'decor_fire' } },
  { name: 'Hellstorm Gate', trait: 'unstable', enemy: 'Gatefiend', visual: { biome: 'infernal', landmark: 'decor_portal', weather: 'decor_storm' } },
  { name: 'Infernal Regent', trait: 'fierce', enemy: 'Infernal Regent', visual: { biome: 'infernal', landmark: 'decor_skull', weather: 'decor_comet' } },

  // World 17 — Ancient Cosmos
  { name: 'Lunar Archive', trait: 'straightforward', enemy: 'Archivist', visual: { biome: 'cosmos', landmark: 'decor_moon' } },
  { name: 'Comet Fields', trait: 'unstable', enemy: 'Cometrider', visual: { biome: 'cosmos', landmark: 'decor_comet', weather: 'decor_comet' } },
  { name: 'Planetary Forge', trait: 'armored', enemy: 'Forgestar', visual: { biome: 'cosmos', landmark: 'decor_gear', weather: 'decor_fire' } },
  { name: 'Cosmic Library', trait: 'shielded', enemy: 'Loremind', visual: { biome: 'cosmos', landmark: 'decor_tower' } },
  { name: 'Astral Architect', trait: 'countering', enemy: 'Architect', visual: { biome: 'cosmos', landmark: 'decor_orb', weather: 'decor_galaxy' } },

  // World 18 — Dreamscape
  { name: 'Slumbering Meadow', trait: 'mending', enemy: 'Dozeflower', visual: { biome: 'dream', landmark: 'decor_flower' } },
  { name: 'Memory Theatre', trait: 'disruptive', enemy: 'Understudy', visual: { biome: 'dream', landmark: 'decor_ring' } },
  { name: 'Nightmare Corridor', trait: 'phasebound', enemy: 'Nightmare', visual: { biome: 'dream', landmark: 'decor_web', weather: 'decor_fog' } },
  { name: 'Lucid Palace', trait: 'shielded', enemy: 'Lucid', visual: { biome: 'dream', landmark: 'decor_castle', weather: 'decor_sparkle' } },
  { name: 'Dream Eater', trait: 'unstable', enemy: 'Dream Eater', visual: { biome: 'dream', landmark: 'decor_orb', weather: 'decor_moon' } },

  // World 19 — Last Reality
  { name: 'Broken Timeline', trait: 'slippery', enemy: 'Splinter', visual: { biome: 'unmade', landmark: 'decor_clock' } },
  { name: 'Echo of Heroes', trait: 'countering', enemy: 'Echo', visual: { biome: 'unmade', landmark: 'decor_scales' } },
  { name: 'Fallen Worlds', trait: 'vampiric', enemy: 'Fallen', visual: { biome: 'unmade', landmark: 'decor_mountain', weather: 'decor_fog' } },
  { name: 'Origin Collapse', trait: 'unstable', enemy: 'Collapse', visual: { biome: 'unmade', landmark: 'decor_portal', weather: 'decor_comet' } },
  { name: 'Reality Devourer', trait: 'countering', enemy: 'Devourer', visual: { biome: 'unmade', landmark: 'decor_skull', weather: 'decor_galaxy' } },

  // World 20 — New Eternity
  { name: 'First Light', trait: 'armored', enemy: 'Firstborn', visual: { biome: 'genesis', landmark: 'decor_sun' } },
  { name: 'Garden of Creation', trait: 'mending', enemy: 'Gardener', visual: { biome: 'genesis', landmark: 'decor_flower', weather: 'decor_leaf' } },
  { name: 'Trial of Legends', trait: 'countering', enemy: 'Champion', visual: { biome: 'genesis', landmark: 'decor_scales' } },
  { name: 'Infinite Threshold', trait: 'disruptive', enemy: 'Threshold', visual: { biome: 'genesis', landmark: 'decor_portal', weather: 'decor_sparkle' } },
  { name: 'The Eternal One', trait: 'vampiric', enemy: 'The Eternal One', visual: { biome: 'genesis', landmark: 'decor_ring', weather: 'decor_galaxy' } },
]

/** Twenty worlds of five; the fifth stage of each is its boss. */
export const STAGES_PER_WORLD = 5

export function worldOfOrder(order: number): number {
  return Math.floor((order - 1) / STAGES_PER_WORLD) + 1
}

export function isBossOrder(order: number): boolean {
  return order % STAGES_PER_WORLD === 0
}

/**
 * The curve.
 *
 * Enemy stats grow as a *power* of stage order, not linearly. The handoff's
 * starting formula was linear, and simulating it showed why that cannot work:
 * a player's power compounds — levels, then gear bought with the gold those
 * levels earn, then treats on top — while a linear enemy never catches up. All
 * six kin walked the entire 60-stage campaign in exactly 60 fights, losing
 * nothing, because enemy attack grew slower than player defence.
 *
 * These exponents came out of a parameter search scored against the handoff's
 * own target of two to three replays per world, run for every kin.
 *
 * They were re-fitted when the campaign went from 60 stages to 100. The 60-stage
 * numbers (HP^1.15, ATK^1.1, EXP x5.5) did still *finish* at 100 — every kin
 * completed it — but the worst single stage cost Dwarf 94 replays, because
 * enemy health was compounding faster than reward, and reward is the only thing
 * player power compounds from. Flattening health to ^1.08, holding enemy attack
 * linear and paying EXP x9 brings the worst spike across all six kin down to 11
 * replays, and the average to well under one per world.
 */
const HP_BASE = 26
const HP_SCALE = 10
const HP_EXP = 1.08
const ATK_BASE = 5
const ATK_SCALE = 0.8
const ATK_EXP = 1
const DEF_BASE = 1
const DEF_SCALE = 0.5
const DEF_EXP = 1.05
const EXP_SCALE = 9
const GOLD_SCALE = 4.5

const BOSS_HP = 1.18
const BOSS_ATK = 1.06
const BOSS_REWARD = 1.25

function scaledEnemy(order: number, def: StageDef): EnemyConfig {
  const maxHp = Math.round(HP_BASE + HP_SCALE * order ** HP_EXP)
  const atk = Math.round(ATK_BASE + ATK_SCALE * order ** ATK_EXP)
  const defence = Math.round(DEF_BASE + DEF_SCALE * order ** DEF_EXP)
  const base = { name: def.enemy, sprite: `enemy_${order}`, trait: def.trait }

  if (!isBossOrder(order)) return { ...base, maxHp, atk, def: defence }

  return {
    ...base,
    maxHp: Math.round(maxHp * BOSS_HP),
    atk: Math.round(atk * BOSS_ATK),
    def: defence,
    // Six turns of grace, then +15% of base attack per turn: enough room to
    // win outright with a decent weapon, fatal to a pure-HP build.
    boss: { enrageAfterTurn: 6, enrageAtkPerTurn: 0.15, phases: bossPhases(order) },
  }
}

/**
 * How many faces a boss has, and what each one changes.
 *
 * Deliberately staged by depth rather than given to every boss: an early boss
 * that transformed would be teaching a mechanic before the player has the tools
 * to answer it, and the handoff asks for exactly this ramp. Phases are one-way
 * and keyed off health, so the preview simulates them like anything else.
 */
function bossPhases(order: number): BossPhase[] {
  const world = worldOfOrder(order)
  // Worlds 1-8: enrage alone is the whole mechanic.
  if (world <= 8) return []

  // Worlds 9-12: one turn, halfway down — it hits harder and shrugs off more.
  if (world <= 12) {
    return [{ atHpBelow: 0.5, labelKey: 'boss.phaseHarden', atkScale: 1.15, defScale: 1.2 }]
  }

  // Worlds 13-16: two turns, the first putting a shield in the way so raw
  // damage alone stops being enough.
  if (world <= 16) {
    return [
      { atHpBelow: 0.6, labelKey: 'boss.phaseShield', shield: 0.13, defScale: 1.1 },
      { atHpBelow: 0.3, labelKey: 'boss.phaseFrenzy', atkScale: 1.16, trait: 'unstable' },
    ]
  }

  // Worlds 17-20: three turns, and the last one clears whatever was stuck on
  // it — a build that wins purely by stacking poison has to have another plan.
  return [
    { atHpBelow: 0.7, labelKey: 'boss.phaseShield', shield: 0.14, defScale: 1.08 },
    {
      atHpBelow: 0.45,
      labelKey: 'boss.phaseCurse',
      atkScale: 1.08,
      inflict: { id: 'curse', turns: 6 },
    },
    {
      atHpBelow: 0.2,
      labelKey: 'boss.phaseCleanse',
      cleanse: true,
      atkScale: 1.1,
      trait: 'phasebound',
    },
  ]
}

export const STAGES: StageConfig[] = STAGE_DEFS.map((def, idx) => {
  const order = idx + 1
  const world = worldOfOrder(order)
  const multiplier = isBossOrder(order) ? BOSS_REWARD : 1
  return {
    id: `stage-${order}`,
    name: def.name,
    order,
    enemy: scaledEnemy(order, def),
    rewards: {
      exp: Math.round((12 + order * EXP_SCALE + world * 4) * multiplier),
      gold: Math.round((6 + order * GOLD_SCALE + world * 3) * multiplier),
    },
    bg: backgroundFor(def.visual),
    visual: def.visual,
  }
})

export const STAGE_BY_ID = new Map(STAGES.map((stage) => [stage.id, stage]))

export function isBossStage(stage: StageConfig): boolean {
  return stage.enemy.boss !== undefined
}
