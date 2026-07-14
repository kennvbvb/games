import type { EnemyConfig, StageConfig } from '../types'

const STAGE_NAMES = [
  'Whispering Woods',
  'Bramble Hollow',
  'Stonefang Ridge',
  'Sunken Marsh',
  'Ashen Crypt',
  'Frostpeak Pass',
  'Ember Caverns',
  'Shattered Coast',
  'Wraith Hollow',
  'Obsidian Spire',
  'Storm Bastion',
  "Dragon's Maw",
]

function scaledEnemy(order: number): EnemyConfig {
  return {
    name: `${STAGE_NAMES[order - 1] ?? `Stage ${order}`} Guardian`,
    maxHp: Math.round(30 + order * 18),
    atk: Math.round(6 + order * 2.4),
    def: Math.round(1 + order * 1.1),
  }
}

export const STAGES: StageConfig[] = STAGE_NAMES.map((name, idx) => {
  const order = idx + 1
  return {
    id: `stage-${order}`,
    name,
    order,
    enemy: scaledEnemy(order),
    rewards: {
      exp: Math.round(10 + order * 6),
      gold: Math.round(5 + order * 4),
    },
  }
})
