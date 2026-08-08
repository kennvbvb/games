import Phaser from 'phaser'
import { GAME_W, setupScene } from '../config/layout'
import { STAGES, isBossStage } from '../data/stages'
import { isTowerStageId, towerFloor } from '../data/tower'
import { isRiftStageId } from '../data/rifts'
import { recordRiftCleared, riftAvailable } from '../systems/rift'
import { TOWER_RERUN_PAYOUT, grantFloorRelic, recordFloorCleared } from '../systems/tower'
import { recordFightWon } from '../systems/equipmentMastery'
import { recordEvent } from '../services/analytics'
import { GameState } from '../state/GameState'
import { applyRewards } from '../systems/rewards'
import { persist } from '../services/saveService'
import { makeButton } from '../ui/components/makeButton'
import { makePanel } from '../ui/components/makePanel'
import { makeEmoji } from '../ui/components/makeEmoji'
import { makeStatRow } from '../ui/components/makeStatRow'
import { advanceTutorial, makeTutorialTip } from '../ui/components/makeTutorialTip'
import { drawStageScenery } from '../ui/scenery'
import { ambientTween } from '../ui/motion'
import { COLORS, FONT } from '../ui/styles'
import type { PlayerState, StageConfig } from '../types'
import { LOSS_REASON_KEYS, diagnoseLoss } from '../admin/battleLab'
import { enemyFor } from '../data/difficulties'
import { activeDifficulty } from '../systems/campaignModes'
import { recommendPlan } from '../systems/difficulty'
import { PLAN_BY_ID } from '../data/battlePlans'
import { t } from '../i18n'

/** How long the result screen lingers before the next queued auto-battle. */
const AUTO_ADVANCE_MS = 900

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result')
  }

  create(): void {
    setupScene(this)
    const result = GameState.lastBattleResult!
    const stage = GameState.selectedStage!
    const prevLevel = GameState.player!.level

    const inTower = isTowerStageId(stage.id)
    const inRift = isRiftStageId(stage.id)
    // Read before the win is recorded: once the week is marked cleared the
    // answer flips, and a rift beaten twice in a week would pay twice.
    const riftPays = inRift && riftAvailable(GameState.player!)
    // Also read before the record moves: a floor already beaten pays a quarter.
    // Re-running the tower has to stay *worth something* — it is where a stuck
    // player farms — without being a better gold rate than the floor they
    // cannot beat yet, which is what a full payout on floor 1 would be.
    const towerRerun = inTower && stage.order <= GameState.player!.tower.bestFloor

    // A rift already cleared this week still counts as a battle won — it just
    // does not pay. Zeroing the payout rather than skipping `applyRewards`
    // outright keeps the lifetime tally (and the achievements built on it)
    // honest about a fight that really did happen.
    const payout =
      inRift && !riftPays
        ? { exp: 0, gold: 0 }
        : towerRerun
          ? {
              exp: Math.round(result.rewards.exp * TOWER_RERUN_PAYOUT),
              gold: Math.round(result.rewards.gold * TOWER_RERUN_PAYOUT),
            }
          : result.rewards
    let player = applyRewards(GameState.player!, { ...result, rewards: payout })
    // A tower floor is not campaign progress. Its id is outside the `stage-`
    // namespace, so recording it as a cleared stage would be dropped by the
    // validator on the next load, and setting it as the farming target would
    // silently switch offline rewards off. The climb has its own record.
    // Worn gear earns its mastery from the fight that just happened, whichever
    // mode it was — the tower and the rift both scale to the player, so neither
    // can be farmed for it. Credited before the win is recorded so that
    // clearing a *new* stage is measured against the frontier the player was
    // standing on when they fought it, not the one they just moved to.
    if (result.win) player = recordFightWon(player, stage)

    if (result.win && inTower) {
      // The relic before the record: `grantFloorRelic` is idempotent, but
      // reading "first clear" off a record that has already moved would be a
      // trap waiting for the next person to add a first-clear reward.
      player = grantFloorRelic(player, stage.order)
      player = recordFloorCleared(player, stage.order)
    } else if (result.win && inRift) {
      player = recordRiftCleared(player)
    } else if (result.win) {
      const nextUnlock = Math.max(player.stageProgress.highestUnlocked, stage.order + 1)
      const completedStageIds = player.stageProgress.completedStageIds.includes(stage.id)
        ? player.stageProgress.completedStageIds
        : [...player.stageProgress.completedStageIds, stage.id]
      player = {
        ...player,
        stageProgress: { highestUnlocked: Math.min(nextUnlock, STAGES.length), completedStageIds },
        // Farming this stage is what the hero keeps doing while away.
        idle: { ...player.idle, farmingStageId: stage.id },
      }
    }
    recordEvent({
      name: 'stage_attempt',
      stage: stage.order,
      boss: isBossStage(stage),
      win: result.win,
      turns: result.log.length > 0 ? result.log[result.log.length - 1].turn : 0,
      plan: GameState.selectedPlan ?? player.settings.battlePlan,
    })

    GameState.player = player
    void persist(player, GameState.userId).then((stamped) => {
      GameState.player = stamped
    })

    // A loss always breaks the auto-battle loop — that is the stop condition.
    if (!result.win) GameState.stopAutoBattle()
    if (result.win) advanceTutorial(2)

    const nextStage = inRift
      ? null
      : inTower
        ? towerFloor(stage.order + 1)
        : (STAGES.find((s) => s.order === stage.order + 1) ?? null)
    // In the tower the next floor is only ever offered after a win, which is
    // exactly the rule `canAttempt` enforces — one past the deepest beaten.
    const nextUnlocked = inRift
      ? false
      : inTower
        ? result.win
        : nextStage !== null && nextStage.order <= player.stageProgress.highestUnlocked

    drawStageScenery(this, stage.bg, stage.order, { horizon: 470 })
    this.renderOutcome(result.win, player, prevLevel, stage)

    if (GameState.autoRunsRemaining > 0) {
      this.runAutoBattle(player, stage, nextStage, nextUnlocked)
      return
    }
    this.renderActions(result.win, stage, nextStage, nextUnlocked, inTower, inRift)
  }

  private renderOutcome(win: boolean, player: PlayerState, prevLevel: number, stage: StageConfig): void {
    const result = GameState.lastBattleResult!
    const banner = makeEmoji(this, GAME_W / 2, 120, win ? 'icon_victory' : 'icon_defeat', 76)
    this.tweens.add({
      targets: banner,
      scale: { from: banner.scale * 0.4, to: banner.scale },
      duration: 400,
      ease: 'Back.Out',
    })

    makePanel(this, GAME_W / 2, 202, 300, 54)
    this.add
      .text(GAME_W / 2, 202, win ? t('result.victory') : t('result.defeat'), {
        fontSize: '30px',
        fontFamily: FONT.family,
        fontStyle: 'bold',
        color: win ? COLORS.success : COLORS.danger,
      })
      .setOrigin(0.5)

    makePanel(this, GAME_W / 2, 292, 360, 104)
    if (win) {
      makeStatRow(
        this,
        GAME_W / 2 - 96,
        274,
        [
          { icon: 'icon_exp', value: `+${result.rewards.exp} EXP` },
          { icon: 'icon_gold', value: `+${result.rewards.gold}` },
        ],
        { fontSize: '17px', iconSize: 19, gap: 22 },
      )
      if (player.level > prevLevel) {
        const levelUp = this.add
          .text(GAME_W / 2 + 12, 314, t('result.levelUp', { from: prevLevel, to: player.level }), {
            fontSize: '16px',
            fontFamily: FONT.family,
            fontStyle: 'bold',
            color: COLORS.success,
          })
          .setOrigin(0.5)
        makeEmoji(this, levelUp.x - levelUp.width / 2 - 12, 314, 'icon_levelup', 18)
        ambientTween(this, { targets: levelUp, scale: { from: 1, to: 1.08 }, duration: 500, yoyo: true, repeat: -1 })
      } else {
        this.add
          .text(GAME_W / 2, 314, t('result.nextWaiting'), {
            fontSize: '14px',
            fontFamily: FONT.family,
            color: COLORS.textDim,
          })
          .setOrigin(0.5)
      }
    } else {
      // A stalemate is not a defeat — telling the player to level up when the
      // real problem is that nobody can finish would be the wrong advice.
      const reason = diagnoseLoss(result, enemyFor(stage.enemy, activeDifficulty(player)).maxHp)
      this.add
        .text(
          GAME_W / 2,
          286,
          reason ? t(LOSS_REASON_KEYS[reason]) : t('result.noRewards'),
          {
            fontSize: '14px',
            fontFamily: FONT.family,
            color: COLORS.textDim,
            align: 'center',
            wordWrap: { width: 340 },
          },
        )
        .setOrigin(0.5)

      // "Get stronger" is advice the player can already guess. If a plan they
      // did not pick would have cleared it, that is the thing worth saying.
      const better = recommendPlan(player, stage)
      if (better && better.plan !== (GameState.selectedPlan ?? player.settings.battlePlan)) {
        this.add
          .text(GAME_W / 2, 320, t('loss.tryPlan', { plan: t(PLAN_BY_ID.get(better.plan)!.nameKey) }), {
            fontSize: '12px',
            fontFamily: FONT.family,
            fontStyle: 'bold',
            color: COLORS.gold,
            align: 'center',
            wordWrap: { width: 340 },
          })
          .setOrigin(0.5)
      }
    }
  }

  /** Chains straight into the next queued battle so farming needs no input. */
  private runAutoBattle(
    player: PlayerState,
    stage: StageConfig,
    nextStage: StageConfig | null,
    nextUnlocked: boolean,
  ): void {
    GameState.autoRunsRemaining -= 1
    GameState.autoRunCount += 1

    const advancing = player.settings.autoAdvance && nextStage !== null && nextUnlocked
    const target = advancing ? nextStage : stage

    this.add
      .text(GAME_W / 2, 376, t('result.autoLeft', { count: GameState.autoRunsRemaining }), {
        fontSize: '13px',
        fontFamily: FONT.family,
        color: COLORS.textDim,
      })
      .setOrigin(0.5)

    makeButton(
      this,
      GAME_W / 2,
      430,
      t('result.stopAuto'),
      () => {
        GameState.stopAutoBattle()
        this.scene.restart()
      },
      { variant: 'secondary', minWidth: 220, fontSize: '15px' },
    )

    this.time.delayedCall(AUTO_ADVANCE_MS / player.settings.battleSpeed, () => {
      if (GameState.autoRunsRemaining <= 0) return
      GameState.selectedStage = target
      this.scene.start('Battle')
    })
  }

  private renderActions(
    win: boolean,
    stage: StageConfig,
    nextStage: StageConfig | null,
    nextUnlocked: boolean,
    inTower: boolean,
    inRift: boolean,
  ): void {
    const startRun = (target: StageConfig, runs: number) => {
      GameState.selectedStage = target
      GameState.autoRunsRemaining = runs
      GameState.autoRunCount = 0
      this.scene.start('Battle')
    }

    if (win && nextStage && nextUnlocked) {
      makeButton(this, GAME_W / 2, 384, t('result.next', { stage: nextStage.name }), () => startRun(nextStage, 0), {
        minWidth: 280,
        icon: 'icon_atk',
        fontSize: '16px',
      })
      makeButton(this, GAME_W / 2, 452, t('result.farmTen'), () => startRun(stage, 10), {
        variant: 'secondary',
        minWidth: 280,
        fontSize: '15px',
      })
    } else if (win && inRift) {
      // No farm button here. The rift pays once a week, so ten runs of it would
      // be ten fights for nothing — offering it would read as a reward loop.
      makeButton(this, GAME_W / 2, 384, t('rift.again'), () => startRun(stage, 0), {
        minWidth: 280,
        fontSize: '16px',
        icon: 'decor_portal',
      })
      makeButton(this, GAME_W / 2, 452, t('rift.leave'), () => this.scene.start('Rift'), {
        variant: 'secondary',
        minWidth: 280,
        fontSize: '15px',
      })
    } else if (win) {
      // Final stage cleared, or the next one is still locked.
      makeButton(this, GAME_W / 2, 384, t('result.farmTen'), () => startRun(stage, 10), {
        minWidth: 280,
        fontSize: '16px',
      })
      makeButton(this, GAME_W / 2, 452, t('result.retry'), () => startRun(stage, 0), {
        variant: 'secondary',
        minWidth: 280,
        fontSize: '15px',
      })
    } else {
      makeButton(this, GAME_W / 2, 384, t('result.retry'), () => startRun(stage, 0), { minWidth: 280, fontSize: '16px' })
      makeButton(this, GAME_W / 2, 452, t('menu.shop'), () => this.scene.start('Shop'), {
        variant: 'secondary',
        minWidth: 280,
        fontSize: '15px',
        icon: 'icon_cart',
      })
    }

    makeButton(this, GAME_W / 2 - 92, 522, t('plan.change'), () => this.scene.start('PrepareBattle'), {
      variant: 'secondary',
      minWidth: 168,
      fontSize: '14px',
      minHeight: 50,
    })
    makeButton(
      this,
      GAME_W / 2 + 92,
      522,
      inRift ? t('rift.leave') : inTower ? t('tower.leave') : t('result.stageSelect'),
      () => this.scene.start(inRift ? 'Rift' : inTower ? 'Tower' : 'StageSelect'),
      { variant: 'secondary', minWidth: 168, fontSize: '14px', minHeight: 50 },
    )

    makeTutorialTip(this, 2, t('tutorial.step2'), 606)
  }
}
