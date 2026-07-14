import Phaser from 'phaser'

// Logical design space every scene lays out against.
export const GAME_W = 480
export const GAME_H = 720

// The canvas backing buffer is supersampled by this factor so the picture
// stays crisp when the browser scales it up (high-DPI screens, large windows).
export const RENDER_SCALE = 2

/** Call first in every scene's create(): maps the 480x720 layout onto the supersampled buffer. */
export function setupScene(scene: Phaser.Scene): void {
  const cam = scene.cameras.main
  cam.setZoom(RENDER_SCALE)
  cam.centerOn(GAME_W / 2, GAME_H / 2)
}
