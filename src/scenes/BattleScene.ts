import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { GameState } from '../state/GameState'
import { isBossStage } from '../data/stages'
import { heroTexture } from '../data/races'
import { resolveBattle } from '../systems/combat'
import { playerBattleInputs } from '../systems/playerBattle'
import { enemyFor, rewardsFor } from '../data/difficulties'
import { makeButton } from '../ui/components/makeButton'
import { makePanel } from '../ui/components/makePanel'
import { makeBar } from '../ui/components/makeBar'
import { makeEmoji } from '../ui/components/makeEmoji'
import { drawStageScenery } from '../ui/scenery'
import { COLORS, FONT } from '../ui/styles'
import type { AnnounceKind, BattleSpeed } from '../types'
import { t } from '../i18n'

const BASE_TURN_MS = 260
/** Kept on an enraged boss for the rest of the fight. */
const ENRAGE_TINT = 0xff8f8f

/** One line per announcement kind — the only thing allowed to take the banner. */
const ANNOUNCEMENTS: Record<AnnounceKind, (enemy: string) => [string, string]> = {
  enraged: (enemy) => ['decor_fire', t('battle.enraged', { enemy })],
  fierce: (enemy) => ['decor_fire', t('battle.fierce', { enemy })],
  bloodrage: () => ['icon_hit', t('battle.bloodrage')],
  precision: () => ['icon_star', t('battle.precision')],
  attrition: () => ['decor_fog', t('battle.attrition')],
  execute: () => ['icon_hit', t('battle.execute')],
}
const SPEEDS: BattleSpeed[] = [1, 2, 4]

export class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle')
  }

  create(): void {
    setupScene(this)
    const stage = GameState.selectedStage!
    const player = GameState.player!
    const inputs = playerBattleInputs(player)
    const stats = inputs.player
    const plan = GameState.selectedPlan ?? player.settings.battlePlan
    const result = resolveBattle({
      ...inputs,
      enemy: enemyFor(stage.enemy, player.settings.difficulty),
      rewards: rewardsFor(stage.rewards, player.settings.difficulty),
      plan,
    })
    GameState.lastBattleResult = result

    // Replaying a stage that's already been beaten is pure waiting, so the
    // skip setting jumps straight to the payoff.
    const alreadyCleared = player.stageProgress.completedStageIds.includes(stage.id)
    if (player.settings.skipCleared && alreadyCleared) {
      this.scene.start('Result')
      return
    }

    drawStageScenery(this, stage.bg, stage.order, { horizon: 452 })

    // Title plate keeps the name legible over whatever scenery is behind it.
    makePanel(this, GAME_W / 2, 46, 300, 46)
    const boss = isBossStage(stage)
    const title = this.add
      .text(GAME_W / 2 + (boss ? 11 : 0), 46, stage.name, {
        fontSize: '21px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: boss ? COLORS.danger : COLORS.text,
      })
      .setOrigin(0.5)
    if (boss) makeEmoji(this, title.x - title.width / 2 - 14, 46, 'decor_skull', 20)

    makePanel(this, GAME_W / 2, 250, 430, 250)

    const playerSprite = makeEmoji(this, 140, 218, heroTexture(player), 64)
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
      .text(0, 356, t('battle.start'), {
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
    layoutLog('icon_bolt', t('battle.start'))

    if (GameState.autoRunsRemaining > 0) {
      this.add
        .text(GAME_W / 2, 400, t('battle.autoRun', { run: GameState.autoRunCount + 1 }), {
          fontSize: '13px',
          fontFamily: FONT.family,
          color: COLORS.textDim,
        })
        .setOrigin(0.5)
    }

    this.buildSpeedControls()

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
    // An enraged boss keeps its angry tint, so the hit flash has to restore it
    // rather than clearing back to neutral.
    let enrageTint = false
    const recoil = (target: Phaser.GameObjects.Image) => {
      this.tweens.add({ targets: target, angle: 12, duration: 60, yoyo: true, repeat: 1 })
      target.setTint(0xffaaaa)
      this.time.delayedCall(160, () => {
        if (target === enemySprite && enrageTint) target.setTint(ENRAGE_TINT)
        else target.clearTint()
      })
    }

    if (result.log.length === 0) {
      this.time.delayedCall(400, () => this.scene.start('Result'))
      return
    }

    const speed = player.settings.battleSpeed
    let i = 0
    this.time.addEvent({
      delay: BASE_TURN_MS / speed,
      repeat: result.log.length - 1,
      callback: () => {
        const ev = result.log[i]
        const attacker = ev.attacker === 'player' ? playerSprite : enemySprite
        const defender = ev.attacker === 'player' ? enemySprite : playerSprite

        if (ev.attacker === 'player') enemyHp = ev.targetHpAfter
        else playerHp = ev.targetHpAfter
        if (ev.selfHpAfter !== undefined) {
          if (ev.attacker === 'player') playerHp = ev.selfHpAfter
          else enemyHp = ev.selfHpAfter
        }

        lunge(attacker, ev.attacker === 'player' ? 1 : -1)

        if (ev.dodged) {
          // Sidestep instead of a hit flash — the one way to take no damage.
          this.tweens.add({ targets: defender, x: defender.x + 14, duration: 90, yoyo: true, ease: 'Quad.Out' })
          this.floatText(defender.x, defender.y - 34, t('battle.dodge'), COLORS.textDim)
          layoutLog('icon_bolt', t('battle.dodge'))
        } else {
          recoil(defender)
          if (ev.crit) this.tweens.add({ targets: attacker, scale: attacker.scale * 1.16, duration: 130, yoyo: true })
          layoutLog(
            ev.attacker === 'player' ? 'icon_hit' : 'icon_clash',
            ev.attacker === 'player'
              ? t('battle.youHit', { damage: ev.damage })
              : t('battle.enemyHits', { enemy: stage.enemy.name, damage: ev.damage }),
          )
        }

        // Heals get a float over the healer, never the banner — a defensive
        // plan mends seven times in a twenty-turn fight.
        if (ev.healed !== undefined) {
          this.floatText(attacker.x, attacker.y - 34, `+${ev.healed}`, COLORS.success)
        }

        // The banner is reserved for things that happen once per fight.
        if (ev.announce !== undefined) {
          const [icon, message] = ANNOUNCEMENTS[ev.announce](stage.enemy.name)
          layoutLog(icon, message)
          if (ev.announce === 'enraged' || ev.announce === 'fierce') {
            enrageTint = true
            enemySprite.setTint(ENRAGE_TINT)
            this.tweens.add({ targets: enemySprite, scale: enemySprite.scale * 1.18, duration: 200, yoyo: true })
          }
        }
        renderHp()
        i++
        if (i >= result.log.length) {
          this.time.delayedCall(600 / speed, () => this.scene.start('Result'))
        }
      },
    })
  }

  /** A short-lived number or word that drifts up off a sprite and fades. */
  private floatText(x: number, y: number, message: string, color: string): void {
    const label = this.add
      .text(x, y, message, { fontSize: '15px', fontFamily: FONT.family, fontStyle: 'bold', color })
      .setOrigin(0.5)
      .setDepth(20)
    this.tweens.add({
      targets: label,
      y: y - 26,
      alpha: { from: 1, to: 0 },
      duration: 620,
      ease: 'Quad.Out',
      onComplete: () => label.destroy(),
    })
  }

  /** Speed toggles plus an immediate skip; both persist the choice for next time. */
  private buildSpeedControls(): void {
    const player = GameState.player!
    SPEEDS.forEach((speed, i) => {
      makeButton(
        this,
        96 + i * 74,
        556,
        `×${speed}`,
        () => {
          GameState.player = { ...player, settings: { ...player.settings, battleSpeed: speed } }
          this.scene.restart()
        },
        {
          variant: player.settings.battleSpeed === speed ? 'primary' : 'secondary',
          minWidth: 64,
          fontSize: '15px',
        },
      )
    })
    makeButton(this, 386, 556, t('battle.skip'), () => this.scene.start('Result'), {
      variant: 'secondary',
      minWidth: 84,
      fontSize: '15px',
    })
  }
}
