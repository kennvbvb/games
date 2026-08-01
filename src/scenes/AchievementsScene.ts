import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { GameState } from '../state/GameState'
import { persist } from '../services/saveService'
import { achievementList, claimAchievement } from '../systems/achievements'
import { makeButton } from '../ui/components/makeButton'
import { makePanel } from '../ui/components/makePanel'
import { makeBar } from '../ui/components/makeBar'
import { makeEmoji } from '../ui/components/makeEmoji'
import { makeTitle } from '../ui/components/makeTitle'
import { COLORS, FONT } from '../ui/styles'
import { t } from '../i18n'
import type { AchievementStatus } from '../systems/achievements'

const PER_PAGE = 4
const ROW_YS = [140, 236, 332, 428]

interface SceneData {
  page?: number
}

export class AchievementsScene extends Phaser.Scene {
  private page = 0

  constructor() {
    super('Achievements')
  }

  init(data: SceneData): void {
    this.page = data.page ?? 0
  }

  create(): void {
    setupScene(this)
    const player = GameState.player!
    const list = achievementList(player)
    const pageCount = Math.max(1, Math.ceil(list.length / PER_PAGE))
    this.page = Math.min(Math.max(this.page, 0), pageCount - 1)

    makeTitle(this, 46, t('achv.title'), 'icon_star')
    this.add
      .text(GAME_W / 2, 84, t('achv.subtitle'), {
        fontSize: '13px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)

    list.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE).forEach((status, i) => {
      this.renderRow(status, ROW_YS[i])
    })

    const pagerY = 506
    makeButton(this, GAME_W / 2 - 110, pagerY, '◀', () => this.turnPage(-1), {
      disabled: this.page === 0,
      fontSize: '16px',
      minWidth: 64,
    })
    this.add
      .text(GAME_W / 2, pagerY, t('stages.page', { current: this.page + 1, total: pageCount }), {
        fontSize: '15px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)
    makeButton(this, GAME_W / 2 + 110, pagerY, '▶', () => this.turnPage(1), {
      disabled: this.page >= pageCount - 1,
      fontSize: '16px',
      minWidth: 64,
    })

    makeButton(this, GAME_W / 2, 586, t('common.back'), () => this.scene.start('MainMenu'), {
      variant: 'secondary',
      minWidth: 180,
      fontSize: '15px',
    })
  }

  private renderRow(status: AchievementStatus, y: number): void {
    const { achievement, current, ratio, claimable, claimed } = status

    makePanel(this, GAME_W / 2, y, 430, 86)
    const icon = makeEmoji(this, 60, y - 6, achievement.icon, 34)
    if (claimed) icon.setAlpha(0.45)

    this.add
      .text(96, y - 22, t(achievement.nameKey), {
        fontSize: '16px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: claimed ? COLORS.textDim : COLORS.text,
      })
      .setOrigin(0, 0.5)

    // Bar is anchored from its centre, so offset by half its width.
    const barW = 180
    makeBar(this, 96 + barW / 2, y + 4, barW, 10, claimable ? COLORS.hpBar : COLORS.expBar).set(ratio)
    this.add
      .text(96, y + 26, t('achv.progress', { current, target: achievement.target }), {
        fontSize: '11px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0, 0.5)

    makeEmoji(this, 300, y + 26, 'icon_gold', 13)
    this.add
      .text(310, y + 26, `${achievement.reward}`, { fontSize: '11px', fontFamily: FONT.family, color: COLORS.gold })
      .setOrigin(0, 0.5)

    if (claimed) {
      this.add
        .text(378, y, t('achv.claimed'), {
          fontSize: '13px',
          fontFamily: FONT.family,
          fontStyle: 'bold',
          color: COLORS.success,
        })
        .setOrigin(0.5)
    } else {
      makeButton(this, 378, y, t('achv.claim'), () => this.claim(achievement.id), {
        disabled: !claimable,
        minWidth: 92,
        fontSize: '14px',
        minHeight: 48,
      })
    }
  }

  private claim(id: string): void {
    const next = claimAchievement(GameState.player!, id)
    if (!next) return
    GameState.player = next
    void persist(next, GameState.userId).then((stamped) => {
      GameState.player = stamped
    })
    this.scene.restart({ page: this.page } satisfies SceneData)
  }

  private turnPage(dir: number): void {
    this.scene.restart({ page: this.page + dir } satisfies SceneData)
  }
}
