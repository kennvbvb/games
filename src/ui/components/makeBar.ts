import Phaser from 'phaser'
import { COLORS } from '../styles'

export interface Bar {
  set(pct: number): void
}

export function makeBar(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  w: number,
  h: number,
  color: number,
): Bar {
  const g = scene.add.graphics()
  const draw = (pct: number) => {
    const clamped = Math.max(0, Math.min(1, pct))
    g.clear()
    g.fillStyle(COLORS.barBg, 1).fillRoundedRect(cx - w / 2, cy - h / 2, w, h, h / 2)
    if (clamped > 0) {
      g.fillStyle(color, 1).fillRoundedRect(cx - w / 2, cy - h / 2, Math.max(h, w * clamped), h, h / 2)
    }
  }
  draw(1)
  return { set: draw }
}
