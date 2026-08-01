import Phaser from 'phaser'
import { gameConfig } from './config/gameConfig'
import { RENDER_SCALE } from './config/layout'
import { GameState } from './state/GameState'
import { persist } from './services/saveService'

// Rasterize text glyphs at the supersampled resolution, otherwise the zoomed
// camera would scale up 1x text textures and blur them. TextStyle has no
// global default, so patch the style setter once here.
const textStyleProto = Phaser.GameObjects.TextStyle.prototype
const originalSetStyle = textStyleProto.setStyle
textStyleProto.setStyle = function (
  this: Phaser.GameObjects.TextStyle,
  style: Phaser.Types.GameObjects.Text.TextStyle,
  updateText?: boolean,
  setDefaults?: boolean,
) {
  const result = originalSetStyle.call(this, style, updateText, setDefaults)
  if (!this.resolution || this.resolution <= 1) {
    this.resolution = RENDER_SCALE
  }
  return result
}

new Phaser.Game(gameConfig)

window.addEventListener('beforeunload', () => {
  if (GameState.player) {
    void persist(GameState.player, GameState.userId)
  }
})

// The worker is only emitted by the production build, and registration is
// scoped to the deployment's base path so a project site under /games/ does
// not claim the whole domain.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const base = import.meta.env.BASE_URL
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch((err) => {
      // Offline play is a bonus; a failed registration must not break the game.
      console.warn('Service worker registration failed', err)
    })
  })
}
