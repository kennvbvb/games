import type { StageBackground } from '../types'

/**
 * A biome is a palette plus the props that belong in it. Stages compose from
 * these rather than each carrying a hand-written background: 60 hand-authored
 * palettes would be 60 places for a stage to end up looking like nothing in
 * particular, and a 60-case switch is exactly what the handoff rules out.
 */
export type BiomeId =
  | 'forest'
  | 'ridge'
  | 'marsh'
  | 'crypt'
  | 'frost'
  | 'ember'
  | 'coast'
  | 'spire'
  | 'arcane'
  | 'iron'
  | 'desert'
  | 'underrealm'
  | 'spirit'
  | 'rift'
  | 'divine'

export interface Biome {
  skyTop: number
  skyBottom: number
  hillFar: number
  hillNear: number
  ground: number
  /** Props scattered along the ground band. */
  decor: string[]
  /** Props floating in the sky band. */
  sky: string[]
}

export const BIOMES: Record<BiomeId, Biome> = {
  forest: {
    skyTop: 0xd8f3dc, skyBottom: 0xb7e4c7, hillFar: 0x95d5b2, hillNear: 0x74c69d, ground: 0x8fd3a8,
    decor: ['decor_tree', 'decor_flower', 'decor_mushroom', 'decor_leaf', 'decor_herb'],
    sky: ['icon_cloud', 'decor_leaf', 'decor_sparkle'],
  },
  ridge: {
    skyTop: 0xece7e2, skyBottom: 0xd6cec6, hillFar: 0xbdb2a7, hillNear: 0xa39588, ground: 0xb0a396,
    decor: ['decor_rock', 'decor_mountain', 'decor_wheat', 'decor_chestnut'],
    sky: ['icon_cloud'],
  },
  marsh: {
    skyTop: 0xd0f4de, skyBottom: 0xa8e6cf, hillFar: 0x8fd6bd, hillNear: 0x6fc2a0, ground: 0x84cfae,
    decor: ['decor_lotus', 'decor_wheat', 'decor_droplet', 'decor_mushroom'],
    sky: ['icon_cloud', 'decor_droplet'],
  },
  crypt: {
    skyTop: 0xe2d9f3, skyBottom: 0xcbbde3, hillFar: 0xb9a6d9, hillNear: 0x9e8bc4, ground: 0xa895cc,
    decor: ['decor_headstone', 'decor_candle', 'decor_web', 'decor_bone'],
    sky: ['decor_moon', 'decor_fog'],
  },
  frost: {
    skyTop: 0xe0fbfc, skyBottom: 0xc2eaf2, hillFar: 0xa8d8ea, hillNear: 0x8ec5dd, ground: 0xeaf7fb,
    decor: ['decor_snowman', 'decor_tree', 'decor_snowflake', 'decor_crystal'],
    sky: ['decor_snowcloud', 'decor_snowflake'],
  },
  ember: {
    skyTop: 0xffe5d9, skyBottom: 0xffc9b5, hillFar: 0xffb5a7, hillNear: 0xf59a85, ground: 0xf0a58f,
    decor: ['decor_fire', 'decor_volcano', 'decor_gem', 'decor_rock'],
    sky: ['decor_fire', 'decor_comet'],
  },
  coast: {
    skyTop: 0xdff6ff, skyBottom: 0xb8e2f5, hillFar: 0x94c9f0, hillNear: 0x7ab4e0, ground: 0xf5e6c8,
    decor: ['decor_shell', 'decor_anchor', 'decor_wave', 'decor_coral'],
    sky: ['icon_cloud', 'decor_bubble'],
  },
  spire: {
    skyTop: 0xd3d3e7, skyBottom: 0xbcbcd6, hillFar: 0x9d9dc0, hillNear: 0x8585ab, ground: 0x9292b5,
    decor: ['decor_tower', 'decor_web', 'decor_orb', 'decor_crystal'],
    sky: ['decor_fog', 'decor_moon'],
  },
  arcane: {
    skyTop: 0xe6dcff, skyBottom: 0xcfc0f5, hillFar: 0xb5a1ea, hillNear: 0x9b84dd, ground: 0xa892e4,
    decor: ['decor_orb', 'decor_lantern', 'decor_ring', 'decor_crystal'],
    sky: ['decor_sparkle', 'decor_portal'],
  },
  iron: {
    skyTop: 0xe4e2dd, skyBottom: 0xc9c5be, hillFar: 0xa9a49b, hillNear: 0x8d887f, ground: 0x9c968c,
    decor: ['decor_gear', 'decor_tower', 'decor_rock', 'decor_bolt'],
    sky: ['decor_fog', 'decor_gear'],
  },
  desert: {
    skyTop: 0xfff2d0, skyBottom: 0xffe0a3, hillFar: 0xefc887, hillNear: 0xd9ab68, ground: 0xf0d59a,
    decor: ['decor_sand', 'decor_cactus', 'decor_rock', 'decor_bone'],
    sky: ['decor_sun', 'icon_cloud'],
  },
  underrealm: {
    skyTop: 0x3f2f4a, skyBottom: 0x584066, hillFar: 0x6d4f7d, hillNear: 0x835f94, ground: 0x74537f,
    decor: ['decor_mushroom', 'decor_skull', 'decor_bone', 'decor_gem'],
    sky: ['decor_fog', 'decor_fire'],
  },
  spirit: {
    skyTop: 0xdff2e4, skyBottom: 0xbfe3cd, hillFar: 0x9ed3b6, hillNear: 0x7dc19e, ground: 0x8fcfab,
    decor: ['decor_bamboo', 'decor_sakura', 'decor_lantern', 'decor_lotus'],
    sky: ['decor_sakura', 'decor_moon'],
  },
  rift: {
    skyTop: 0xd9d0ff, skyBottom: 0xb9a8f5, hillFar: 0x9880e6, hillNear: 0x7c62d4, ground: 0x8a70dd,
    decor: ['decor_portal', 'decor_clock', 'decor_crystal', 'decor_rock'],
    sky: ['decor_galaxy', 'decor_comet'],
  },
  divine: {
    skyTop: 0xfff5dd, skyBottom: 0xffe9bb, hillFar: 0xf7dba5, hillNear: 0xecc98a, ground: 0xf5e2ae,
    decor: ['decor_feather', 'decor_scales', 'decor_ring', 'decor_lantern'],
    sky: ['decor_sparkle', 'decor_sun'],
  },
}

/** A stage's own flourish, layered on top of its biome. */
export interface StageVisual {
  biome: BiomeId
  /** The one prop that makes this stage recognisable at a glance. */
  landmark: string
  /** Extra sky element, e.g. weather. */
  weather?: string
}

/**
 * Builds the background a stage renders from. The landmark leads the decor list
 * so the scenery painter places it first, and duplicates are dropped so a
 * landmark that already belongs to the biome does not appear twice as often.
 */
export function backgroundFor(visual: StageVisual): StageBackground {
  const biome = BIOMES[visual.biome]
  return {
    skyTop: biome.skyTop,
    skyBottom: biome.skyBottom,
    hillFar: biome.hillFar,
    hillNear: biome.hillNear,
    ground: biome.ground,
    decor: [...new Set([visual.landmark, ...biome.decor])],
    sky: [...new Set(visual.weather ? [visual.weather, ...biome.sky] : biome.sky)],
  }
}

/** Identity of a stage's look, for asserting all 60 differ. */
export function visualSignature(visual: StageVisual): string {
  return `${visual.biome}|${visual.landmark}|${visual.weather ?? '-'}`
}
