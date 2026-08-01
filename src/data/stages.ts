import { backgroundFor } from './biomes'
import type { StageVisual } from './biomes'
import type { EnemyConfig, StageConfig } from '../types'
import type { TraitId } from './enemyTraits'

interface StageDef {
  name: string
  trait: TraitId
  visual: StageVisual
  enemy: string
}

/**
 * Sixty stages in twelve worlds of five.
 *
 * Ids are positional (`stage-<order>`) and the first twelve keep both their id
 * and their name from before the campaign was extended, so an existing save's
 * cleared list still points at the same places.
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
]

/** Twelve worlds of five; the fifth stage of each is its boss. */
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
 * own target of two to three replays per world, run for every kin. See the PR
 * for the resulting per-kin figures, including where it still falls short.
 */
const HP_BASE = 26
const HP_SCALE = 10
const HP_EXP = 1.15
const ATK_BASE = 5
const ATK_SCALE = 0.8
const ATK_EXP = 1.1
const DEF_BASE = 1
const DEF_SCALE = 0.5
const DEF_EXP = 1.05
const EXP_SCALE = 5.5
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
    boss: { enrageAfterTurn: 6, enrageAtkPerTurn: 0.15 },
  }
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
