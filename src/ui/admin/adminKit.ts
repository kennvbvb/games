import Phaser from 'phaser'
import { GAME_W } from '../../config/layout'
import { FONT } from '../styles'

/**
 * A denser control set for the Test Lab.
 *
 * The player-facing kit enforces a 56px minimum touch target; these controls
 * are deliberately smaller. That is a considered trade, not an oversight: the
 * lab needs a dozen controls where a game screen needs three, it never ships to
 * a player in a production build, and it is driven with a mouse. Every string
 * here is hard-coded English for the same reason — translating a developer tool
 * would add ~120 keys that no player will ever read.
 */

const CONTROL_H = 30

/** Muted palette so lab chrome never gets mistaken for a game screen. */
export const ADMIN_COLORS = {
  bg: 0x2f2838,
  panel: 0x3c3348,
  panelActive: 0x5b4a70,
  stroke: 0x6b5a80,
  accent: '#ffd166',
  text: '#f2ecf7',
  textDim: '#a99cb8',
  danger: '#ff8080',
  ok: '#8fe3a8',
} as const

export function adminBackdrop(scene: Phaser.Scene, height: number): void {
  scene.add.rectangle(GAME_W / 2, height / 2, GAME_W, height, ADMIN_COLORS.bg).setDepth(-10)
}

export function adminText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  options: { size?: number; color?: string; bold?: boolean; origin?: number; wrap?: number } = {},
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, label, {
      fontSize: `${options.size ?? 12}px`,
      fontFamily: FONT.family,
      fontStyle: options.bold ? 'bold' : 'normal',
      color: options.color ?? ADMIN_COLORS.text,
      ...(options.wrap ? { wordWrap: { width: options.wrap } } : {}),
    })
    .setOrigin(options.origin ?? 0, 0.5)
}

export interface AdminButtonOptions {
  width?: number
  height?: number
  size?: number
  active?: boolean
  disabled?: boolean
  tone?: 'default' | 'danger' | 'ok'
}

export function adminButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  options: AdminButtonOptions = {},
): Phaser.GameObjects.Container {
  const w = options.width ?? 68
  const h = options.height ?? CONTROL_H
  const disabled = options.disabled ?? false
  const fill = options.active ? ADMIN_COLORS.panelActive : ADMIN_COLORS.panel
  const color = disabled
    ? ADMIN_COLORS.textDim
    : options.tone === 'danger'
      ? ADMIN_COLORS.danger
      : options.tone === 'ok'
        ? ADMIN_COLORS.ok
        : options.active
          ? ADMIN_COLORS.accent
          : ADMIN_COLORS.text

  const bg = scene.add.graphics()
  bg.fillStyle(fill, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 7)
  bg.lineStyle(1, options.active ? 0xffd166 : ADMIN_COLORS.stroke, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 7)

  const text = scene.add
    .text(0, 0, label, {
      fontSize: `${options.size ?? 12}px`,
      fontFamily: FONT.family,
      fontStyle: 'bold',
      color,
    })
    .setOrigin(0.5)

  const container = scene.add.container(x, y, [bg, text]).setSize(w, h)
  if (!disabled) {
    container.setInteractive({ useHandCursor: true })
    container.on('pointerdown', onClick)
  }
  return container
}

/**
 * `label  [−] value [+]`, with a second pair of larger steps when one is given.
 * Values that span four orders of magnitude (gold, EXP) are unusable with a
 * single step size, and a text field would need validation the lab does not
 * need to own.
 */
export function adminStepper(
  scene: Phaser.Scene,
  y: number,
  label: string,
  value: () => number,
  onChange: (next: number) => void,
  options: { step?: number; bigStep?: number; min?: number; max?: number; format?: (n: number) => string } = {},
): void {
  const step = options.step ?? 1
  const big = options.bigStep
  const min = options.min ?? 0
  const max = options.max ?? Number.MAX_SAFE_INTEGER
  const clamp = (n: number) => Math.min(max, Math.max(min, n))

  adminText(scene, 22, y, label, { color: ADMIN_COLORS.textDim })
  const readout = adminText(scene, 196, y, (options.format ?? String)(value()), {
    bold: true,
    origin: 0.5,
    size: 13,
  })
  const refresh = () => readout.setText((options.format ?? String)(value()))
  const bump = (delta: number) => () => {
    onChange(clamp(value() + delta))
    refresh()
  }

  const xs = big ? [246, 300, 366, 420] : [270, 360]
  const deltas = big ? [-big, -step, step, big] : [-step, step]
  const labels = big ? [`−${big}`, `−${step}`, `+${step}`, `+${big}`] : [`−${step}`, `+${step}`]
  xs.forEach((x, i) => adminButton(scene, x, y, labels[i], bump(deltas[i]), { width: 48, height: 26, size: 11 }))
}

export function adminToggle(
  scene: Phaser.Scene,
  y: number,
  label: string,
  value: () => boolean,
  onChange: (next: boolean) => void,
): void {
  adminText(scene, 22, y, label, { color: ADMIN_COLORS.textDim })
  let button: Phaser.GameObjects.Container
  const render = () => {
    button?.destroy()
    button = adminButton(
      scene,
      400,
      y,
      value() ? 'ON' : 'OFF',
      () => {
        onChange(!value())
        render()
      },
      { width: 64, height: 26, size: 11, active: value() },
    )
  }
  render()
}

/** One row of mutually exclusive choices. Returns nothing; re-render to update. */
export function adminChoices<T extends string>(
  scene: Phaser.Scene,
  y: number,
  label: string,
  options: readonly T[],
  active: T,
  onSelect: (value: T) => void,
  labelOf: (value: T) => string = String,
): void {
  if (label) adminText(scene, 22, y, label, { color: ADMIN_COLORS.textDim })
  const left = label ? 108 : 22
  const available = GAME_W - left - 22
  const width = Math.min(84, Math.floor(available / options.length) - 4)
  options.forEach((option, i) => {
    adminButton(
      scene,
      left + width / 2 + i * (width + 4),
      y,
      labelOf(option),
      () => onSelect(option),
      { width, height: 26, size: 11, active: option === active },
    )
  })
}

/** The badge that has to be impossible to miss: nothing here touches the save. */
export function adminBadge(scene: Phaser.Scene, y: number, note: string): void {
  const g = scene.add.graphics()
  g.fillStyle(0x7a3b52, 1).fillRoundedRect(16, y - 13, GAME_W - 32, 26, 6)
  g.lineStyle(1, 0xff8fab, 1).strokeRoundedRect(16, y - 13, GAME_W - 32, 26, 6)
  adminText(scene, GAME_W / 2, y, `TEST SESSION · ${note}`, {
    size: 11,
    bold: true,
    color: '#ffd6e0',
    origin: 0.5,
  })
}
