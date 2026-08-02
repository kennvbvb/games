import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { GameState } from '../state/GameState'
import { persist } from '../services/saveService'
import { BATTLE_PLANS } from '../data/battlePlans'
import { traitOf } from '../data/enemyTraits'
import { equippedSkills } from '../systems/skills'
import { isBossStage } from '../data/stages'
import { FORECAST_LABEL_KEYS, planOutlooks, recommendPlan } from '../systems/difficulty'
import { makeButton } from '../ui/components/makeButton'
import { makePanel } from '../ui/components/makePanel'
import { makeEmoji } from '../ui/components/makeEmoji'
import { makeTitle } from '../ui/components/makeTitle'
import { COLORS, FONT } from '../ui/styles'
import type { PlanId } from '../data/battlePlans'
import type { StageOutlook } from '../systems/difficulty'
import type { StageConfig } from '../types'
import type { MessageKey } from '../i18n'
import { t } from '../i18n'

// Shifted down 20px to make room for Boss Intel, which needs three lines on a
// late boss and would otherwise have run under the first plan card.
const ROW_YS = [288, 400, 512]
const ROW_H = 104

const TIER_COLOR = {
  easy: COLORS.success,
  fair: COLORS.gold,
  hard: COLORS.danger,
} as const

/**
 * Commit to a plan before fighting. This is the only screen that simulates all
 * three plans — a stage card has room for one honest number, and running three
 * forecasts per card would be noise rather than information.
 */
export class PrepareBattleScene extends Phaser.Scene {
  constructor() {
    super('PrepareBattle')
  }

  create(): void {
    setupScene(this)
    const player = GameState.player!
    const stage = GameState.selectedStage!
    const outlooks = planOutlooks(player, stage)
    const best = recommendPlan(player, stage)
    const trait = traitOf(stage.enemy.trait)

    makeTitle(this, 44, t('plan.title'), 'icon_bolt')

    // Who you are about to fight, everything that makes them awkward, and what
    // you are bringing — all inside one panel, because the plan cards below
    // need every pixel from y=236 down.
    makePanel(this, GAME_W / 2, 158, 430, 140)
    makeEmoji(this, 66, 112, stage.enemy.sprite, 38)
    const name = this.add
      .text(100, 104, stage.enemy.name, {
        fontSize: '17px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: isBossStage(stage) ? COLORS.danger : COLORS.text,
      })
      .setOrigin(0, 0.5)
    if (isBossStage(stage)) makeEmoji(this, name.x + name.width + 14, 104, 'decor_skull', 15)

    const traitLabel = this.add
      .text(100, 128, t(trait.nameKey), {
        fontSize: '13px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.gold,
      })
      .setOrigin(0, 0.5)
    makeEmoji(this, traitLabel.x + traitLabel.width + 12, 128, trait.icon, 14)
    this.add
      .text(66, 152, t(trait.descriptionKey), {
        fontSize: '11px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
        wordWrap: { width: 360 },
      })
      .setOrigin(0, 0.5)

    this.renderLoadout()
    this.renderBossIntel(stage)

    BATTLE_PLANS.forEach((plan, i) => {
      this.renderPlan(plan.id, outlooks[plan.id], ROW_YS[i], best?.plan === plan.id)
    })

    if (best === null) {
      this.add
        .text(GAME_W / 2, 590, t('plan.noneWork'), {
          fontSize: '12px',
          fontFamily: FONT.family,
          color: COLORS.danger,
          align: 'center',
          wordWrap: { width: 400 },
        })
        .setOrigin(0.5)
    }

    makeButton(this, GAME_W / 2, 648, t('common.back'), () => this.scene.start('StageSelect'), {
      variant: 'secondary',
      minWidth: 180,
      fontSize: '15px',
    })
  }

  /**
   * What the boss will do, before the player commits. A phase that only reveals
   * itself at 30% health is a rewind for anyone who brought the wrong build, so
   * every transition is spelled out in advance.
   */
  private renderBossIntel(stage: StageConfig): void {
    if (!isBossStage(stage)) return
    const phases = stage.enemy.boss?.phases ?? []
    const label = this.add
      .text(66, 180, t('boss.intel'), {
        fontSize: '11px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.danger,
      })
      .setOrigin(0, 0.5)

    if (phases.length === 0) {
      this.add
        .text(label.x + label.width + 10, 180, t('boss.noPhases'), {
          fontSize: '10px',
          fontFamily: FONT.family,
          color: COLORS.textDim,
        })
        .setOrigin(0, 0.5)
      return
    }

    phases.forEach((phase, i) => {
      this.add
        .text(
          134,
          180 + i * 14,
          t('boss.phase', {
            hp: Math.round(phase.atHpBelow * 100),
            effect: t(phase.labelKey as MessageKey),
          }),
          { fontSize: '10px', fontFamily: FONT.family, color: COLORS.textDim, wordWrap: { width: 314 } },
        )
        .setOrigin(0, 0.5)
    })
  }

  /**
   * The build this forecast was computed under. Without it the numbers below
   * look like a property of the stage, and a player who forgot to fill a slot
   * has no way to see why the fight got harder.
   */
  private renderLoadout(): void {
    const skills = equippedSkills(GameState.player!)
    // Top-right of the enemy panel, on the name line. Labelled rather than four
    // bare icons — an unlabelled sprite row reads as decoration.
    const label = this.add
      .text(GAME_W - 34, 104, t('plan.loadout'), {
        fontSize: '10px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.textDim,
      })
      .setOrigin(1, 0.5)

    if (skills.length === 0) {
      label.setY(112)
      this.add
        .text(GAME_W - 34, 126, t('plan.noSkills'), {
          fontSize: '10px',
          fontFamily: FONT.family,
          color: COLORS.textDisabled,
        })
        .setOrigin(1, 0.5)
      return
    }
    const right = GAME_W - 40
    skills.forEach((skill, i) =>
      makeEmoji(this, right - (skills.length - 1 - i) * 22, 126, skill.icon, 18),
    )
  }

  private renderPlan(id: PlanId, outlook: StageOutlook, y: number, recommended: boolean): void {
    const plan = BATTLE_PLANS.find((p) => p.id === id)!
    const top = y - ROW_H / 2
    makePanel(this, GAME_W / 2, y, 430, ROW_H)

    makeEmoji(this, 62, top + 26, plan.icon, 22)
    const label = this.add
      .text(86, top + 26, t(plan.nameKey), {
        fontSize: '16px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: COLORS.text,
      })
      .setOrigin(0, 0.5)

    if (recommended) {
      this.add
        .text(label.x + label.width + 10, top + 26, t('plan.recommended'), {
          fontSize: '10px',
          fontFamily: FONT.family,
          fontStyle: 'bold',
          color: COLORS.success,
        })
        .setOrigin(0, 0.5)
    }

    this.add
      .text(62, top + 50, t(plan.descriptionKey), {
        fontSize: '11px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
        wordWrap: { width: 250 },
      })
      .setOrigin(0, 0.5)

    // A timeout is neither a win nor a loss, and saying "you would lose" about
    // a fight that simply never ends would be the wrong advice.
    const stalemate = outlook.outcome === 'timeout'
    const forecast = stalemate ? t('plan.forecastStalemate') : t(FORECAST_LABEL_KEYS[outlook.tier])
    // Turns matter as much as health: when every plan wins comfortably, speed
    // is the only thing separating them, and it is what BEST is chosen on.
    const detail = outlook.willWin
      ? `${forecast}  ·  ${t('plan.hpLeft', { hp: Math.round(outlook.hpRemaining * 100) })}  ·  ${t('plan.turns', {
          turns: outlook.turns,
        })}`
      : forecast
    this.add
      .text(62, top + 78, detail, {
        fontSize: '12px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: stalemate ? COLORS.textDim : TIER_COLOR[outlook.tier],
      })
      .setOrigin(0, 0.5)

    makeButton(this, 372, y, t('plan.begin'), () => this.commit(id), {
      variant: recommended ? 'primary' : 'secondary',
      minWidth: 108,
      fontSize: '14px',
      minHeight: 52,
    })
  }

  /** Picking a plan both arms this fight and becomes the saved default. */
  private commit(plan: PlanId): void {
    const player = GameState.player!
    GameState.selectedPlan = plan
    if (player.settings.battlePlan !== plan) {
      const next = { ...player, settings: { ...player.settings, battlePlan: plan } }
      GameState.player = next
      void persist(next, GameState.userId).then((stamped) => {
        GameState.player = stamped
      })
    }
    this.scene.start('Battle')
  }
}
