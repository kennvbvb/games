import Phaser from 'phaser'
import { GAME_W, GAME_H } from '../config/layout'
import { ambientTween } from './motion'
import type { StageBackground } from '../types'

/** Small deterministic PRNG so each stage's scenery layout is stable between visits. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Row of overlapping domes that reads as a soft hill ridge. */
function drawHills(
  g: Phaser.GameObjects.Graphics,
  color: number,
  baseY: number,
  minR: number,
  maxR: number,
  rand: () => number,
): void {
  g.fillStyle(color, 1)
  let x = -20
  while (x < GAME_W + 40) {
    const r = minR + rand() * (maxR - minR)
    g.fillCircle(x, baseY, r)
    x += r * 1.15
  }
  g.fillRect(0, baseY, GAME_W, GAME_H - baseY)
}

export interface SceneryOptions {
  /** Y of the ground line. Content below this sits on the ground band. */
  horizon?: number
}

/**
 * Paints a full stage backdrop: gradient sky, two hill ridges, ground band,
 * plus floating sky decor and scattered ground decor from the stage's palette.
 */
export function drawStageScenery(
  scene: Phaser.Scene,
  bg: StageBackground,
  seed: number,
  options: SceneryOptions = {},
): void {
  const horizon = options.horizon ?? 440
  const rand = mulberry32(seed * 9176 + 13)

  const sky = scene.add.graphics()
  sky.fillGradientStyle(bg.skyTop, bg.skyTop, bg.skyBottom, bg.skyBottom, 1)
  sky.fillRect(0, 0, GAME_W, horizon + 4)

  const hills = scene.add.graphics()
  drawHills(hills, bg.hillFar, horizon - 26, 46, 88, rand)
  drawHills(hills, bg.hillNear, horizon - 4, 34, 66, rand)

  const ground = scene.add.graphics()
  ground.fillStyle(bg.ground, 1).fillRect(0, horizon, GAME_W, GAME_H - horizon)

  // Floating sky pieces — clouds, moons, weather. Alternating halves keeps
  // them off the centre column, where the title plate and battle card sit.
  bg.sky.forEach((key, i) => {
    const leftHalf = i % 2 === 0
    const x = leftHalf ? 46 + rand() * 96 : GAME_W - 46 - rand() * 96
    const y = 86 + rand() * 34
    const size = 26 + rand() * 12
    const img = scene.add.image(x, y, key).setDisplaySize(size, size).setAlpha(0.75)
    ambientTween(scene, {
      targets: img,
      x: x + (rand() < 0.5 ? -16 : 16),
      duration: 4000 + rand() * 2500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    })
  })

  // Ground clutter, drawn small-to-large so nearer pieces overlap farther ones.
  const spots: Array<{ x: number; y: number; size: number; key: string }> = []
  for (let i = 0; i < 9; i++) {
    const y = horizon + 30 + rand() * (GAME_H - horizon - 80)
    const depth = (y - horizon) / (GAME_H - horizon)
    spots.push({
      x: 26 + rand() * (GAME_W - 52),
      y,
      size: 20 + depth * 22,
      key: bg.decor[i % bg.decor.length],
    })
  }
  spots
    .sort((a, b) => a.y - b.y)
    .forEach((s) => {
      scene.add.image(s.x, s.y, s.key).setDisplaySize(s.size, s.size).setAlpha(0.9)
    })
}
