import Phaser from 'phaser'

/**
 * MVP battles are rendered with shapes/text only, so there are no
 * external asset packs to load yet. This scene exists as the seam
 * where sprite/audio loading will be added later.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload')
  }

  create(): void {
    this.scene.start('Auth')
  }
}
