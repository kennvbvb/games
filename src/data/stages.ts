import type { EnemyConfig, StageConfig } from '../types'

const STAGE_DEFS = [
  { name: 'Whispering Woods', emoji: '🐛' },
  { name: 'Bramble Hollow', emoji: '🦔' },
  { name: 'Stonefang Ridge', emoji: '🐗' },
  { name: 'Sunken Marsh', emoji: '🐸' },
  { name: 'Ashen Crypt', emoji: '👻' },
  { name: 'Frostpeak Pass', emoji: '🐺' },
  { name: 'Ember Caverns', emoji: '🦎' },
  { name: 'Shattered Coast', emoji: '🦀' },
  { name: 'Wraith Hollow', emoji: '🦇' },
  { name: 'Obsidian Spire', emoji: '🕷️' },
  { name: 'Storm Bastion', emoji: '🦅' },
  { name: "Dragon's Maw", emoji: '🐉' },
]

function scaledEnemy(order: number): EnemyConfig {
  const def = STAGE_DEFS[order - 1]
  return {
    name: `${def?.name ?? `Stage ${order}`} Guardian`,
    emoji: def?.emoji ?? '👾',
    maxHp: Math.round(30 + order * 18),
    atk: Math.round(6 + order * 2.4),
    def: Math.round(1 + order * 1.1),
  }
}

export const STAGES: StageConfig[] = STAGE_DEFS.map((def, idx) => {
  const order = idx + 1
  return {
    id: `stage-${order}`,
    name: def.name,
    order,
    enemy: scaledEnemy(order),
    rewards: {
      exp: Math.round(10 + order * 6),
      gold: Math.round(5 + order * 4),
    },
  }
})
