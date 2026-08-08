import Phaser from 'phaser'
import { GAME_H, GAME_W, setupScene } from '../config/layout'
import { GameState } from '../state/GameState'
import { comparePlans, compareRaces, repeat, runLab, toCsv, LOSS_REASON_KEYS } from '../admin/battleLab'
import { BATTLE_PLANS, PLAN_IDS } from '../data/battlePlans'
import { DIFFICULTY_IDS } from '../data/difficulties'
import { RACE_IDS } from '../data/races'
import { STAGES, STAGE_BY_ID, isBossStage } from '../data/stages'
import { traitOf } from '../data/enemyTraits'
import { enemyFor } from '../data/difficulties'
import {
  ADMIN_COLORS,
  adminBackdrop,
  adminBadge,
  adminButton,
  adminChoices,
  adminStepper,
  adminText,
} from '../ui/admin/adminKit'
import type { LabMetrics } from '../admin/battleLab'
import type { DifficultyId } from '../data/difficulties'
import type { PlanId } from '../data/battlePlans'
import { t } from '../i18n'

type Mode = 'plans' | 'races' | 'single'

const MODES: Mode[] = ['plans', 'races', 'single']
const MODE_LABELS: Record<Mode, string> = { plans: 'Plans', races: 'Races', single: 'One fight' }

interface LabSceneData {
  mode?: Mode
  notice?: string
}

/**
 * Headless simulation, rendered as a table.
 *
 * Nothing here animates a fight: the point is to see fifty outcomes in the time
 * one animated battle would take. `resolveBattle` is the same function the
 * BattleScene plays back, so a row on this screen is a promise about the fight
 * the player would actually get.
 */
export class BattleLabScene extends Phaser.Scene {
  private mode: Mode = 'plans'
  private notice = ''

  constructor() {
    super('BattleLab')
  }

  init(data: LabSceneData): void {
    this.mode = data.mode ?? 'plans'
    this.notice = data.notice ?? ''
  }

  create(): void {
    setupScene(this)
    adminBackdrop(this, GAME_H)

    const test = GameState.adminTest!
    const stage = STAGE_BY_ID.get(test.selectedStageId) ?? STAGES[0]

    adminText(this, GAME_W / 2, 24, 'BATTLE SIMULATOR', {
      size: 16,
      bold: true,
      origin: 0.5,
      color: ADMIN_COLORS.accent,
    })
    adminBadge(this, 50, 'simulation only — no rewards are banked')

    this.renderStagePicker(stage)
    adminChoices(this, 214, '', MODES, this.mode, (mode) => this.scene.restart({ mode }), (m) => MODE_LABELS[m])

    if (this.mode === 'plans') this.renderPlans(stage)
    else if (this.mode === 'races') this.renderRaces(stage)
    else this.renderSingle(stage)

    if (this.notice) {
      adminText(this, GAME_W / 2, GAME_H - 76, this.notice, {
        size: 10,
        origin: 0.5,
        color: ADMIN_COLORS.ok,
        wrap: 440,
      })
    }

    adminButton(this, 88, GAME_H - 40, 'Back to lab', () => this.scene.start('Admin'), { width: 128, height: 34 })
    adminButton(this, 232, GAME_H - 40, 'Export CSV', () => void this.exportCsv(stage), { width: 128, height: 34 })
    adminButton(this, 384, GAME_H - 40, 'Determinism ×1000', () => this.checkDeterminism(stage), {
      width: 152,
      height: 34,
      size: 10,
    })
  }

  private get test() {
    return GameState.adminTest!
  }

  private renderStagePicker(stage: (typeof STAGES)[number]): void {
    const enemy = enemyFor(stage.enemy, this.test.difficulty)
    adminText(this, 22, 88, `${stage.order}. ${stage.name}${isBossStage(stage) ? '  [BOSS]' : ''}`, {
      size: 13,
      bold: true,
    })
    adminText(
      this,
      22,
      108,
      `${enemy.name} · HP ${enemy.maxHp} ATK ${enemy.atk} DEF ${enemy.def} · ${t(traitOf(enemy.trait).nameKey)}`,
      { size: 11, color: ADMIN_COLORS.textDim },
    )

    adminStepper(
      this,
      140,
      'Stage',
      () => (STAGE_BY_ID.get(this.test.selectedStageId) ?? STAGES[0]).order,
      (order) => {
        GameState.adminTest = { ...this.test, selectedStageId: STAGES[order - 1].id }
        this.scene.restart({ mode: this.mode })
      },
      { step: 1, bigStep: 5, min: 1, max: STAGES.length },
    )
    adminChoices(this, 178, 'Difficulty', DIFFICULTY_IDS, this.test.difficulty, (difficulty: DifficultyId) => {
      GameState.adminTest = { ...this.test, difficulty }
      this.scene.restart({ mode: this.mode })
    })
  }

  /** Header + rows, sized so the widest column (turns) never collides. */
  private renderTable(rows: [string, LabMetrics][], top: number): void {
    const cols = [26, 122, 190, 250, 320, 396]
    const headers = ['', 'result', 'turns', 'HP left', 'dealt/taken', 'exp/gold']
    headers.forEach((label, i) =>
      adminText(this, cols[i], top, label, { size: 10, color: ADMIN_COLORS.textDim, bold: true }),
    )

    rows.forEach(([label, m], i) => {
      const y = top + 24 + i * 30
      const won = m.win
      const colour = won ? ADMIN_COLORS.ok : m.outcome === 'timeout' ? ADMIN_COLORS.accent : ADMIN_COLORS.danger
      adminText(this, cols[0], y, label, { size: 12, bold: true })
      adminText(this, cols[1], y, won ? 'WIN' : m.outcome === 'timeout' ? 'STALL' : 'LOSS', {
        size: 11,
        bold: true,
        color: colour,
      })
      adminText(this, cols[2], y, String(m.turns), { size: 11 })
      adminText(this, cols[3], y, `${Math.round((m.playerHpLeft / m.playerMaxHp) * 100)}%`, { size: 11 })
      adminText(this, cols[4], y, `${m.damageDealt}/${m.damageTaken}`, { size: 11, color: ADMIN_COLORS.textDim })
      adminText(this, cols[5], y, `${m.exp}/${m.gold}`, { size: 11, color: ADMIN_COLORS.textDim })
      if (!won && m.lossReason) {
        adminText(this, cols[0], y + 13, t(LOSS_REASON_KEYS[m.lossReason]), {
          size: 9,
          color: ADMIN_COLORS.textDim,
          wrap: 430,
        })
      }
    })
  }

  private renderPlans(stage: (typeof STAGES)[number]): void {
    const results = comparePlans({ player: this.test.player, stage, difficulty: this.test.difficulty })
    this.renderTable(
      PLAN_IDS.map((id) => [t(BATTLE_PLANS.find((p) => p.id === id)!.nameKey), results[id]]),
      252,
    )
    this.renderSummary(Object.values(results), 400)
  }

  private renderRaces(stage: (typeof STAGES)[number]): void {
    const results = compareRaces({ player: this.test.player, stage, difficulty: this.test.difficulty })
    this.renderTable(
      RACE_IDS.map((id) => [id, results[id]]),
      252,
    )
    this.renderSummary(Object.values(results), 460)
  }

  private renderSingle(stage: (typeof STAGES)[number]): void {
    const plan: PlanId = this.test.player.settings.battlePlan
    const { result, metrics } = runLab({
      player: this.test.player,
      stage,
      plan,
      difficulty: this.test.difficulty,
    })
    this.renderTable([[t(BATTLE_PLANS.find((p) => p.id === plan)!.nameKey), metrics]], 252)

    adminText(this, 22, 320, 'First twelve events', { size: 11, bold: true, color: ADMIN_COLORS.textDim })
    result.log.slice(0, 12).forEach((event, i) => {
      const who = event.attacker === 'player' ? 'you' : 'foe'
      const what = event.dodged
        ? 'dodged'
        : `${event.damage} dmg → ${event.targetHpAfter} HP${event.crit ? ' (crit)' : ''}`
      const heal = event.healed ? `  +${event.healed} heal` : ''
      const announce = event.announce ? `  [${event.announce}]` : ''
      adminText(this, 26, 344 + i * 16, `t${event.turn} ${who}: ${what}${heal}${announce}`, {
        size: 10,
        color: event.attacker === 'player' ? ADMIN_COLORS.text : ADMIN_COLORS.textDim,
      })
    })
    if (result.log.length > 12) {
      adminText(this, 26, 344 + 12 * 16, `… ${result.log.length - 12} more`, {
        size: 10,
        color: ADMIN_COLORS.textDim,
      })
    }
  }

  private renderSummary(rows: LabMetrics[], y: number): void {
    const wins = rows.filter((m) => m.win).length
    adminText(this, 22, y, `${wins} of ${rows.length} clear this stage`, {
      size: 11,
      bold: true,
      color: wins === 0 ? ADMIN_COLORS.danger : wins === rows.length ? ADMIN_COLORS.ok : ADMIN_COLORS.accent,
    })
    if (wins === rows.length && rows.length > 1) {
      // Everything winning is as much a balance signal as nothing winning: the
      // choice this screen exists to compare is not being asked.
      adminText(this, 22, y + 16, 'Every option wins — this stage is not asking the player anything.', {
        size: 10,
        color: ADMIN_COLORS.textDim,
        wrap: 430,
      })
    }
  }

  private async exportCsv(stage: (typeof STAGES)[number]): Promise<void> {
    const run = { player: this.test.player, stage, difficulty: this.test.difficulty }
    const rows: Record<string, LabMetrics> =
      this.mode === 'races' ? compareRaces(run) : comparePlans(run)
    const csv = toCsv(rows)
    console.info(`[lab] ${stage.id} ${this.mode}\n${csv}`)
    try {
      await navigator.clipboard?.writeText(csv)
      this.scene.restart({ mode: this.mode, notice: 'CSV copied to clipboard (also on the console)' })
    } catch {
      this.scene.restart({ mode: this.mode, notice: 'CSV written to the console' })
    }
  }

  /**
   * The claim the whole preview rests on: same inputs, same fight. A thousand
   * runs collapsing to one distinct result is what makes `stageOutlook` a
   * simulation rather than an estimate.
   */
  private checkDeterminism(stage: (typeof STAGES)[number]): void {
    const started = performance.now()
    const { distinct } = repeat(
      {
        player: this.test.player,
        stage,
        plan: this.test.player.settings.battlePlan,
        difficulty: this.test.difficulty,
      },
      1000,
    )
    const ms = Math.round(performance.now() - started)
    this.scene.restart({
      mode: this.mode,
      notice:
        distinct === 1
          ? `1000 runs → 1 distinct result in ${ms}ms. Deterministic.`
          : `NOT DETERMINISTIC — ${distinct} distinct results from 1000 runs.`,
    })
  }
}
