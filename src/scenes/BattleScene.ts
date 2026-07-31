import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { GameState } from '../state/GameState'
import { resolveBattle } from '../systems/combat'
import { effectiveStats } from '../systems/upgrades'
import { makePanel } from '../ui/components/makePanel'
import { makeBar } from '../ui/components/makeBar'
import { makeEmoji } from '../ui/components/makeEmoji'
import { drawStageScenery } from '../ui/scenery'
import { COLORS, FONT } from '../ui/styles'

export class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle')
  }

  create(): void {
    setupScene(this)
    const stage = GameState.selectedStage!
    const player = GameState.player!
    const stats = effectiveStats(player)
    const result = resolveBattle(stats, stage.enemy, stage.rewards)
    GameState.lastBattleResult = result

    drawStageScenery(this, stage.bg, stage.order, { horizon: 452 })

    // Title plate keeps the name legible over whatever scenery is behind it.
    makePanel(this, GAME_W / 2, 46, 300, 46)
    this.add
      .text(GAME_W / 2, 46, stage.name, {
        fontSize: '21px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0.5)

    makePanel(this, GAME_W / 2, 250, 430, 250)

    const playerSprite = makeEmoji(this, 140, 218, `avatar_${player.avatar}`, 64)
    const enemySprite = makeEmoji(this, 340, 218, stage.enemy.sprite, 64)

    this.add
      .text(140, 274, player.name, { fontSize: '15px', fontFamily: FONT.family, fontStyle: 'bold', color: COLORS.text })
      .setOrigin(0.5)
    this.add
      .text(340, 274, stage.enemy.name, {
        fontSize: '15px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0.5)

    const playerBar = makeBar(this, 140, 300, 140, 12, COLORS.hpBar)
    const enemyBar = makeBar(this, 340, 300, 140, 12, COLORS.enemyHpBar)
    const playerHpText = this.add
      .text(140, 320, '', { fontSize: '12px', fontFamily: FONT.family, color: COLORS.textDim })
      .setOrigin(0.5)
    const enemyHpText = this.add
      .text(340, 320, '', { fontSize: '12px', fontFamily: FONT.family, color: COLORS.textDim })
      .setOrigin(0.5)

    const logIcon = makeEmoji(this, 0, 356, 'icon_bolt', 20)
    const logText = this.add
      .text(0, 356, 'Battle start!', {
        fontSize: '16px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0, 0.5)
    // Icon + label are laid out as one centred unit, re-centred on every message.
    const layoutLog = (icon: string, message: string) => {
      logIcon.setTexture(icon)
      logText.setText(message)
      const total = 20 + 6 + logText.width
      logIcon.setX(GAME_W / 2 - total / 2 + 10)
      logText.setX(GAME_W / 2 - total / 2 + 26)
    }
    layoutLog('icon_bolt', 'Battle start!')

    let playerHp = stats.maxHp
    let enemyHp = stage.enemy.maxHp
    const renderHp = () => {
      playerBar.set(playerHp / stats.maxHp)
      enemyBar.set(enemyHp / stage.enemy.maxHp)
      playerHpText.setText(`${playerHp} / ${stats.maxHp}`)
      enemyHpText.setText(`${enemyHp} / ${stage.enemy.maxHp}`)
    }
    renderHp()

    const lunge = (target: Phaser.GameObjects.Image, dir: number) => {
      this.tweens.add({ targets: target, x: target.x + 18 * dir, duration: 110, yoyo: true, ease: 'Quad.Out' })
    }
    const recoil = (target: Phaser.GameObjects.Image) => {
      this.tweens.add({ targets: target, angle: 12, duration: 60, yoyo: true, repeat: 1 })
      target.setTint(0xffaaaa)
      this.time.delayedCall(160, () => target.clearTint())
    }

    if (result.log.length === 0) {
      this.time.delayedCall(400, () => this.scene.start('Result'))
      return
    }

    let i = 0
    this.time.addEvent({
      delay: 260,
      repeat: result.log.length - 1,
      callback: () => {
        const ev = result.log[i]
        if (ev.attacker === 'player') {
          enemyHp = ev.targetHpAfter
          lunge(playerSprite, 1)
          recoil(enemySprite)
          layoutLog('icon_hit', `You hit for ${ev.damage}!`)
        } else {
          playerHp = ev.targetHpAfter
          lunge(enemySprite, -1)
          recoil(playerSprite)
          layoutLog('icon_clash', `${stage.enemy.name} hits you for ${ev.damage}!`)
        }
        renderHp()
        i++
        if (i >= result.log.length) {
          this.time.delayedCall(600, () => this.scene.start('Result'))
        }
      },
    })
  }
}
