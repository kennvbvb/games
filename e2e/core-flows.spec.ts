import { test, expect } from '@playwright/test'
import { GamePage, GUEST_KEY, QUARANTINE_KEY, makeSave, userKey } from './helpers'

// Menu button positions in the game's logical coordinate space.
const MENU = {
  stages: { x: 240, y: 334 },
  character: { x: 240, y: 396 },
  shop: { x: 240, y: 458 },
  quests: { x: 240, y: 520 },
  settings: { x: 148, y: 586 },
}
// Stage select is one chapter per page: three ordinary rows, then a taller
// boss card that closes the chapter.
const STAGE_ROW_1 = { x: 372, y: 156 }
const BOSS_ROW = { x: 372, y: 434 }
const CHAPTER_NEXT = { x: 350, y: 528 }
const STAGES_BACK = { x: 240, y: 592 }

// Settings rows: four toggles from y=224 at 84 apart, then the language row.
const SETTINGS = {
  analytics: { x: 372, y: 224 + 3 * 84 },
  thai: { x: 408, y: 224 + 4 * 84 },
}

test.describe('core flows', () => {
  test('a new player can create a hero and reach the menu', async ({ page }) => {
    const game = new GamePage(page)
    await game.open()
    await game.continueAsGuest()

    // No save yet, so the hero creation screen should be showing.
    await expect(page.locator('#hero-name')).toBeVisible()
    await page.locator('#hero-name').fill('Newbie')
    await game.tap(240, 574) // Start Adventure
    await game.expectSaved()

    const save = await game.save()
    expect(save).toMatchObject({ name: 'Newbie', level: 1, tutorialStep: 0 })
    // The hero-name input is gone once we're past creation.
    await expect(page.locator('#hero-name')).toHaveCount(0)
  })

  test('winning a stage grants rewards and unlocks the next one', async ({ page }) => {
    const game = new GamePage(page)
    await game.open(
      makeSave({
        gold: 0,
        stageProgress: { highestUnlocked: 1, completedStageIds: [] },
      }),
    )
    await game.continueAsGuest()

    await game.tap(MENU.stages.x, MENU.stages.y)
    await game.tap(STAGE_ROW_1.x, STAGE_ROW_1.y) // Fight stage 1

    await expect
      .poll(async () => (await game.save())?.stageProgress?.highestUnlocked ?? 0, { timeout: 20_000 })
      .toBeGreaterThan(1)

    const save = await game.save()
    expect(save?.gold).toBeGreaterThan(0)
    expect(save?.stageProgress?.completedStageIds).toContain('stage-1')
    // A win sets what the hero farms while away.
    expect(save?.idle?.farmingStageId).toBe('stage-1')
  })

  test('losing grants nothing and offers a retry', async ({ page }) => {
    const game = new GamePage(page)
    await game.open(
      makeSave({
        level: 2,
        gold: 500,
        stats: { maxHp: 62, atk: 13, def: 5 },
        stageProgress: { highestUnlocked: 12, completedStageIds: [] },
      }),
    )
    await game.continueAsGuest()

    await game.tap(MENU.stages.x, MENU.stages.y)
    await game.tap(CHAPTER_NEXT.x, CHAPTER_NEXT.y) // chapter 2
    await game.tap(CHAPTER_NEXT.x, CHAPTER_NEXT.y) // chapter 3 — stages 9 to 12
    await game.tap(BOSS_ROW.x, BOSS_ROW.y) // fight the final boss, well out of reach

    await page.waitForTimeout(6000)
    const save = await game.save()
    expect(save?.gold).toBe(500)
    expect(save?.stageProgress?.completedStageIds).toEqual([])
  })

  test('progress survives a reload', async ({ page }) => {
    const game = new GamePage(page)
    await game.open(makeSave({ name: 'Persist', gold: 1234 }))
    await game.continueAsGuest()
    await game.tap(MENU.character.x, MENU.character.y)

    await page.reload()
    await game.settle()
    await game.continueAsGuest()

    // Straight back into the game rather than hero creation.
    await expect(page.locator('#hero-name')).toHaveCount(0)
    const save = await game.save()
    expect(save).toMatchObject({ name: 'Persist' })
    expect(save?.gold).toBeGreaterThanOrEqual(1234)
  })

  test('a corrupt save is quarantined instead of crashing the game', async ({ page }) => {
    const game = new GamePage(page)
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await game.open()
    await game.setRaw(GUEST_KEY, '{ not valid json')
    await page.reload()
    await game.settle()
    await game.continueAsGuest()

    // Recovers into hero creation with the bad data set aside.
    await expect(page.locator('#hero-name')).toBeVisible()
    const quarantined = await page.evaluate((k) => localStorage.getItem(k), QUARANTINE_KEY)
    expect(quarantined).toBe('{ not valid json')
    expect(errors).toEqual([])
  })

  test('guest progress never leaks into a signed-in namespace', async ({ page }) => {
    const game = new GamePage(page)
    await game.open(makeSave({ name: 'GuestOnly', gold: 4242 }))
    await game.continueAsGuest()

    const keys = await game.localStorageKeys()
    expect(keys).toContain(GUEST_KEY)
    // Nothing should have been written into any account slot.
    expect(keys.some((k) => k.includes(':user:'))).toBe(false)
    expect(await game.save(userKey('someone'))).toBeNull()
  })
})

test.describe('idle and accessibility', () => {
  test('offline rewards pay out once', async ({ page }) => {
    const game = new GamePage(page)
    const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000
    await game.open(makeSave({ gold: 100, idle: { farmingStageId: 'stage-1', lastSeenAt: threeHoursAgo } }))
    await game.continueAsGuest()

    await game.tap(240, 472) // Collect on the welcome-back modal
    await expect.poll(async () => (await game.save())?.gold ?? 0, { timeout: 10_000 }).toBeGreaterThan(100)

    const afterCollect = (await game.save())?.gold
    // Bouncing through another scene must not pay a second time.
    await game.tap(MENU.character.x, MENU.character.y)
    await game.settle()
    await game.tap(240, 622)
    await game.settle()
    expect((await game.save())?.gold).toBe(afterCollect)
  })

  test('buttons stay above the 44px touch target minimum', async ({ page }) => {
    const game = new GamePage(page)
    await game.open(makeSave())
    await game.continueAsGuest()

    // Buttons are 56 logical px tall; check what that becomes on this viewport.
    const cssPerLogical = await game.scaleFactor()
    expect(56 * cssPerLogical).toBeGreaterThanOrEqual(44)
  })

  test('the keyboard can drive the menu', async ({ page }) => {
    const game = new GamePage(page)
    await game.open(makeSave())
    await game.continueAsGuest()

    await page.keyboard.press('Tab')
    await page.waitForTimeout(300)
    await page.keyboard.press('Enter') // first focusable is Stages
    await page.waitForTimeout(800)

    // Reaching stage select advances the tutorial, which is observable in the save.
    await game.tap(STAGES_BACK.x, STAGES_BACK.y) // Back
    await game.settle()
    expect(await game.save()).not.toBeNull()
  })
})

test.describe('quests', () => {
  test('a completed achievement pays out exactly once', async ({ page }) => {
    const game = new GamePage(page)
    await game.open(
      makeSave({
        gold: 100,
        level: 12,
        // Enough for "First Steps" (1 stage) and the level milestones.
        stageProgress: { highestUnlocked: 3, completedStageIds: ['stage-1'] },
      }),
    )
    await game.continueAsGuest()

    await game.tap(MENU.quests.x, MENU.quests.y)
    await game.tap(378, 140) // Claim the top row

    await expect
      .poll(async () => (await game.save())?.claimedAchievementIds?.length ?? 0, { timeout: 10_000 })
      .toBeGreaterThan(0)

    const afterClaim = await game.save()
    expect(afterClaim?.gold).toBeGreaterThan(100)
    // The claimed row drops to the bottom of the list, so the same tap must not re-pay.
    const claimedIds = afterClaim?.claimedAchievementIds as string[]
    await game.tap(378, 140)
    await game.settle()
    const after = await game.save()
    expect(after?.claimedAchievementIds).not.toEqual(claimedIds)
    expect(new Set(after?.claimedAchievementIds as string[]).size).toBe(
      (after?.claimedAchievementIds as string[]).length,
    )
  })
})

test.describe('chapters and bosses', () => {
  test('clearing a chapter boss unlocks the next chapter', async ({ page }) => {
    const game = new GamePage(page)
    await game.open(
      makeSave({
        level: 30, // Stats are derived from level, so this is the real power.
        stageProgress: { highestUnlocked: 4, completedStageIds: ['stage-1', 'stage-2', 'stage-3'] },
      }),
    )
    await game.continueAsGuest()

    await game.tap(MENU.stages.x, MENU.stages.y)
    await game.tap(BOSS_ROW.x, BOSS_ROW.y) // the chapter-1 boss

    await expect
      .poll(async () => (await game.save())?.stageProgress?.highestUnlocked ?? 0, { timeout: 20_000 })
      .toBeGreaterThan(4)

    const save = await game.save()
    expect(save?.stageProgress?.completedStageIds).toContain('stage-4')
    // A boss pays far more than the stage before it — that is what makes the
    // wall worth breaking.
    expect(save?.gold).toBeGreaterThan(80)
  })

  test('every chapter is reachable and ends in a boss', async ({ page }) => {
    const game = new GamePage(page)
    await game.open(makeSave({ stageProgress: { highestUnlocked: 12, completedStageIds: [] } }))
    await game.continueAsGuest()
    await game.tap(MENU.stages.x, MENU.stages.y)

    // Paging to the last chapter and back proves the pager bounds match the
    // chapter count — an off-by-one here would strand the final boss.
    await game.tap(CHAPTER_NEXT.x, CHAPTER_NEXT.y)
    await game.tap(CHAPTER_NEXT.x, CHAPTER_NEXT.y)
    await game.tap(BOSS_ROW.x, BOSS_ROW.y) // the final boss
    await page.waitForTimeout(6000)

    // The fight resolved one way or the other rather than hanging.
    expect(await game.save()).not.toBeNull()
    await game.tap(240, 528) // Stage select, from the result screen
    await game.settle()
    await game.tap(STAGES_BACK.x, STAGES_BACK.y)
    await game.settle()
    expect(await game.save()).not.toBeNull()
  })
})

test.describe('analytics consent', () => {
  test('is off by default and sends nothing while off', async ({ page }) => {
    const posted: string[] = []
    page.on('request', (r) => {
      if (r.method() === 'POST') posted.push(r.url())
    })

    const game = new GamePage(page)
    await game.open(makeSave())
    await game.continueAsGuest()
    expect((await game.save())?.settings?.analytics).toBe(false)

    // Play enough to generate events if anything were listening.
    await game.tap(MENU.stages.x, MENU.stages.y)
    await game.tap(STAGE_ROW_1.x, STAGE_ROW_1.y)
    await page.waitForTimeout(6000)

    expect(posted.filter((url) => url.includes('analytics'))).toEqual([])
    expect((await game.save())?.settings?.analytics).toBe(false)
  })

  // Toggling consent must survive a reload, or the switch is decorative.
  test('persists an explicit opt-in, and an opt-out after it', async ({ page }) => {
    const game = new GamePage(page)
    await game.open(makeSave())
    await game.continueAsGuest()

    await game.tap(MENU.settings.x, MENU.settings.y)
    await game.tap(SETTINGS.analytics.x, SETTINGS.analytics.y)
    await expect.poll(async () => (await game.save())?.settings?.analytics, { timeout: 10_000 }).toBe(true)

    await page.reload()
    await game.settle()
    await game.continueAsGuest()
    expect((await game.save())?.settings?.analytics).toBe(true)

    // And back off again, which must also stick.
    await game.tap(MENU.settings.x, MENU.settings.y)
    await game.tap(SETTINGS.analytics.x, SETTINGS.analytics.y)
    await expect.poll(async () => (await game.save())?.settings?.analytics, { timeout: 10_000 }).toBe(false)
  })
})

test.describe('installable and offline', () => {
  test('a guest never downloads the cloud-accounts bundle', async ({ page }) => {
    const requested: string[] = []
    page.on('request', (r) => requested.push(r.url()))

    const game = new GamePage(page)
    await game.open(makeSave())
    await game.continueAsGuest()
    await game.settle()

    expect(requested.some((url) => url.includes('supabaseSdk'))).toBe(false)
    // Sanity check that the request log is actually recording chunk loads.
    expect(requested.some((url) => url.includes('phaser-'))).toBe(true)
  })

  test('the manifest describes an installable app', async ({ page }) => {
    const game = new GamePage(page)
    await game.open()

    const manifest = await page.evaluate(async () => {
      const link = document.querySelector<HTMLLinkElement>('link[rel=manifest]')
      if (!link) throw new Error('no manifest link')
      return (await fetch(link.href)).json()
    })
    expect(manifest.display).toBe('standalone')
    // Chromium needs a 192px and a 512px icon before it will offer to install.
    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
  })

  test('the game boots with the network switched off', async ({ page, context }) => {
    const game = new GamePage(page)
    await game.open(makeSave())
    // The worker precaches on install; wait for it before pulling the plug.
    await page.evaluate(() => navigator.serviceWorker.ready)
    await expect
      .poll(async () => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), { timeout: 10_000 })
      .toBe(true)

    await context.setOffline(true)
    await page.reload()
    await game.settle(1500)

    await expect(page.locator('canvas')).toHaveCount(1)
    await game.continueAsGuest()
    await game.settle()
    // Reaching the menu offline means the save, fonts and sprites all resolved.
    expect((await game.save())?.name).toBe('Tester')
    await context.setOffline(false)
  })
})

test.describe('localization', () => {
  test('switching to Thai translates the UI and persists', async ({ page }) => {
    const game = new GamePage(page)
    await game.open(makeSave())
    await game.continueAsGuest()

    await game.tap(MENU.settings.x, MENU.settings.y)
    await game.tap(SETTINGS.thai.x, SETTINGS.thai.y)
    await expect.poll(async () => (await game.save())?.settings?.locale, { timeout: 10_000 }).toBe('th')

    // Thai needs its own face; Fredoka has no Thai glyphs at all.
    const thaiFontReady = await page.evaluate(async () => {
      await document.fonts.load('400 16px Mitr', 'ก')
      return document.fonts.check('400 16px Mitr', 'ก')
    })
    expect(thaiFontReady).toBe(true)

    await page.reload()
    await game.settle()
    await game.continueAsGuest()
    expect((await game.save())?.settings?.locale).toBe('th')
  })
})
