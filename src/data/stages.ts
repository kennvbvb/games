import type { EnemyConfig, StageBackground, StageConfig } from '../types'

interface StageDef {
  name: string
  emoji: string
  bg: StageBackground
}

const STAGE_DEFS: StageDef[] = [
  { name: 'Whispering Woods', emoji: '🐛', bg: { top: 0xd8f3dc, bottom: 0x95d5b2, decor: ['🌲', '🍃', '🌼'] } },
  { name: 'Bramble Hollow', emoji: '🦔', bg: { top: 0xe9edc9, bottom: 0xccd5ae, decor: ['🌿', '🍄', '🌰'] } },
  { name: 'Stonefang Ridge', emoji: '🐗', bg: { top: 0xece7e2, bottom: 0xc9beb4, decor: ['⛰️', '🪨', '🌾'] } },
  { name: 'Sunken Marsh', emoji: '🐸', bg: { top: 0xd0f4de, bottom: 0x8fd6bd, decor: ['🪷', '🌾', '💧'] } },
  { name: 'Ashen Crypt', emoji: '👻', bg: { top: 0xe2d9f3, bottom: 0xb9a6d9, decor: ['🕯️', '🪦', '🕸️'] } },
  { name: 'Frostpeak Pass', emoji: '🐺', bg: { top: 0xe0fbfc, bottom: 0xa8d8ea, decor: ['❄️', '⛄', '🌨️'] } },
  { name: 'Ember Caverns', emoji: '🦎', bg: { top: 0xffe5d9, bottom: 0xffb5a7, decor: ['🔥', '🌋', '💎'] } },
  { name: 'Shattered Coast', emoji: '🦀', bg: { top: 0xdff6ff, bottom: 0x94c9f0, decor: ['🌊', '🐚', '⚓'] } },
  { name: 'Wraith Hollow', emoji: '🦇', bg: { top: 0xd8d0f0, bottom: 0xa393c9, decor: ['🌙', '🦉', '🌫️'] } },
  { name: 'Obsidian Spire', emoji: '🕷️', bg: { top: 0xd3d3e7, bottom: 0x9d9dc0, decor: ['🗼', '🕸️', '🔮'] } },
  { name: 'Storm Bastion', emoji: '🦅', bg: { top: 0xd7e3fc, bottom: 0x91aede, decor: ['⛈️', '⚡', '☁️'] } },
  { name: "Dragon's Maw", emoji: '🐉', bg: { top: 0xffd6d6, bottom: 0xf59a9a, decor: ['🔥', '🏰', '💀'] } },
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
    bg: def.bg,
  }
})
