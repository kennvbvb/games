import type * as Phaser from 'phaser'
import { systemPrefersReducedMotion } from '../platform/prefers'

let userPreference: boolean | null = null

/** Mirrors the player's saved setting so UI code can check it synchronously. */
export function setReducedMotionPreference(value: boolean): void {
  userPreference = value
}

export { systemPrefersReducedMotion }

/** The saved setting wins once chosen; otherwise fall back to the OS preference. */
export function reducedMotion(): boolean {
  return userPreference ?? systemPrefersReducedMotion()
}

/**
 * Adds a purely decorative tween — idle bobbing, drifting scenery, pulsing
 * labels. Skipped entirely when motion is reduced, leaving the target at its
 * resting position. Use scene.tweens.add directly for motion that carries
 * meaning, such as a hit landing.
 */
export function ambientTween(
  scene: Phaser.Scene,
  config: Phaser.Types.Tweens.TweenBuilderConfig,
): Phaser.Tweens.Tween | null {
  if (reducedMotion()) return null
  return scene.tweens.add(config)
}
