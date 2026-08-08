import Phaser from 'phaser'
import { GAME_H, GAME_W, setupScene } from '../config/layout'
import { GameState } from '../state/GameState'
import { persist } from '../services/saveService'
import { APPLY_CONFIRMATION, createTestState, toSavePayload, updateTestPlayer } from '../admin/AdminTestState'
import { ADMIN_PRESETS } from '../admin/presets'
import { recordAdminAction } from '../admin/adminAudit'
import { DIFFICULTY_IDS } from '../data/difficulties'
import { RACE_IDS, raceOf, heroTexture } from '../data/races'
import { STAGES, STAGES_PER_WORLD, worldOfOrder } from '../data/stages'
import { WORLDS } from '../data/worlds'
import { parsePlayerState } from '../state/validate'
import { makeDom } from '../ui/components/makeDom'
import { effectiveStats } from '../systems/upgrades'
import EMOJI_ASSETS from '../data/emojiAssets.json'
import {
  ADMIN_COLORS,
  adminBackdrop,
  adminBadge,
  adminButton,
  adminChoices,
  adminStepper,
  adminText,
  adminToggle,
} from '../ui/admin/adminKit'
import type { RaceId } from '../data/races'
import type { DifficultyId } from '../data/difficulties'
import type { PlayerState } from '../types'

type Tab = 'player' | 'progress' | 'save' | 'assets'

const TABS: Tab[] = ['player', 'progress', 'save', 'assets']
const TAB_LABELS: Record<Tab, string> = {
  player: 'Player',
  progress: 'Progress',
  save: 'Save',
  assets: 'Assets',
}

interface AdminSceneData {
  tab?: Tab
  notice?: string
}

/**
 * The Test Lab hub.
 *
 * Every control edits `GameState.adminTest`, which is a clone — nothing on this
 * screen can reach the real save except the Apply button, which asks first and
 * routes through the save validator on the way out.
 */
export class AdminScene extends Phaser.Scene {
  private tab: Tab = 'player'
  private notice = ''
  private importInput?: HTMLTextAreaElement

  constructor() {
    super('Admin')
  }

  init(data: AdminSceneData): void {
    this.tab = data.tab ?? 'player'
    this.notice = data.notice ?? ''
  }

  create(): void {
    setupScene(this)
    adminBackdrop(this, GAME_H)

    // Opening the lab with nothing loaded would have nothing to clone.
    GameState.adminTest ??= createTestState(GameState.player!)

    adminText(this, GAME_W / 2, 26, 'ADMIN TEST LAB', { size: 17, bold: true, origin: 0.5, color: ADMIN_COLORS.accent })
    adminText(this, GAME_W / 2, 44, this.grantLabel(), { size: 10, origin: 0.5, color: ADMIN_COLORS.textDim })
    adminBadge(this, 68, 'edits here never touch your save')

    adminChoices(this, 100, '', TABS, this.tab, (tab) => this.scene.restart({ tab }), (tab) => TAB_LABELS[tab])

    if (this.tab === 'player') this.renderPlayerTab()
    else if (this.tab === 'progress') this.renderProgressTab()
    else if (this.tab === 'save') this.renderSaveTab()
    else this.renderAssetsTab()

    if (this.notice) {
      adminText(this, GAME_W / 2, GAME_H - 96, this.notice, {
        size: 11,
        origin: 0.5,
        color: ADMIN_COLORS.ok,
        wrap: 420,
      })
    }

    adminButton(this, 84, GAME_H - 40, 'Battle Lab', () => this.scene.start('BattleLab'), { width: 120, height: 34 })
    adminButton(this, 226, GAME_H - 40, 'Apply to Save', () => void this.applyToSave(), {
      width: 140,
      height: 34,
      tone: 'danger',
    })
    adminButton(this, 386, GAME_H - 40, 'Exit', () => this.exit(), { width: 96, height: 34 })

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.importInput = undefined
    })
  }

  private grantLabel(): string {
    const grant = GameState.adminGrant
    if (grant.kind === 'dev') return 'dev build · VITE_ENABLE_DEV_ADMIN'
    if (grant.kind === 'role') return `role: admin · ${grant.userId.slice(0, 8)}…`
    return 'no grant'
  }

  private get test() {
    return GameState.adminTest!
  }

  private patch(patch: Partial<PlayerState>): void {
    GameState.adminTest = updateTestPlayer(this.test, patch)
  }

  // ---- Player ----

  private renderPlayerTab(): void {
    const player = this.test.player
    const stats = effectiveStats(player)
    const race = raceOf(player.raceId)

    this.add.image(48, 148, heroTexture(player)).setDisplaySize(44, 44)
    adminText(this, 82, 138, `${player.name} · Lv ${player.level} · ${race.id}`, { size: 13, bold: true })
    adminText(this, 82, 158, `HP ${stats.maxHp}   ATK ${stats.atk}   DEF ${stats.def}`, {
      size: 12,
      color: ADMIN_COLORS.accent,
    })

    adminChoices(this, 190, 'Race', RACE_IDS, player.raceId, (raceId: RaceId) =>
      this.rerender({ raceId, appearanceId: raceOf(raceId).appearances[0] }),
    )
    adminChoices(
      this,
      222,
      'Look',
      race.appearances,
      player.appearanceId,
      (appearanceId) => this.rerender({ appearanceId }),
    )

    adminStepper(this, 258, 'Level', () => this.test.player.level, (level) => this.patch({ level }), {
      step: 1,
      bigStep: 10,
      min: 1,
      max: 500,
    })
    adminStepper(this, 292, 'EXP', () => this.test.player.exp, (exp) => this.patch({ exp }), {
      step: 100,
      bigStep: 5000,
    })
    adminStepper(this, 326, 'Gold', () => this.test.player.gold, (gold) => this.patch({ gold }), {
      step: 500,
      bigStep: 10000,
    })

    for (const [i, key] of (['hp', 'atk', 'def'] as const).entries()) {
      adminStepper(
        this,
        366 + i * 32,
        `Treats · ${key.toUpperCase()}`,
        () => this.test.player.upgrades[key],
        (value) => this.patch({ upgrades: { ...this.test.player.upgrades, [key]: value } }),
        { step: 1, bigStep: 10, min: 0, max: 999 },
      )
    }

    adminText(this, 22, 476, 'Presets', { bold: true, size: 12, color: ADMIN_COLORS.textDim })
    ADMIN_PRESETS.forEach((preset, i) => {
      const col = i % 3
      const row = Math.floor(i / 3)
      adminButton(
        this,
        84 + col * 152,
        502 + row * 34,
        preset.label,
        () => {
          GameState.adminTest = { ...this.test, player: preset.apply(this.test.player) }
          this.scene.restart({ tab: 'player', notice: `Preset applied: ${preset.description}` })
        },
        { width: 146, height: 28, size: 11 },
      )
    })
  }

  /** Level/race edits change derived stats, so the whole tab has to redraw. */
  private rerender(patch: Partial<PlayerState>): void {
    this.patch(patch)
    this.scene.restart({ tab: this.tab })
  }

  // ---- Progress ----

  private renderProgressTab(): void {
    const progress = this.test.player.stageProgress
    const world = worldOfOrder(progress.highestUnlocked)

    adminText(this, 22, 140, `Unlocked to stage ${progress.highestUnlocked} · World ${world}/${WORLDS.length}`, {
      size: 13,
      bold: true,
    })
    adminText(this, 22, 160, `${progress.completedStageIds.length} / ${STAGES.length} stages cleared`, {
      size: 11,
      color: ADMIN_COLORS.textDim,
    })

    adminStepper(
      this,
      196,
      'Jump to stage',
      () => this.test.player.stageProgress.highestUnlocked,
      (highestUnlocked) => this.setProgress(highestUnlocked, this.completedUpTo(highestUnlocked)),
      { step: 1, bigStep: STAGES_PER_WORLD, min: 1, max: STAGES.length },
    )

    adminChoices(
      this,
      236,
      'Difficulty',
      DIFFICULTY_IDS,
      this.test.difficulty,
      (difficulty: DifficultyId) => {
        GameState.adminTest = { ...this.test, difficulty }
        this.scene.restart({ tab: 'progress' })
      },
    )

    const actions: [string, () => void][] = [
      ['Unlock all', () => this.setProgress(STAGES.length, progress.completedStageIds)],
      ['Complete all', () => this.setProgress(STAGES.length, STAGES.map((s) => s.id))],
      ['Clear this world', () => this.clearWorld(world)],
      ['Reset world', () => this.resetWorld(world)],
      ['Bosses cleared', () => this.markBosses()],
      ['Reset campaign', () => void this.resetCampaign()],
    ]
    actions.forEach(([label, run], i) => {
      adminButton(this, 84 + (i % 3) * 152, 292 + Math.floor(i / 3) * 36, label, run, {
        width: 146,
        height: 30,
        size: 11,
        tone: label.startsWith('Reset') ? 'danger' : 'default',
      })
    })

    adminToggle(this, 386, 'Invincible (sim only)', () => this.test.invincible, (invincible) => {
      GameState.adminTest = { ...this.test, invincible }
    })
    adminStepper(
      this,
      420,
      'Damage ×',
      () => Math.round(this.test.damageMultiplier * 10),
      (tenths) => {
        GameState.adminTest = { ...this.test, damageMultiplier: tenths / 10 }
      },
      { step: 1, bigStep: 10, min: 1, max: 100, format: (n) => `${(n / 10).toFixed(1)}×` },
    )

    adminText(this, 22, 462, 'World summary', { bold: true, size: 12, color: ADMIN_COLORS.textDim })
    WORLDS.slice(0, 12).forEach((w, i) => {
      const cleared = w.stages.filter((s) => progress.completedStageIds.includes(s.id)).length
      const done = cleared === w.stages.length
      adminText(
        this,
        24 + (i % 4) * 116,
        486 + Math.floor(i / 4) * 22,
        `W${w.index} ${cleared}/${w.stages.length}`,
        { size: 11, color: done ? ADMIN_COLORS.ok : ADMIN_COLORS.textDim },
      )
    })
  }

  private completedUpTo(order: number): string[] {
    return STAGES.slice(0, Math.max(0, order - 1)).map((stage) => stage.id)
  }

  private setProgress(highestUnlocked: number, completedStageIds: string[]): void {
    this.patch({ stageProgress: { highestUnlocked, completedStageIds: [...new Set(completedStageIds)] } })
    this.scene.restart({ tab: 'progress' })
  }

  private clearWorld(index: number): void {
    const world = WORLDS[index - 1]
    const ids = [...this.test.player.stageProgress.completedStageIds, ...world.stages.map((s) => s.id)]
    const next = Math.min(STAGES.length, world.stages[world.stages.length - 1].order + 1)
    this.setProgress(Math.max(next, this.test.player.stageProgress.highestUnlocked), ids)
  }

  private resetWorld(index: number): void {
    const world = WORLDS[index - 1]
    const drop = new Set(world.stages.map((s) => s.id))
    this.setProgress(
      world.stages[0].order,
      this.test.player.stageProgress.completedStageIds.filter((id) => !drop.has(id)),
    )
  }

  private markBosses(): void {
    const ids = [...this.test.player.stageProgress.completedStageIds, ...WORLDS.map((w) => w.boss.id)]
    this.setProgress(this.test.player.stageProgress.highestUnlocked, ids)
  }

  private async resetCampaign(): Promise<void> {
    const previousHighest = this.test.player.stageProgress.highestUnlocked
    this.setProgress(1, [])
    await recordAdminAction(GameState.adminGrant, 'reset-campaign', { previousHighest })
  }

  // ---- Save ----

  private renderSaveTab(): void {
    const json = JSON.stringify(this.test.player)
    adminText(this, 22, 140, `Test state · schema v${this.test.player.schemaVersion} · ${json.length} bytes`, {
      size: 12,
      bold: true,
    })
    adminText(this, 22, 160, `Live save revision ${GameState.player!.revision} (untouched)`, {
      size: 11,
      color: ADMIN_COLORS.textDim,
    })

    adminButton(this, 84, 200, 'Export JSON', () => void this.exportJson(json), { width: 130, height: 30, size: 11 })
    adminButton(this, 226, 200, 'Validate', () => this.validate(), { width: 130, height: 30, size: 11 })
    adminButton(this, 368, 200, 'Reload save', () => this.reloadFromSave(), { width: 130, height: 30, size: 11 })

    adminText(this, 22, 240, 'Paste a save to import into the test state:', {
      size: 11,
      color: ADMIN_COLORS.textDim,
    })
    // Wrapped in a sized div on purpose: Phaser centres the *wrapper*, and a
    // bare element gives it nothing to measure, so the textarea lands off to
    // one side and runs off the canvas.
    const style =
      'width:100%;height:150px;padding:8px;font-size:10px;font-family:monospace;border-radius:8px;border:1px solid #6b5a80;background:#241e2c;color:#f2ecf7;outline:none;resize:none;box-sizing:border-box'
    const dom = makeDom(
      this,
      GAME_W / 2,
      340,
      `<div style="width:360px"><textarea id="admin-import" placeholder="{ ... }" style="${style}"></textarea></div>`,
    )
    this.importInput = dom.getChildByID('admin-import') as HTMLTextAreaElement

    adminButton(this, 120, 442, 'Import to test', () => void this.importJson(), { width: 180, height: 32 })
    adminButton(this, 320, 442, 'Clear', () => {
      if (this.importInput) this.importInput.value = ''
    }, { width: 120, height: 32 })

    adminText(this, 22, 486, 'Conflict and offline drills', { bold: true, size: 12, color: ADMIN_COLORS.textDim })
    adminText(
      this,
      22,
      510,
      'Import a copy, bump its revision above the live one, then Apply — the next\nsign-in on another device sees the fork the conflict screen is built for.',
      { size: 10, color: ADMIN_COLORS.textDim, wrap: 436 },
    )
  }

  private async exportJson(json: string): Promise<void> {
    // The console copy is the one that always works; the clipboard needs a
    // permission that a headless or embedded context may not grant.
    console.info('[admin] test state', json)
    try {
      await navigator.clipboard?.writeText(json)
      this.scene.restart({ tab: 'save', notice: 'Copied to clipboard (also logged to console)' })
    } catch {
      this.scene.restart({ tab: 'save', notice: 'Logged to console — clipboard was unavailable' })
    }
  }

  private validate(): void {
    const parsed = parsePlayerState(this.test.player)
    const same = parsed !== null && JSON.stringify(parsed) === JSON.stringify(this.test.player)
    this.scene.restart({
      tab: 'save',
      notice:
        parsed === null
          ? 'REJECTED — this state would not load'
          : same
            ? 'Valid, and unchanged by validation'
            : 'Valid, but validation would rewrite some fields (see console)',
    })
    if (parsed && !same) console.info('[admin] after validation', parsed)
  }

  private reloadFromSave(): void {
    GameState.adminTest = createTestState(GameState.player!)
    this.scene.restart({ tab: 'save', notice: 'Test state reset from the live save' })
  }

  private async importJson(): Promise<void> {
    const raw = this.importInput?.value?.trim()
    if (!raw) {
      this.scene.restart({ tab: 'save', notice: 'Nothing to import' })
      return
    }
    let parsed: PlayerState | null = null
    try {
      parsed = parsePlayerState(JSON.parse(raw))
    } catch {
      parsed = null
    }
    await recordAdminAction(GameState.adminGrant, 'import-save', {
      accepted: parsed !== null,
      schemaVersion: parsed?.schemaVersion ?? 0,
    })
    if (!parsed) {
      this.scene.restart({ tab: 'save', notice: 'REJECTED — not a loadable save' })
      return
    }
    GameState.adminTest = { ...this.test, player: parsed }
    this.scene.restart({ tab: 'save', notice: `Imported into the test state (Lv ${parsed.level})` })
  }

  // ---- Assets ----

  private renderAssetsTab(): void {
    const keys = Object.keys(EMOJI_ASSETS)
    const missing = keys.filter((key) => !this.textures.exists(key))
    adminText(this, 22, 140, `${keys.length} manifest keys · ${missing.length} missing`, {
      size: 13,
      bold: true,
      color: missing.length === 0 ? ADMIN_COLORS.ok : ADMIN_COLORS.danger,
    })
    if (missing.length > 0) {
      adminText(this, 22, 162, missing.slice(0, 6).join(', '), {
        size: 10,
        color: ADMIN_COLORS.danger,
        wrap: 436,
      })
    }

    adminText(this, 22, 192, 'Hero sprites', { size: 12, bold: true, color: ADMIN_COLORS.textDim })
    RACE_IDS.forEach((raceId, i) => {
      const race = raceOf(raceId)
      race.appearances.forEach((appearance, j) => {
        const key = `race_${raceId}_${appearance}`
        const x = 44 + i * 72
        const y = 222 + j * 52
        if (this.textures.exists(key)) this.add.image(x, y, key).setDisplaySize(36, 36)
        else adminText(this, x, y, '?', { size: 20, origin: 0.5, color: ADMIN_COLORS.danger })
      })
      adminText(this, 44 + i * 72, 296, raceId, { size: 9, origin: 0.5, color: ADMIN_COLORS.textDim })
    })

    adminText(this, 22, 324, 'Enemy sprites (first world of each)', {
      size: 12,
      bold: true,
      color: ADMIN_COLORS.textDim,
    })
    WORLDS.slice(0, 12).forEach((world, i) => {
      const key = world.stages[0].enemy.sprite
      const x = 40 + (i % 6) * 74
      const y = 354 + Math.floor(i / 6) * 46
      if (this.textures.exists(key)) this.add.image(x, y, key).setDisplaySize(30, 30)
      else adminText(this, x, y, '?', { size: 18, origin: 0.5, color: ADMIN_COLORS.danger })
      adminText(this, x, y + 22, `W${world.index}`, { size: 9, origin: 0.5, color: ADMIN_COLORS.textDim })
    })

    // Perf readout. Sampled on a timer rather than every frame so the overlay
    // cannot become the thing that makes the numbers worse.
    const perf = adminText(this, 22, 456, '', { size: 11, color: ADMIN_COLORS.accent })
    const sample = () => {
      const scenes = this.scene.manager.getScenes(true)
      const objects = scenes.reduce((n, s) => n + s.children.list.length, 0)
      const tweens = scenes.reduce((n, s) => n + s.tweens.getTweens().length, 0)
      perf.setText(
        `FPS ${Math.round(this.game.loop.actualFps)}  ·  objects ${objects}  ·  tweens ${tweens}  ·  textures ${
          this.textures.getTextureKeys().length
        }  ·  active scenes ${scenes.length}`,
      )
    }
    sample()
    const timer = this.time.addEvent({ delay: 500, loop: true, callback: sample })
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => timer.destroy())

    adminText(this, 22, 484, 'Licences: every sprite is Noto Color Emoji (OFL 1.1).', {
      size: 10,
      color: ADMIN_COLORS.textDim,
    })
    adminText(this, 22, 502, 'Full manifest: public/assets/THIRD_PARTY_ASSETS.md', {
      size: 10,
      color: ADMIN_COLORS.textDim,
    })
  }

  // ---- Leaving ----

  /**
   * The only path out of the lab and into real data. Two taps, because the
   * first one is easy to hit by accident and the second says what it will do.
   */
  private async applyToSave(): Promise<void> {
    const payload = toSavePayload(this.test, APPLY_CONFIRMATION)
    if (!payload) {
      this.scene.restart({ tab: this.tab, notice: 'Apply refused — the test state would not validate' })
      return
    }
    const confirmed = await this.confirm(
      'Overwrite your real save?',
      `Lv ${payload.level} · ${payload.gold} gold · unlocked to stage ${payload.stageProgress.highestUnlocked}`,
    )
    if (!confirmed) return

    GameState.player = payload
    const stamped = await persist(payload, GameState.userId)
    GameState.player = stamped
    await recordAdminAction(GameState.adminGrant, 'apply-to-save', {
      level: payload.level,
      highestUnlocked: payload.stageProgress.highestUnlocked,
      gold: payload.gold,
      raceId: payload.raceId,
    })
    this.scene.restart({ tab: this.tab, notice: `Applied. Save is now revision ${stamped.revision}.` })
  }

  private confirm(title: string, detail: string): Promise<boolean> {
    return new Promise((resolve) => {
      const veil = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.7).setDepth(50)
      const g = this.add.graphics().setDepth(51)
      g.fillStyle(ADMIN_COLORS.panel, 1).fillRoundedRect(50, 280, 380, 170, 12)
      g.lineStyle(2, 0xff8fab, 1).strokeRoundedRect(50, 280, 380, 170, 12)
      const heading = adminText(this, GAME_W / 2, 316, title, { size: 15, bold: true, origin: 0.5 }).setDepth(52)
      const body = adminText(this, GAME_W / 2, 352, detail, {
        size: 11,
        origin: 0.5,
        color: ADMIN_COLORS.textDim,
        wrap: 330,
      }).setDepth(52)
      const warn = adminText(this, GAME_W / 2, 384, 'This cannot be undone from here.', {
        size: 10,
        origin: 0.5,
        color: ADMIN_COLORS.danger,
      }).setDepth(52)

      const close = (answer: boolean) => {
        ;[veil, g, heading, body, warn, no, yes].forEach((o) => o.destroy())
        resolve(answer)
      }
      const no = adminButton(this, 160, 420, 'Cancel', () => close(false), { width: 120, height: 32 }).setDepth(52)
      const yes = adminButton(this, 320, 420, 'Overwrite', () => close(true), {
        width: 120,
        height: 32,
        tone: 'danger',
      }).setDepth(52)
    })
  }

  /** Leaving drops the scratch copy; the save was never involved. */
  private exit(): void {
    GameState.adminTest = null
    this.scene.start('MainMenu')
  }
}
