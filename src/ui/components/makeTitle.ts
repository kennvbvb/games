import Phaser from 'phaser'
import { GAME_W } from '../../config/layout'
import { COLORS, FONT } from '../styles'

export interface TitleOptions {
  fontSize?: string
  iconSize?: number
  gap?: number
  /** Draw the icon on both sides of the label instead of just the left. */
  flank?: boolean
}

/**
 * Centres `icon + label` (optionally icon on both sides) as a single unit.
 * Measuring the label first keeps icons clear of the text at any font size.
 */
export function makeTitle(
  scene: Phaser.Scene,
  y: number,
  label: string,
  icon: string,
  options: TitleOptions = {},
): Phaser.GameObjects.Text {
  const fontSize = options.fontSize ?? '26px'
  const iconSize = options.iconSize ?? 24
  const gap = options.gap ?? 10
  const flank = options.flank ?? false

  const text = scene.add
    .text(0, y, label, {
      fontSize,
      fontFamily: FONT.family,
      fontStyle: 'bold',
      color: COLORS.text,
    })
    .setOrigin(0.5)

  const sides = flank ? 2 : 1
  const total = text.width + sides * (iconSize + gap)
  const left = GAME_W / 2 - total / 2

  text.setX(left + iconSize + gap + text.width / 2)
  scene.add.image(left + iconSize / 2, y, icon).setDisplaySize(iconSize, iconSize)
  if (flank) {
    scene.add.image(left + total - iconSize / 2, y, icon).setDisplaySize(iconSize, iconSize)
  }

  return text
}
