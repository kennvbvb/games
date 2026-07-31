import Phaser from 'phaser'
import { COLORS, FONT } from '../styles'

interface ButtonOptions {
  disabled?: boolean
  variant?: 'primary' | 'secondary'
  minWidth?: number
  fontSize?: string
  /** Preloaded emoji texture key drawn to the left of the label. */
  icon?: string
}

export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  options: ButtonOptions = {},
): Phaser.GameObjects.Container {
  const disabled = options.disabled ?? false
  const secondary = options.variant === 'secondary'
  const fill = disabled ? COLORS.disabledBg : secondary ? COLORS.secondary : COLORS.primary
  const shadow = disabled ? COLORS.disabledShadow : secondary ? COLORS.secondaryShadow : COLORS.primaryShadow

  const text = scene.add
    .text(0, 0, label, {
      fontSize: options.fontSize ?? '17px',
      fontFamily: FONT.family,
      fontStyle: 'bold',
      color: disabled ? COLORS.textDisabled : COLORS.textOnPrimary,
    })
    .setOrigin(0.5)

  const iconSize = 20
  const iconGap = 8
  const contentW = text.width + (options.icon ? iconSize + iconGap : 0)
  const w = Math.max(contentW + 40, options.minWidth ?? 0)
  const h = text.height + 20

  const bg = scene.add.graphics()
  // Chunky bottom edge reads as a soft 3D key, matching the rounded font.
  bg.fillStyle(shadow, 1).fillRoundedRect(-w / 2, -h / 2 + 4, w, h, h / 2)
  bg.fillStyle(fill, 1).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2)

  const children: Phaser.GameObjects.GameObject[] = [bg]
  if (options.icon) {
    const icon = scene.add
      .image(-contentW / 2 + iconSize / 2, 0, options.icon)
      .setDisplaySize(iconSize, iconSize)
    if (disabled) icon.setAlpha(0.45)
    text.setX(-contentW / 2 + iconSize + iconGap + text.width / 2)
    children.push(icon)
  }
  children.push(text)

  const container = scene.add.container(x, y, children)
  container.setSize(w, h + 4)

  if (!disabled) {
    container.setInteractive({ useHandCursor: true })
    container.on('pointerover', () => {
      scene.tweens.add({ targets: container, scale: 1.06, duration: 100, ease: 'Back.Out' })
    })
    container.on('pointerout', () => {
      scene.tweens.add({ targets: container, scale: 1, duration: 100 })
    })
    container.on('pointerdown', () => {
      scene.tweens.add({ targets: container, scale: 0.94, duration: 60, yoyo: true })
      onClick()
    })
  }

  return container
}
