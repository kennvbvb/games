import Phaser from 'phaser'
import { COLORS } from '../styles'

interface ButtonOptions {
  disabled?: boolean
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

  const text = scene.add
    .text(0, 0, label, {
      fontSize: '16px',
      color: disabled ? COLORS.textDisabled : COLORS.text,
    })
    .setOrigin(0.5)

  const paddingX = 16
  const paddingY = 10
  const bg = scene.add
    .rectangle(0, 0, text.width + paddingX * 2, text.height + paddingY * 2, disabled ? COLORS.bgDisabled : COLORS.bgButton)
    .setStrokeStyle(1, COLORS.border)

  const container = scene.add.container(x, y, [bg, text])
  container.setSize(bg.width, bg.height)

  if (!disabled) {
    container.setInteractive({ useHandCursor: true })
    container.on('pointerover', () => bg.setFillStyle(COLORS.bgButtonHover))
    container.on('pointerout', () => bg.setFillStyle(COLORS.bgButton))
    container.on('pointerdown', () => onClick())
  }

  return container
}
