import Phaser from 'phaser'
import { GAME_W, GAME_H, setupScene } from '../config/layout'
import { GameState } from '../state/GameState'
import { signOut } from '../services/authService'
import { getSyncStatus, onSyncStatus, type SyncStatus } from '../services/syncStatus'
import { effectiveStats } from '../systems/upgrades'
import { applyExp } from '../systems/leveling'
import { computeOfflineRewards, formatDuration } from '../systems/idle'
import { persist } from '../services/saveService'
import { makeButton } from '../ui/components/makeButton'
import { makePanel } from '../ui/components/makePanel'
import { makeEmoji } from '../ui/components/makeEmoji'
import { makeStatRow } from '../ui/components/makeStatRow'
import { makeTitle } from '../ui/components/makeTitle'
import { COLORS, FONT } from '../ui/styles'

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenu')
  }

  create(): void {
    setupScene(this)
    const player = GameState.player!
    const stats = effectiveStats(player)

    makeTitle(this, 64, 'Incremental RPG', 'icon_blossom', { fontSize: '29px', iconSize: 22, flank: true })

    // Live cloud-sync status: updates whenever a save starts, succeeds, or fails.
    const statusText = this.add
      .text(GAME_W / 2 + 10, 100, '', { fontSize: '13px', fontFamily: FONT.family, color: COLORS.textDim })
      .setOrigin(0.5)
    const statusIcon = makeEmoji(this, 0, 100, 'icon_home', 15)
    const renderStatus = (status: SyncStatus) => {
      const display: Record<SyncStatus, { icon: string; label: string; color: string }> = {
        guest: { icon: 'icon_home', label: 'Guest mode — progress saved on this device', color: COLORS.textDim },
        saving: { icon: 'icon_cloud', label: 'Saving to cloud…', color: COLORS.textDim },
        synced: { icon: 'icon_cloud', label: 'Signed in — progress synced to the cloud', color: COLORS.textDim },
        error: { icon: 'icon_clash', label: 'Sync failed — progress saved on this device', color: COLORS.danger },
      }
      const d = display[status]
      statusText.setText(d.label).setColor(d.color)
      statusIcon.setTexture(d.icon).setDisplaySize(15, 15).setX(statusText.x - statusText.width / 2 - 11)
    }
    renderStatus(getSyncStatus())
    const unsubscribe = onSyncStatus(renderStatus)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe)

    makePanel(this, GAME_W / 2, 210, 400, 150)
    const hero = makeEmoji(this, 118, 210, `avatar_${player.avatar}`, 62)
    this.tweens.add({ targets: hero, y: 203, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' })

    this.add
      .text(186, 178, `${player.name}  ·  Lv ${player.level}`, {
        fontSize: '20px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0, 0.5)

    makeStatRow(this, 190, 212, [
      { icon: 'icon_hp', value: stats.maxHp },
      { icon: 'icon_atk', value: stats.atk },
      { icon: 'icon_def', value: stats.def },
    ])

    makeEmoji(this, 194, 244, 'icon_gold', 17)
    this.add
      .text(208, 244, `${player.gold} gold`, { fontSize: '15px', fontFamily: FONT.family, color: COLORS.gold })
      .setOrigin(0, 0.5)

    makeButton(this, GAME_W / 2, 340, 'Stages', () => this.scene.start('StageSelect'), {
      minWidth: 240,
      icon: 'icon_atk',
    })
    makeButton(this, GAME_W / 2, 404, 'Character', () => this.scene.start('Character'), {
      minWidth: 240,
      icon: 'icon_face',
    })
    makeButton(this, GAME_W / 2, 468, 'Shop', () => this.scene.start('Shop'), {
      minWidth: 240,
      icon: 'icon_cart',
    })
    makeButton(
      this,
      GAME_W / 2,
      546,
      GameState.userId ? 'Sign Out' : 'Exit Guest Mode',
      () => {
        void this.handleExit()
      },
      { variant: 'secondary', fontSize: '14px' },
    )

    this.showOfflineRewards()
  }

  /**
   * Settles what the hero earned while the game was closed. Shown as a modal
   * over the menu so returning players see the payoff before anything else.
   */
  private showOfflineRewards(): void {
    const player = GameState.player!
    const now = Date.now()
    const report = computeOfflineRewards(player, now)

    if (!report) {
      // Still stamp the visit so the next absence measures from now.
      const touched = { ...player, idle: { ...player.idle, lastSeenAt: now } }
      GameState.player = touched
      void persist(touched, GameState.userId).then((stamped) => {
        GameState.player = stamped
      })
      return
    }

    const veil = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x5d4a66, 0.45).setDepth(10)
    const layer = this.add.container(0, 0).setDepth(11)

    const panel = makePanel(this, GAME_W / 2, GAME_H / 2, 400, 300)
    const title = this.add
      .text(GAME_W / 2, GAME_H / 2 - 112, 'Welcome back!', {
        fontSize: '24px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0.5)
    const sub = this.add
      .text(
        GAME_W / 2,
        GAME_H / 2 - 74,
        `${player.name} kept fighting in ${report.stageName}\nfor ${formatDuration(report.creditedMs)}${report.capped ? ' (max)' : ''}`,
        { fontSize: '14px', fontFamily: FONT.family, color: COLORS.textDim, align: 'center' },
      )
      .setOrigin(0.5)
    const hero = makeEmoji(this, GAME_W / 2, GAME_H / 2 - 14, `avatar_${player.avatar}`, 52)
    const battles = this.add
      .text(GAME_W / 2, GAME_H / 2 + 26, `${report.battles} battles won`, {
        fontSize: '14px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)
    layer.add([panel, title, sub, hero, battles])

    const rewardX = GAME_W / 2 - 84
    makeStatRow(
      this,
      rewardX,
      GAME_H / 2 + 58,
      [
        { icon: 'icon_exp', value: `+${report.rewards.exp}` },
        { icon: 'icon_gold', value: `+${report.rewards.gold}` },
      ],
      { fontSize: '18px', iconSize: 20, gap: 26, depth: 12 },
    )

    const claim = makeButton(
      this,
      GAME_W / 2,
      GAME_H / 2 + 112,
      'Collect',
      () => {
        const collected = applyExp(
          { ...player, gold: player.gold + report.rewards.gold, idle: { ...player.idle, lastSeenAt: now } },
          report.rewards.exp,
        )
        GameState.player = collected
        void persist(collected, GameState.userId).then((stamped) => {
          GameState.player = stamped
        })
        this.scene.restart()
      },
      { minWidth: 200 },
    )
    veil.setDepth(10)
    claim.setDepth(12)
  }

  private async handleExit(): Promise<void> {
    if (GameState.userId) await signOut()
    GameState.userId = null
    GameState.player = null
    this.scene.start('Auth')
  }
}
