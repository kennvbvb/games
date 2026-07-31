import Phaser from 'phaser'

/**
 * Places one of the preloaded Noto emoji textures. Source art is 128px, so
 * displaying at or below ~64px stays crisp even with the 2x camera zoom.
 */
export function makeEmoji(
  scene: Phaser.Scene,
  x: number,
  y: number,
  key: string,
  size: number,
): Phaser.GameObjects.Image {
  return scene.add.image(x, y, key).setDisplaySize(size, size)
}
