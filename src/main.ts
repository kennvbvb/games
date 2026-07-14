import Phaser from 'phaser'
import { gameConfig } from './config/gameConfig'
import { GameState } from './state/GameState'
import { persist } from './services/saveService'

new Phaser.Game(gameConfig)

window.addEventListener('beforeunload', () => {
  if (GameState.player) {
    void persist(GameState.player, GameState.userId)
  }
})
