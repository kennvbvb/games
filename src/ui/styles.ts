// Soft pastel "cozy sweets" theme. String colors are for Phaser text,
// numeric colors are for Graphics/Rectangle fills.
export const COLORS = {
  text: '#5d4a66',
  textDim: '#9b8aa6',
  textDisabled: '#c4b8cc',
  textOnPrimary: '#ffffff',
  success: '#3faf6e',
  danger: '#e15b64',
  gold: '#d98e04',

  pageBg: '#fff6ef',
  panel: 0xffffff,
  panelShadow: 0xe8d5e0,
  panelStroke: 0xf3d9e5,
  primary: 0xff8fab,
  primaryShadow: 0xe06d8a,
  secondary: 0xa78bfa,
  secondaryShadow: 0x8b6de0,
  disabledBg: 0xece5f0,
  disabledShadow: 0xd8cfe0,
  barBg: 0xf0e6ee,
  hpBar: 0x6bcb77,
  enemyHpBar: 0xff8fab,
  expBar: 0xa78bfa,
} as const

// Fredoka is loaded from public/assets/fonts in index.html.
export const FONT = {
  family: 'Fredoka, "Trebuchet MS", sans-serif',
} as const
