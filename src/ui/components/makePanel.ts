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
  g.fillStyle(COLORS.panel, 1).fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 18)
  g.lineStyle(3, COLORS.panelStroke, 1).strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 18)
  return g
}
