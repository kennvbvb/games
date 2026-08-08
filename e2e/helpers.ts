import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export const GUEST_KEY = 'incremental-rpg-save-v2:guest'
export const QUARANTINE_KEY = 'incremental-rpg-save-v2:quarantine'
export const userKey = (id: string) => `incremental-rpg-save-v2:user:${id}`

/** Logical design space; scenes lay out against this regardless of viewport. */
const GAME_W = 480
const GAME_H = 720

export interface SaveOverrides {
  [key: string]: unknown
}

/** A mid-game save in the current schema, overridable per test. */
export function makeSave(over: SaveOverrides = {}): string {
  return JSON.stringify({
    schemaVersion: 19,
    revision: 1,
    syncedRevision: 1,
    updatedAt: new Date().toISOString(),
    name: 'Tester',
    avatar: 'fox',
    raceId: 'human',
    appearanceId: 'a',
    level: 12,
    exp: 0,
    gold: 800,
    stats: { maxHp: 182, atk: 43, def: 15 },
    upgrades: { hp: 0, atk: 0, def: 0 },
    ownedItemIds: [],
    equipped: { weapon: null, head: null, body: null, boots: null, accessory1: null, accessory2: null },
    unlockedSkillIds: [],
    loadout: [],
    equippedRelicId: null,
    tower: { bestFloor: 0 },
    rift: { clearedWeek: -1 },
    ascension: { count: 0 },
    equipmentMastery: {},
    contracts: { week: Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)), counts: [], unclaimed: [] },
    stageProgress: { highestUnlocked: 6, completedStageIds: ['stage-1'] },
    settings: {
      battleSpeed: 4,
      skipCleared: false,
      autoRepeat: false,
      autoAdvance: false,
      reducedMotion: true,
      locale: 'en',
      analytics: false,
      battlePlan: 'brave',
      difficulty: 'normal',
    },
    idle: { farmingStageId: null, lastSeenAt: Date.now() },
    // Default past the tutorial so tips don't cover the buttons a test taps.
    tutorialStep: 3,
    lifetime: { battlesWon: 0, goldEarned: 0 },
    claimedAchievementIds: [],
    ...over,
  })
}

/**
 * Scene content lives inside a canvas, so taps are expressed in the game's
 * logical coordinates and mapped onto wherever Scale.FIT put the canvas.
 */
export class GamePage {
  constructor(private readonly page: Page) {}

  async open(save?: string): Promise<void> {
    await this.page.goto('/')
    if (save) {
      await this.page.evaluate(
        ([key, value]) => localStorage.setItem(key, value),
        [GUEST_KEY, save] as const,
      )
      await this.page.reload()
    }
    await this.page.waitForSelector('canvas')
    await this.settle()
  }

  /** Waits out the preloader and any scene transition. */
  async settle(ms = 900): Promise<void> {
    await this.page.waitForTimeout(ms)
  }

  async continueAsGuest(): Promise<void> {
    await this.page.locator('#guest').click()
    await this.settle()
  }

  async tap(x: number, y: number): Promise<void> {
    const box = await this.page.locator('canvas').first().boundingBox()
    if (!box) throw new Error('game canvas not found')
    await this.page.mouse.click(box.x + (x / GAME_W) * box.width, box.y + (y / GAME_H) * box.height)
    await this.page.waitForTimeout(500)
  }

  /**
   * Commits a plan on Prepare Battle, which is what Fight/Farm now leads to.
   * Rows are Brave, Cozy, Clever top to bottom.
   */
  async pickPlan(row: 0 | 1 | 2 = 0): Promise<void> {
    await this.tap(372, [288, 400, 512][row])
  }

  /** CSS pixels per logical unit — how much Scale.FIT shrank the stage. */
  async scaleFactor(): Promise<number> {
    const box = await this.page.locator('canvas').first().boundingBox()
    if (!box) throw new Error('game canvas not found')
    return box.height / GAME_H
  }

  save(key = GUEST_KEY): Promise<Record<string, never> | null> {
    return this.page.evaluate((k) => {
      const raw = localStorage.getItem(k)
      return raw ? JSON.parse(raw) : null
    }, key)
  }

  setRaw(key: string, value: string): Promise<void> {
    return this.page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, value] as const)
  }

  localStorageKeys(): Promise<string[]> {
    return this.page.evaluate(() => Object.keys(localStorage).sort())
  }

  /** True once a save exists — the reliable signal that a scene committed state. */
  async expectSaved(): Promise<void> {
    await expect.poll(async () => (await this.save()) !== null, { timeout: 10_000 }).toBe(true)
  }
}
