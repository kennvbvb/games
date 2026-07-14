import Phaser from 'phaser'
import { COLORS, FONT } from '../styles'

interface ButtonOptions {
  disabled?: boolean
  variant?: 'primary' | 'secondary'
  minWidth?: number
  fontSize?: string
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
  const fill = disabled ? COLORS.disabledBg : options.variant === 'secondary' ? COLORS.secondary : COLORS.primary

  const text = scene.add
    .text(0, 0, label, {
      fontSize: options.fontSize ?? '17px',
      fontFamily: FONT.family,
      fontStyle: 'bold',
      color: disabled ? COLORS.textDisabled : COLORS.textOnPrimary,
    })
    .setOrigin(0.5)

  const w = Math.max(text.width + 40, options.minWidth ?? 0)
  const h = text.height + 20
  const bg = scene.add.graphics()
  bg.fillStyle(fill, 1).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2)

  const container = scene.add.container(x, y, [bg, text])
  container.setSize(w, h)

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
