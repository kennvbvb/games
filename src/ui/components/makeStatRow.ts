import Phaser from 'phaser'
import { COLORS, FONT } from '../styles'

export interface StatEntry {
  icon: string
  value: number | string
}

/**
 * Draws `icon value` pairs left-to-right from `x`, spacing each pair by its own
 * text width so mixed-width numbers stay evenly gapped.
 * Returns the x just past the last entry.
 */
export function makeStatRow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  entries: StatEntry[],
  options: { fontSize?: string; iconSize?: number; gap?: number; color?: string } = {},
): number {
  const fontSize = options.fontSize ?? '16px'
  const iconSize = options.iconSize ?? 18
  const gap = options.gap ?? 16
  let cursor = x

  for (const entry of entries) {
    scene.add.image(cursor + iconSize / 2, y, entry.icon).setDisplaySize(iconSize, iconSize)
    const label = scene.add
      .text(cursor + iconSize + 5, y, String(entry.value), {
        fontSize,
        fontFamily: FONT.family,
        color: options.color ?? COLORS.text,
      })
      .setOrigin(0, 0.5)
    cursor += iconSize + 5 + label.width + gap
  }

  return cursor
}
