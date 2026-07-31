import Phaser from 'phaser'
import { GAME_W } from '../../config/layout'
import { GameState } from '../../state/GameState'
import { persist } from '../../services/saveService'
import { makeEmoji } from './makeEmoji'
import { COLORS, FONT } from '../styles'
import { TUTORIAL_DONE } from '../../types'

/**
 * Shows the tip for one step of the three-step intro, but only while the player
 * is actually on that step. Reaching the screen is what advances the tutorial,
 * so there is nothing extra to dismiss and no way to get stuck part-way.
 */
export function makeTutorialTip(scene: Phaser.Scene, step: number, message: string, y: number): void {
  const player = GameState.player
  if (!player || player.tutorialStep !== step) return

  const text = scene.add
    .text(GAME_W / 2 + 12, y, message, {
      fontSize: '13px',
      fontFamily: FONT.family,
      fontStyle: 'bold',
      color: COLORS.text,
      align: 'center',
      wordWrap: { width: 330 },
    })
    .setOrigin(0.5)
    .setDepth(50)

  const w = text.width + 64
  const h = text.height + 26
  const bubble = scene.add.graphics().setDepth(49)
  bubble
    .fillStyle(COLORS.panel, 1)
    .fillRoundedRect(GAME_W / 2 - w / 2, y - h / 2, w, h, h / 2)
    .lineStyle(3, COLORS.primary, 1)
    .strokeRoundedRect(GAME_W / 2 - w / 2, y - h / 2, w, h, h / 2)

  makeEmoji(scene, text.x - text.width / 2 - 16, y, 'icon_levelup', 18).setDepth(50)
}

/** Moves the player on to `step` if they have not already passed it. */
export function advanceTutorial(step: number): void {
  const player = GameState.player
  if (!player || player.tutorialStep >= step || player.tutorialStep >= TUTORIAL_DONE) return
  const next = { ...player, tutorialStep: Math.min(step, TUTORIAL_DONE) }
  GameState.player = next
  void persist(next, GameState.userId).then((stamped) => {
    GameState.player = stamped
  })
}
