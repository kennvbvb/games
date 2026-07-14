import Phaser from 'phaser'
import { GameState } from '../state/GameState'
import { resolveBattle } from '../systems/combat'
import { COLORS } from '../ui/styles'

export class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle')
  }

  create(): void {
    const stage = GameState.selectedStage!
    const player = GameState.player!
    const result = resolveBattle(player.stats, stage.enemy, stage.rewards)
    GameState.lastBattleResult = result

    const { width, height } = this.scale

    this.add.text(width / 2, 40, stage.name, { fontSize: '22px', color: COLORS.text }).setOrigin(0.5)

    const playerHpText = this.add.text(40, 100, '', { fontSize: '16px', color: COLORS.text })
    const enemyHpText = this.add.text(width - 40, 100, '', { fontSize: '16px', color: COLORS.text, align: 'right' }).setOrigin(1, 0)
    const logText = this.add
      .text(width / 2, height / 2, 'Battle start!', { fontSize: '16px', color: COLORS.textDim, align: 'center' })
      .setOrigin(0.5)

    let playerHp = player.stats.maxHp
    let enemyHp = stage.enemy.maxHp
    const renderHp = () => {
      playerHpText.setText(`${player.name}\nHP ${playerHp}/${player.stats.maxHp}`)
      enemyHpText.setText(`${stage.enemy.name}\nHP ${enemyHp}/${stage.enemy.maxHp}`)
    }
    renderHp()

    if (result.log.length === 0) {
      this.time.delayedCall(400, () => this.scene.start('Result'))
      return
    }

    let i = 0
    this.time.addEvent({
      delay: 250,
      repeat: result.log.length - 1,
      callback: () => {
        const ev = result.log[i]
        if (ev.attacker === 'player') {
          enemyHp = ev.targetHpAfter
          logText.setText(`You hit ${stage.enemy.name} for ${ev.damage}`)
        } else {
          playerHp = ev.targetHpAfter
          logText.setText(`${stage.enemy.name} hits you for ${ev.damage}`)
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
