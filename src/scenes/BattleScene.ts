import Phaser from 'phaser'
import { GameState } from '../state/GameState'
import { resolveBattle } from '../systems/combat'
import { effectiveStats } from '../systems/upgrades'
import { makePanel } from '../ui/components/makePanel'
import { makeBar } from '../ui/components/makeBar'
import { COLORS, FONT } from '../ui/styles'

export class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle')
  }

  create(): void {
    const stage = GameState.selectedStage!
    const player = GameState.player!
    const stats = effectiveStats(player)
    const result = resolveBattle(stats, stage.enemy, stage.rewards)
    GameState.lastBattleResult = result

    const { width } = this.scale

    this.add
      .text(width / 2, 48, `${stage.enemy.emoji ?? '👾'} ${stage.name}`, {
        fontSize: '24px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0.5)

    makePanel(this, width / 2, 250, 430, 260)

    const playerSprite = this.add.text(140, 220, '🐱', { fontSize: '60px' }).setOrigin(0.5)
    const enemySprite = this.add.text(340, 220, stage.enemy.emoji ?? '👾', { fontSize: '60px' }).setOrigin(0.5)

    this.add
      .text(140, 275, player.name, { fontSize: '15px', fontFamily: FONT.family, fontStyle: 'bold', color: COLORS.text })
      .setOrigin(0.5)
    this.add
      .text(340, 275, stage.enemy.name.replace(' Guardian', ''), {
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

    const logText = this.add
      .text(width / 2, 430, '⚡ Battle start!', {
        fontSize: '16px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
        align: 'center',
      })
      .setOrigin(0.5)

    let playerHp = stats.maxHp
    let enemyHp = stage.enemy.maxHp
    const renderHp = () => {
      playerBar.set(playerHp / stats.maxHp)
      enemyBar.set(enemyHp / stage.enemy.maxHp)
      playerHpText.setText(`${playerHp} / ${stats.maxHp}`)
      enemyHpText.setText(`${enemyHp} / ${stage.enemy.maxHp}`)
    }
    renderHp()

    const bounce = (target: Phaser.GameObjects.Text) => {
      this.tweens.add({ targets: target, scale: { from: 1, to: 1.25 }, duration: 110, yoyo: true, ease: 'Quad.Out' })
    }
    const shake = (target: Phaser.GameObjects.Text) => {
      this.tweens.add({ targets: target, x: target.x + 8, duration: 50, yoyo: true, repeat: 1 })
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
          bounce(playerSprite)
          shake(enemySprite)
          logText.setText(`💥 You hit for ${ev.damage}!`)
        } else {
          playerHp = ev.targetHpAfter
          bounce(enemySprite)
          shake(playerSprite)
          logText.setText(`💢 Enemy hits you for ${ev.damage}!`)
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
