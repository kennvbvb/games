import Phaser from 'phaser'
import { COLORS } from '../styles'

export function makePanel(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  w: number,
  h: number,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics()
  const x = cx - w / 2
  const y = cy - h / 2
  // Offset drop shadow gives the flat card a little lift off the background.
  g.fillStyle(COLORS.panelShadow, 0.55).fillRoundedRect(x, y + 4, w, h, 18)
  g.fillStyle(COLORS.panel, 1).fillRoundedRect(x, y, w, h, 18)
  g.lineStyle(3, COLORS.panelStroke, 1).strokeRoundedRect(x, y, w, h, 18)
  return g
}
