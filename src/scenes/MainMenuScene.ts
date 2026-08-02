import Phaser from 'phaser'
import { GAME_W, GAME_H, setupScene } from '../config/layout'
import { GameState } from '../state/GameState'
import { heroTexture } from '../data/races'
import { isAdminGranted } from '../admin/AdminAccess'
import { signOut } from '../services/authService'
import { getSyncStatus, onSyncStatus, type SyncStatus } from '../services/syncStatus'
import { effectiveStats } from '../systems/upgrades'
import { claimableCount } from '../systems/achievements'
import { bestFloor, towerUnlocked } from '../systems/tower'
import { applyExp } from '../systems/leveling'
import { computeOfflineRewards, formatDuration } from '../systems/idle'
import { persist } from '../services/saveService'
import { recordEvent } from '../services/analytics'
import { makeButton } from '../ui/components/makeButton'
import { makePanel } from '../ui/components/makePanel'
import { makeEmoji } from '../ui/components/makeEmoji'
import { makeStatRow } from '../ui/components/makeStatRow'
import { makeTitle } from '../ui/components/makeTitle'
import { makeTutorialTip } from '../ui/components/makeTutorialTip'
import { ambientTween } from '../ui/motion'
import { COLORS, FONT } from '../ui/styles'
import { t } from '../i18n'

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenu')
  }

  create(): void {
    setupScene(this)
    const player = GameState.player!
    const stats = effectiveStats(player)

    makeTitle(this, 64, t('app.title'), 'icon_blossom', { fontSize: '29px', iconSize: 22, flank: true })

    // Live cloud-sync status: updates whenever a save starts, succeeds, or fails.
    const statusText = this.add
      .text(GAME_W / 2 + 10, 100, '', { fontSize: '13px', fontFamily: FONT.family, color: COLORS.textDim })
      .setOrigin(0.5)
    const statusIcon = makeEmoji(this, 0, 100, 'icon_home', 15)
    const renderStatus = (status: SyncStatus) => {
      const display: Record<SyncStatus, { icon: string; label: string; color: string }> = {
        guest: { icon: 'icon_home', label: t('sync.guest'), color: COLORS.textDim },
        saving: { icon: 'icon_cloud', label: t('sync.saving'), color: COLORS.textDim },
        synced: { icon: 'icon_cloud', label: t('sync.synced'), color: COLORS.textDim },
        error: { icon: 'icon_clash', label: t('sync.error'), color: COLORS.danger },
      }
      const d = display[status]
      statusText.setText(d.label).setColor(d.color)
      statusIcon.setTexture(d.icon).setDisplaySize(15, 15).setX(statusText.x - statusText.width / 2 - 11)
    }
    renderStatus(getSyncStatus())
    const unsubscribe = onSyncStatus(renderStatus)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe)

    makePanel(this, GAME_W / 2, 210, 400, 150)
    const hero = makeEmoji(this, 118, 210, heroTexture(player), 62)
    ambientTween(this, { targets: hero, y: 203, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' })

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
      .text(208, 244, t('menu.gold', { gold: player.gold }), { fontSize: '15px', fontFamily: FONT.family, color: COLORS.gold })
      .setOrigin(0, 0.5)

    makeButton(this, GAME_W / 2, 334, t('menu.stages'), () => this.scene.start('StageSelect'), {
      minWidth: 240,
      icon: 'icon_atk',
    })
    makeButton(this, GAME_W / 2, 396, t('menu.character'), () => this.scene.start('Character'), {
      minWidth: 240,
      icon: 'icon_face',
    })
    makeButton(this, GAME_W / 2, 458, t('menu.shop'), () => this.scene.start('Shop'), {
      minWidth: 240,
      icon: 'icon_cart',
    })

    // Quests shares its row with the tower rather than taking the full width.
    // The tower is endgame content most saves cannot open yet, so it does not
    // earn a row of its own — but it does have to be visible from the menu, or
    // finishing the campaign would end at a screen with nothing after it.
    const claimable = claimableCount(player)
    makeButton(
      this,
      GAME_W / 2 - 92,
      520,
      claimable > 0 ? t('menu.questsBadge', { count: claimable }) : t('menu.quests'),
      () => this.scene.start('Achievements'),
      { variant: claimable > 0 ? 'primary' : 'secondary', minWidth: 168, fontSize: '15px', icon: 'icon_star' },
    )
    const climbed = towerUnlocked(player) ? bestFloor(player) : 0
    makeButton(
      this,
      GAME_W / 2 + 92,
      520,
      climbed > 0 ? t('menu.towerBadge', { floor: climbed }) : t('menu.tower'),
      () => this.scene.start('Tower'),
      { variant: 'secondary', minWidth: 168, fontSize: '15px', icon: 'decor_tower' },
    )

    makeButton(this, GAME_W / 2 - 92, 586, t('menu.settings'), () => this.scene.start('Settings'), {
      variant: 'secondary',
      minWidth: 168,
      fontSize: '15px',
      icon: 'icon_bolt',
    })
    makeButton(
      this,
      GAME_W / 2 + 92,
      586,
      GameState.userId ? t('menu.signOut') : t('menu.exitGuest'),
      () => {
        void this.handleExit()
      },
      { variant: 'secondary', minWidth: 168, fontSize: '15px' },
    )

    makeTutorialTip(this, 0, t('tutorial.step0'), 656)
    this.installTestLabEntry()
    this.showOfflineRewards()
  }

  /**
   * The way into the Test Lab, for whoever holds a grant. Both routes are here
   * on purpose: the hotkey is what a developer reaches for, and the button is
   * what makes the lab discoverable to a production admin who was told it
   * exists but not told a key combination.
   *
   * Rendering this is not what keeps anyone out — see admin/AdminAccess.
   */
  private installTestLabEntry(): void {
    if (!isAdminGranted(GameState.adminGrant)) return

    this.input.keyboard?.on('keydown-A', (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey) this.scene.start('Admin')
    })

    const badge = this.add.graphics()
    badge.fillStyle(0x3c3348, 1).fillRoundedRect(GAME_W - 92, 22, 74, 26, 7)
    badge.lineStyle(1, 0xffd166, 1).strokeRoundedRect(GAME_W - 92, 22, 74, 26, 7)
    const label = this.add
      .text(GAME_W - 55, 35, 'TEST LAB', {
        fontSize: '11px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: '#ffd166',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
    label.on('pointerdown', () => this.scene.start('Admin'))
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
      .text(GAME_W / 2, GAME_H / 2 - 112, t('idle.welcomeBack'), {
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
        t('idle.keptFighting', {
          name: player.name,
          stage: report.stageName,
          duration: formatDuration(report.creditedMs),
          capped: report.capped ? t('idle.capped') : '',
        }),
        { fontSize: '14px', fontFamily: FONT.family, color: COLORS.textDim, align: 'center' },
      )
      .setOrigin(0.5)
    const hero = makeEmoji(this, GAME_W / 2, GAME_H / 2 - 14, heroTexture(player), 52)
    const battles = this.add
      .text(GAME_W / 2, GAME_H / 2 + 26, t('idle.battlesWon', { count: report.battles }), {
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
      t('idle.collect'),
      () => {
        recordEvent({
          name: 'offline_collected',
          battles: report.battles,
          hours: report.creditedMs / (60 * 60 * 1000),
        })
        const collected = applyExp(
          {
            ...player,
            gold: player.gold + report.rewards.gold,
            idle: { ...player.idle, lastSeenAt: now },
            // Offline wins count towards achievements the same as fought ones.
            lifetime: {
              battlesWon: player.lifetime.battlesWon + report.battles,
              goldEarned: player.lifetime.goldEarned + report.rewards.gold,
            },
          },
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
