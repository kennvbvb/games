import type { EnemyConfig, StageBackground, StageConfig } from '../types'
import type { TraitId } from './enemyTraits'

interface StageDef {
  name: string
  bg: StageBackground
}

const STAGE_DEFS: StageDef[] = [
  {
    name: 'Whispering Woods',
    bg: {
      skyTop: 0xd8f3dc, skyBottom: 0xb7e4c7, hillFar: 0x95d5b2, hillNear: 0x74c69d, ground: 0x8fd3a8,
      decor: ['decor_tree', 'decor_flower', 'decor_mushroom', 'decor_leaf'],
      sky: ['icon_cloud', 'decor_leaf'],
    },
  },
  {
    name: 'Bramble Hollow',
    bg: {
      skyTop: 0xe9edc9, skyBottom: 0xd7dfb0, hillFar: 0xb5c99a, hillNear: 0x97a97c, ground: 0xa7b98a,
      decor: ['decor_herb', 'decor_mushroom', 'decor_chestnut', 'decor_tree'],
      sky: ['icon_cloud'],
    },
  },
  {
    name: 'Stonefang Ridge',
    bg: {
      skyTop: 0xece7e2, skyBottom: 0xd6cec6, hillFar: 0xbdb2a7, hillNear: 0xa39588, ground: 0xb0a396,
      decor: ['decor_rock', 'decor_mountain', 'decor_wheat'],
      sky: ['icon_cloud'],
    },
  },
  {
    name: 'Sunken Marsh',
    bg: {
      skyTop: 0xd0f4de, skyBottom: 0xa8e6cf, hillFar: 0x8fd6bd, hillNear: 0x6fc2a0, ground: 0x84cfae,
      decor: ['decor_lotus', 'decor_wheat', 'decor_droplet'],
      sky: ['icon_cloud', 'decor_droplet'],
    },
  },
  {
    name: 'Ashen Crypt',
    bg: {
      skyTop: 0xe2d9f3, skyBottom: 0xcbbde3, hillFar: 0xb9a6d9, hillNear: 0x9e8bc4, ground: 0xa895cc,
      decor: ['decor_headstone', 'decor_candle', 'decor_web'],
      sky: ['decor_moon', 'decor_fog'],
    },
  },
  {
    name: 'Frostpeak Pass',
    bg: {
      skyTop: 0xe0fbfc, skyBottom: 0xc2eaf2, hillFar: 0xa8d8ea, hillNear: 0x8ec5dd, ground: 0xeaf7fb,
      decor: ['decor_snowman', 'decor_tree', 'decor_snowflake'],
      sky: ['decor_snowcloud', 'decor_snowflake'],
    },
  },
  {
    name: 'Ember Caverns',
    bg: {
      skyTop: 0xffe5d9, skyBottom: 0xffc9b5, hillFar: 0xffb5a7, hillNear: 0xf59a85, ground: 0xf0a58f,
      decor: ['decor_fire', 'decor_volcano', 'decor_gem'],
      sky: ['decor_fire'],
    },
  },
  {
    name: 'Shattered Coast',
    bg: {
      skyTop: 0xdff6ff, skyBottom: 0xb8e2f5, hillFar: 0x94c9f0, hillNear: 0x7ab4e0, ground: 0xf5e6c8,
      decor: ['decor_shell', 'decor_anchor', 'decor_wave'],
      sky: ['icon_cloud'],
    },
  },
  {
    name: 'Wraith Hollow',
    bg: {
      skyTop: 0xd8d0f0, skyBottom: 0xc0b4e2, hillFar: 0xa393c9, hillNear: 0x8a79b3, ground: 0x9887bd,
      decor: ['decor_tree', 'decor_fog', 'decor_owl'],
      sky: ['decor_moon', 'decor_fog'],
    },
  },
  {
    name: 'Obsidian Spire',
    bg: {
      skyTop: 0xd3d3e7, skyBottom: 0xbcbcd6, hillFar: 0x9d9dc0, hillNear: 0x8585ab, ground: 0x9292b5,
      decor: ['decor_tower', 'decor_web', 'decor_orb'],
      sky: ['decor_fog'],
    },
  },
  {
    name: 'Storm Bastion',
    bg: {
      skyTop: 0xd7e3fc, skyBottom: 0xb3c8f0, hillFar: 0x91aede, hillNear: 0x7a99cf, ground: 0x86a3d6,
      decor: ['decor_castle', 'decor_rock', 'decor_storm'],
      sky: ['decor_storm', 'icon_bolt'],
    },
  },
  {
    name: "Dragon's Maw",
    bg: {
      skyTop: 0xffd6d6, skyBottom: 0xf8b3b3, hillFar: 0xf59a9a, hillNear: 0xe07d7d, ground: 0xea8c8c,
      decor: ['decor_castle', 'decor_fire', 'decor_skull'],
      sky: ['decor_storm', 'decor_fire'],
    },
  },
]

const ENEMY_NAMES = [
  'Grub', 'Prickle', 'Tusker', 'Bog Warden', 'Wisp', 'Howler',
  'Emberling', 'Tidecaller', 'Flitter', 'Weaver', 'Screecher', 'Elder Wyrm',
]

/** Every fourth stage closes a chapter and is fought as a boss. */
export const STAGES_PER_CHAPTER = 4

export function isBossOrder(order: number): boolean {
  return order % STAGES_PER_CHAPTER === 0
}

/**
 * Bosses are tuned as a wall rather than one more step on the curve: a big
 * health pool, harder hits, and an enrage that turns the fight into a damage
 * check. The reward multiplier is what makes clearing one worth the grind, and
 * makes a beaten boss the best stage to farm.
 */
const BOSS_HP = 1.45
const BOSS_ATK = 1.25
const BOSS_DEF = 1.2
const BOSS_REWARD = 2.5

/**
 * Which stage teaches which trait, in order. Hand-authored rather than derived:
 * this sequence *is* the difficulty curve, so a formula would make it
 * accidental. Stage 1 stays plain so the tutorial fight has nothing to explain.
 */
const STAGE_TRAITS: TraitId[] = [
  'straightforward',
  'slippery',
  'fierce',
  'mending',
  'slippery',
  'fierce',
  'mending',
  'slippery',
  'mending',
  'fierce',
  'slippery',
  'fierce',
]

function scaledEnemy(order: number): EnemyConfig {
  const maxHp = Math.round(30 + order * 18)
  const atk = Math.round(6 + order * 2.4)
  const def = Math.round(1 + order * 1.1)
  const base = {
    name: ENEMY_NAMES[order - 1] ?? `Foe ${order}`,
    sprite: `enemy_${order}`,
    trait: STAGE_TRAITS[order - 1] ?? 'straightforward',
  }

  if (!isBossOrder(order)) return { ...base, maxHp, atk, def }

  return {
    ...base,
    maxHp: Math.round(maxHp * BOSS_HP),
    atk: Math.round(atk * BOSS_ATK),
    def: Math.round(def * BOSS_DEF),
    // Six turns of grace, then +15% of base attack per turn: enough room to
    // win outright with a decent weapon, fatal to a pure-HP build.
    boss: { enrageAfterTurn: 6, enrageAtkPerTurn: 0.15 },
  }
}

export const STAGES: StageConfig[] = STAGE_DEFS.map((def, idx) => {
  const order = idx + 1
  const multiplier = isBossOrder(order) ? BOSS_REWARD : 1
  return {
    id: `stage-${order}`,
    name: def.name,
    order,
    enemy: scaledEnemy(order),
    rewards: {
      exp: Math.round((10 + order * 6) * multiplier),
      gold: Math.round((5 + order * 4) * multiplier),
    },
    bg: def.bg,
  }
})

export const STAGE_BY_ID = new Map(STAGES.map((stage) => [stage.id, stage]))

export function isBossStage(stage: StageConfig): boolean {
  return stage.enemy.boss !== undefined
}
