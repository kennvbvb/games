import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { GameState } from '../state/GameState'
import { signOut } from '../services/authService'
import { getSyncStatus, onSyncStatus, type SyncStatus } from '../services/syncStatus'
import { effectiveStats } from '../systems/upgrades'
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
  }

  private async handleExit(): Promise<void> {
    if (GameState.userId) await signOut()
    GameState.userId = null
    GameState.player = null
    this.scene.start('Auth')
  }
}
