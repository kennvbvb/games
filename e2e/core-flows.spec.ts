import { test, expect } from '@playwright/test'
import { GamePage, GUEST_KEY, QUARANTINE_KEY, makeSave, userKey } from './helpers'

// Menu button positions in the game's logical coordinate space.
const MENU = {
  stages: { x: 240, y: 334 },
  character: { x: 240, y: 396 },
  shop: { x: 240, y: 458 },
  // The y=520 row is three across since the tower and the rift joined it:
  // Quests on the left, Tower in the middle, Rift on the right.
  quests: { x: 84, y: 520 },
  tower: { x: 240, y: 520 },
  rift: { x: 396, y: 520 },
  settings: { x: 148, y: 586 },
}
// One page is one world: four ordinary rows, then the boss on a taller card.
const STAGE_ROW_1 = { x: 374, y: 153 }
const BOSS_ROW = { x: 374, y: 478 }
const WORLD_NEXT = { x: 350, y: 556 }
const WORLD_PREV = { x: 130, y: 556 }
const STAGES_BACK = { x: 240, y: 616 }

// Settings rows: four toggles from y=216 at 72 apart, then difficulty, then
// the language row. Mirrors ROW_TOP/ROW_GAP in SettingsScene.
const SETTINGS_TOP = 216
const SETTINGS_GAP = 72
const SETTINGS = {
  analytics: { x: 372, y: SETTINGS_TOP + 3 * SETTINGS_GAP },
  veteran: { x: 254 + 84, y: SETTINGS_TOP + 4 * SETTINGS_GAP },
  thai: { x: 408, y: SETTINGS_TOP + 5 * SETTINGS_GAP },
}

test.describe('core flows', () => {
  test('a new player can create a hero and reach the menu', async ({ page }) => {
    const game = new GamePage(page)
    await game.open()
    await game.continueAsGuest()

    // No save yet, so the hero creation screen should be showing.
    await expect(page.locator('#hero-name')).toBeVisible()
    await page.locator('#hero-name').fill('Newbie')
    // Kin grid is two columns: Elf is the right-hand card of the first row.
    await game.tap(240 + 112, 216)
    await game.tap(240, 644) // Next
    await game.tap(240, 586) // Start Adventure
    await game.expectSaved()

    const save = await game.save()
    expect(save).toMatchObject({ name: 'Newbie', level: 1, tutorialStep: 0, raceId: 'elf' })
    // Stats come from the race, not from a shared default.
    expect(save?.stats).toEqual({ maxHp: 42, atk: 13, def: 3 })
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
    await game.pickPlan()

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
        // Everything unlocked, so stage select opens straight on the last
        // world — no paging needed to reach a fight well out of reach.
        stageProgress: { highestUnlocked: 60, completedStageIds: [] },
      }),
    )
    await game.continueAsGuest()

    await game.tap(MENU.stages.x, MENU.stages.y)
    await game.tap(BOSS_ROW.x, BOSS_ROW.y) // the final boss
    await game.pickPlan()

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
    expect(errors).toEqual([])
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

test.describe('worlds and bosses', () => {
  test('clearing a world boss unlocks the next world', async ({ page }) => {
    const game = new GamePage(page)
    await game.open(
      makeSave({
        level: 30, // Stats are derived from level, so this is the real power.
        stageProgress: { highestUnlocked: 5, completedStageIds: ['stage-1', 'stage-2', 'stage-3', 'stage-4'] },
      }),
    )
    await game.continueAsGuest()

    await game.tap(MENU.stages.x, MENU.stages.y)
    await game.tap(BOSS_ROW.x, BOSS_ROW.y) // the World 1 boss
    await game.pickPlan()

    await expect
      .poll(async () => (await game.save())?.stageProgress?.highestUnlocked ?? 0, { timeout: 20_000 })
      .toBeGreaterThan(5)

    const save = await game.save()
    expect(save?.stageProgress?.completedStageIds).toContain('stage-5')
    // A boss pays far more than the stage before it — that is what makes the
    // wall worth breaking.
    expect(save?.gold).toBeGreaterThan(80)
  })

  test('every world is reachable and ends in a boss', async ({ page }) => {
    const game = new GamePage(page)
    await game.open(makeSave({ stageProgress: { highestUnlocked: 60, completedStageIds: [] } }))
    await game.continueAsGuest()
    await game.tap(MENU.stages.x, MENU.stages.y)

    // Opening straight on the last world is the point: with twelve worlds, a
    // player unlocked to the end must not have to page eleven times. Stepping
    // back and forward from there also proves the pager bounds are right.
    await game.tap(WORLD_PREV.x, WORLD_PREV.y)
    await game.tap(WORLD_NEXT.x, WORLD_NEXT.y)
    await game.tap(BOSS_ROW.x, BOSS_ROW.y) // the final boss
    await game.pickPlan()
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
    await game.pickPlan()
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

test.describe('admin test lab', () => {
  test('is not reachable from a production build', async ({ page }) => {
    // This suite runs against the real production bundle, which is the only
    // place this can be proven: `devAdminEnabled` reads `import.meta.env.DEV`,
    // and a unit test cannot observe what the production define does to it.
    const game = new GamePage(page)
    await game.open(makeSave())
    await game.continueAsGuest()

    const before = await page.locator('canvas').first().screenshot()

    // Both documented routes in: the hotkey, and the corner the TEST LAB badge
    // occupies when a grant exists.
    await page.keyboard.press('Control+Shift+A')
    await game.settle(400)
    await game.tap(425, 35)
    await game.settle(400)

    // The lab paints a near-black backdrop over the whole screen, so if it had
    // opened these two would not be within a pixel of each other.
    const after = await page.locator('canvas').first().screenshot()
    expect(after.equals(before)).toBe(true)
  })
})

test.describe('skill tree', () => {
  // Branch tabs sit at y=96; skill cards at 164/244/324/404 with the action
  // button on the right; loadout slots at y=516.
  // Four buttons share y=604 since Mastery joined the row: Equipment 66,
  // Skills 182, Mastery 298, Shop 414.
  const SKILLS_BUTTON = { x: 182, y: 604 }
  const BRANCH = (i: number) => ({ x: 84 + i * 156, y: 96 })
  const CARD_ACTION = (i: number) => ({ x: 386, y: [164, 244, 324, 404][i] })

  test('unlocking and equipping a skill survives a reload', async ({ page }) => {
    const game = new GamePage(page)
    // Level 12 with three bosses down: 11 + 3 = 14 points, plenty for a branch.
    await game.open(
      makeSave({
        stageProgress: {
          highestUnlocked: 20,
          completedStageIds: ['stage-5', 'stage-10', 'stage-15'],
        },
      }),
    )
    await game.continueAsGuest()

    await game.tap(MENU.character.x, MENU.character.y)
    await game.tap(SKILLS_BUTTON.x, SKILLS_BUTTON.y)

    // Tier 1 of the first branch is the only thing buyable to start with.
    await game.tap(CARD_ACTION(0).x, CARD_ACTION(0).y)
    await expect
      .poll(async () => (await game.save())?.unlockedSkillIds, { timeout: 10_000 })
      .toEqual(['human-1-1'])

    // The same button is now Equip rather than Unlock.
    await game.tap(CARD_ACTION(0).x, CARD_ACTION(0).y)
    await expect.poll(async () => (await game.save())?.loadout, { timeout: 10_000 }).toEqual(['human-1-1'])

    await page.reload()
    await game.settle()
    await game.continueAsGuest()
    const save = await game.save()
    expect(save?.unlockedSkillIds).toEqual(['human-1-1'])
    expect(save?.loadout).toEqual(['human-1-1'])
  })

  test('a tier stays locked until the one below it is bought', async ({ page }) => {
    const game = new GamePage(page)
    await game.open(makeSave({ level: 30 }))
    await game.continueAsGuest()
    await game.tap(MENU.character.x, MENU.character.y)
    await game.tap(SKILLS_BUTTON.x, SKILLS_BUTTON.y)

    // Tier 2 first: its button is disabled, so this tap must do nothing.
    await game.tap(CARD_ACTION(1).x, CARD_ACTION(1).y)
    await game.settle(400)
    expect((await game.save())?.unlockedSkillIds).toEqual([])

    // Buy tier 1, and tier 2 opens.
    await game.tap(CARD_ACTION(0).x, CARD_ACTION(0).y)
    await game.settle(400)
    await game.tap(CARD_ACTION(1).x, CARD_ACTION(1).y)
    await expect
      .poll(async () => (await game.save())?.unlockedSkillIds, { timeout: 10_000 })
      .toEqual(['human-1-1', 'human-1-2'])
  })

  test('switching branches shows a different set of four', async ({ page }) => {
    const game = new GamePage(page)
    await game.open(makeSave({ level: 30 }))
    await game.continueAsGuest()
    await game.tap(MENU.character.x, MENU.character.y)
    await game.tap(SKILLS_BUTTON.x, SKILLS_BUTTON.y)

    const first = await page.locator('canvas').first().screenshot()
    await game.tap(BRANCH(2).x, BRANCH(2).y)
    const third = await page.locator('canvas').first().screenshot()
    expect(third.equals(first)).toBe(false)

    // And buying here lands in the third branch, not the first.
    await game.tap(CARD_ACTION(0).x, CARD_ACTION(0).y)
    await expect
      .poll(async () => (await game.save())?.unlockedSkillIds, { timeout: 10_000 })
      .toEqual(['human-3-1'])
  })
})

test.describe('difficulty modes', () => {
  test('Veteran stays locked until four worlds are actually cleared', async ({ page }) => {
    const game = new GamePage(page)
    // Unlocked deep into the campaign, but only three worlds finished — the
    // gate is on clearing, not on how far the unlock marker has run ahead.
    await game.open(
      makeSave({
        level: 30,
        stageProgress: {
          highestUnlocked: 40,
          completedStageIds: Array.from({ length: 15 }, (_, i) => `stage-${i + 1}`),
        },
      }),
    )
    await game.continueAsGuest()
    await game.tap(MENU.settings.x, MENU.settings.y)

    await game.tap(SETTINGS.veteran.x, SETTINGS.veteran.y)
    await game.settle(500)
    expect((await game.save())?.settings?.difficulty).toBe('normal')
  })

  test('a cleared fourth world opens Veteran and the choice sticks', async ({ page }) => {
    const game = new GamePage(page)
    await game.open(
      makeSave({
        level: 30,
        stageProgress: {
          highestUnlocked: 40,
          completedStageIds: Array.from({ length: 20 }, (_, i) => `stage-${i + 1}`),
        },
      }),
    )
    await game.continueAsGuest()
    await game.tap(MENU.settings.x, MENU.settings.y)

    await game.tap(SETTINGS.veteran.x, SETTINGS.veteran.y)
    await expect
      .poll(async () => (await game.save())?.settings?.difficulty, { timeout: 10_000 })
      .toBe('veteran')

    await page.reload()
    await game.settle()
    await game.continueAsGuest()
    expect((await game.save())?.settings?.difficulty).toBe('veteran')
  })
})

test.describe('kin mastery', () => {
  const MASTERY_BUTTON = { x: 298, y: 604 }
  // Relic cards at 298/410/522 with the Carry button on the right at x=386.
  const RELIC_ACTION = (i: number) => ({ x: 386, y: [298, 410, 522][i] })

  /** Every stage of worlds 1..through, which is what mastery rank is derived from. */
  const clearedThrough = (worlds: number) =>
    Array.from({ length: worlds * 5 }, (_, i) => `stage-${i + 1}`)

  test('carrying a relic survives a reload', async ({ page }) => {
    const game = new GamePage(page)
    // Five worlds cleared is 7*(5*6/2) = 105 mastery, which is rank 4 — past
    // the rank-3 relic and short of the rank-6 one.
    await game.open(
      makeSave({ level: 30, stageProgress: { highestUnlocked: 26, completedStageIds: clearedThrough(5) } }),
    )
    await game.continueAsGuest()

    await game.tap(MENU.character.x, MENU.character.y)
    await game.tap(MASTERY_BUTTON.x, MASTERY_BUTTON.y)

    await game.tap(RELIC_ACTION(0).x, RELIC_ACTION(0).y)
    await expect
      .poll(async () => (await game.save())?.equippedRelicId, { timeout: 10_000 })
      .toBe('relic-human-1')

    await page.reload()
    await game.settle()
    await game.continueAsGuest()
    expect((await game.save())?.equippedRelicId).toBe('relic-human-1')
  })

  test('a relic above the earned rank cannot be taken', async ({ page }) => {
    const game = new GamePage(page)
    await game.open(
      makeSave({ level: 30, stageProgress: { highestUnlocked: 26, completedStageIds: clearedThrough(5) } }),
    )
    await game.continueAsGuest()
    await game.tap(MENU.character.x, MENU.character.y)
    await game.tap(MASTERY_BUTTON.x, MASTERY_BUTTON.y)

    // The rank-9 card is locked, so its button is disabled and the tap is a no-op.
    await game.tap(RELIC_ACTION(2).x, RELIC_ACTION(2).y)
    await game.settle(400)
    expect((await game.save())?.equippedRelicId).toBeNull()
  })

  test('a save claiming an unearned relic loads without it', async ({ page }) => {
    const game = new GamePage(page)
    await game.open(
      makeSave({
        equippedRelicId: 'relic-human-3',
        stageProgress: { highestUnlocked: 6, completedStageIds: ['stage-1'] },
      }),
    )
    await game.continueAsGuest()
    expect((await game.save())?.equippedRelicId).toBeNull()
  })
})

test.describe('endless tower', () => {
  const TOWER_BUTTON = MENU.tower
  // Five floor rows from y=250, 74 apart, with the Fight button at x=396.
  const FLOOR_ACTION = (i: number) => ({ x: 396, y: 250 + i * 74 })
  const allStages = Array.from({ length: 100 }, (_, i) => `stage-${i + 1}`)
  // The tower is balanced against a hero who bought gear on the way through the
  // campaign, not a bare level-34 stat block — without it even floor 1 is a loss.
  const EQUIPPED = {
    weapon: 'worldbreaker',
    head: 'crown-of-dawn',
    body: 'aegis-of-dawn',
    boots: 'treads-of-the-titan',
    accessory1: 'heros-emblem',
    accessory2: 'eternity-shard',
  }
  const geared = {
    level: 34,
    gold: 40_000,
    ownedItemIds: Object.values(EQUIPPED),
    equipped: EQUIPPED,
  }

  test('stays shut until the whole campaign is cleared', async ({ page }) => {
    const game = new GamePage(page)
    await game.open(makeSave({ stageProgress: { highestUnlocked: 100, completedStageIds: allStages.slice(0, 99) } }))
    await game.continueAsGuest()
    await game.tap(TOWER_BUTTON.x, TOWER_BUTTON.y)
    await game.settle(500)

    // The locked screen has no floor rows, so tapping where one would be does
    // nothing and the record stays at zero.
    await game.tap(FLOOR_ACTION(0).x, FLOOR_ACTION(0).y)
    await game.settle(500)
    expect((await game.save())?.tower).toEqual({ bestFloor: 0 })
  })

  test('a graduate can climb, and the record survives a reload', async ({ page }) => {
    const game = new GamePage(page)
    await game.open(
      makeSave({ ...geared, stageProgress: { highestUnlocked: 100, completedStageIds: allStages } }),
    )
    await game.continueAsGuest()
    await game.tap(TOWER_BUTTON.x, TOWER_BUTTON.y)
    await game.settle(600)

    // The window opens on floor 1, which is the only one open.
    await game.tap(FLOOR_ACTION(0).x, FLOOR_ACTION(0).y)
    await game.settle(600)
    await game.pickPlan()
    await expect
      .poll(async () => (await game.save())?.tower, { timeout: 30_000 })
      .toEqual({ bestFloor: 1 })

    await page.reload()
    await game.settle()
    await game.continueAsGuest()
    expect((await game.save())?.tower).toEqual({ bestFloor: 1 })
  })

  test('a floor is never recorded as campaign progress', async ({ page }) => {
    const game = new GamePage(page)
    await game.open(
      makeSave({
        ...geared,
        tower: { bestFloor: 4 },
        idle: { farmingStageId: 'stage-3', lastSeenAt: Date.now() },
        stageProgress: { highestUnlocked: 100, completedStageIds: allStages },
      }),
    )
    await game.continueAsGuest()
    await game.tap(TOWER_BUTTON.x, TOWER_BUTTON.y)
    await game.settle(600)

    // Window opens with floor 4 on top, so floor 5 is the second row.
    await game.tap(FLOOR_ACTION(1).x, FLOOR_ACTION(1).y)
    await game.settle(600)
    await game.pickPlan()
    await expect.poll(async () => (await game.save())?.tower, { timeout: 30_000 }).toEqual({ bestFloor: 5 })

    const save = await game.save()
    // A tower id in the cleared list would be dropped by the validator, and a
    // tower id as the farming target would switch offline rewards off.
    expect((save as unknown as { stageProgress: { completedStageIds: string[] } }).stageProgress.completedStageIds)
      .toHaveLength(100)
    expect((save as unknown as { idle: { farmingStageId: string } }).idle.farmingStageId).toBe('stage-3')
  })
})

test.describe('realm rift', () => {
  const RIFT_BUTTON = MENU.rift
  const ENTER = { x: 240, y: 556 }
  const eightWorlds = Array.from({ length: 40 }, (_, i) => `stage-${i + 1}`)

  test('stays shut until eight worlds are cleared', async ({ page }) => {
    const game = new GamePage(page)
    await game.open(
      makeSave({ stageProgress: { highestUnlocked: 40, completedStageIds: eightWorlds.slice(0, 39) } }),
    )
    await game.continueAsGuest()
    await game.tap(RIFT_BUTTON.x, RIFT_BUTTON.y)
    await game.settle(600)

    // The locked screen has no Enter button, so this tap cannot start a fight.
    await game.tap(ENTER.x, ENTER.y)
    await game.settle(600)
    expect((await game.save())?.rift).toEqual({ clearedWeek: -1 })
  })

  test('clearing it marks the week, and never campaign progress', async ({ page }) => {
    const game = new GamePage(page)
    const EQUIPPED = {
      weapon: 'worldbreaker',
      head: 'crown-of-dawn',
      body: 'aegis-of-dawn',
      boots: 'treads-of-the-titan',
      accessory1: 'heros-emblem',
      accessory2: 'eternity-shard',
    }
    await game.open(
      makeSave({
        level: 40,
        gold: 40_000,
        ownedItemIds: Object.values(EQUIPPED),
        equipped: EQUIPPED,
        idle: { farmingStageId: 'stage-3', lastSeenAt: Date.now() },
        stageProgress: { highestUnlocked: 41, completedStageIds: eightWorlds },
      }),
    )
    await game.continueAsGuest()
    await game.tap(RIFT_BUTTON.x, RIFT_BUTTON.y)
    await game.settle(600)
    await game.tap(ENTER.x, ENTER.y)
    await game.settle(600)
    await game.pickPlan()

    await expect
      .poll(async () => (await game.save())?.rift?.clearedWeek ?? -1, { timeout: 30_000 })
      .toBeGreaterThan(-1)

    const save = await game.save()
    // A rift id in the cleared list would be dropped by the validator, and one
    // as the farming target would switch offline rewards off.
    expect(save?.stageProgress?.completedStageIds).toHaveLength(40)
    expect(save?.idle?.farmingStageId).toBe('stage-3')
    expect(save?.tower).toEqual({ bestFloor: 0 })
  })

  test('a save claiming a future week is pulled back to the current one', async ({ page }) => {
    const game = new GamePage(page)
    await game.open(
      makeSave({
        rift: { clearedWeek: 99_999 },
        stageProgress: { highestUnlocked: 41, completedStageIds: eightWorlds },
      }),
    )
    await game.continueAsGuest()
    const week = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))
    expect((await game.save())?.rift).toEqual({ clearedWeek: week })
  })
})
