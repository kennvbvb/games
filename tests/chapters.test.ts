import { describe, it, expect } from 'vitest'
import { CHAPTERS, BOSS_STAGE_IDS, chapterOfStage, chapterCleared } from '../src/data/chapters'
import { STAGES, STAGES_PER_CHAPTER, isBossStage } from '../src/data/stages'
import { resolveBattle, enemyAttackAt } from '../src/systems/combat'
import { stageOutlook } from '../src/systems/difficulty'
import { createDefaultPlayerState } from '../src/state/playerState'
import { achievementStatus } from '../src/systems/achievements'
import { ACHIEVEMENT_BY_ID } from '../src/data/achievements'
import type { EnemyConfig, PlayerStats } from '../src/types'

describe('chapters', () => {
  it('covers every stage exactly once', () => {
    const ids = CHAPTERS.flatMap((c) => c.stages.map((s) => s.id))
    expect(ids).toEqual(STAGES.map((s) => s.id))
  })

  it('has no half-filled chapter', () => {
    expect(CHAPTERS.length * STAGES_PER_CHAPTER).toBe(STAGES.length)
    for (const chapter of CHAPTERS) {
      expect(chapter.stages).toHaveLength(STAGES_PER_CHAPTER)
    }
  })

  it('closes every chapter with a boss and has bosses nowhere else', () => {
    for (const chapter of CHAPTERS) {
      expect(isBossStage(chapter.boss)).toBe(true)
      expect(chapter.boss).toBe(chapter.stages[chapter.stages.length - 1])
    }
    expect(STAGES.filter(isBossStage).map((s) => s.id)).toEqual(BOSS_STAGE_IDS)
  })

  it('maps a stage back to its chapter', () => {
    expect(chapterOfStage(STAGES[0]).index).toBe(1)
    expect(chapterOfStage(STAGES[STAGES_PER_CHAPTER]).index).toBe(2)
    expect(chapterOfStage(STAGES[STAGES.length - 1]).index).toBe(CHAPTERS.length)
  })

  it('counts only the cleared stages of the chapter asked about', () => {
    const state = {
      ...createDefaultPlayerState('Hero'),
      stageProgress: { highestUnlocked: 6, completedStageIds: ['stage-1', 'stage-2', 'stage-5'] },
    }
    expect(chapterCleared(state, CHAPTERS[0])).toBe(2)
    expect(chapterCleared(state, CHAPTERS[1])).toBe(1)
  })
})

describe('boss stages', () => {
  it('hits harder and pays more than the stage before it', () => {
    for (const chapter of CHAPTERS) {
      const boss = chapter.boss
      const previous = STAGES[boss.order - 2]
      expect(boss.enemy.maxHp).toBeGreaterThan(previous.enemy.maxHp)
      expect(boss.enemy.atk).toBeGreaterThan(previous.enemy.atk)
      expect(boss.rewards.gold).toBeGreaterThan(previous.rewards.gold * 2)
    }
  })

  it('is beatable by a hero who has out-levelled it', () => {
    // Combat is deterministic, so this is a fact about the numbers, not a sample.
    const strong: PlayerStats = { maxHp: 900, atk: 120, def: 40 }
    for (const chapter of CHAPTERS) {
      expect(resolveBattle({ player: strong, enemy: chapter.boss.enemy, rewards: chapter.boss.rewards }).win).toBe(true)
    }
  })
})

describe('enrage', () => {
  const boss: EnemyConfig = {
    name: 'Test Boss',
    sprite: 'enemy_1',
    maxHp: 400,
    atk: 20,
    def: 5,
    boss: { enrageAfterTurn: 3, enrageAtkPerTurn: 0.5 },
  }
  const plain: EnemyConfig = { name: 'Grub', sprite: 'enemy_1', maxHp: 400, atk: 20, def: 5 }

  it('leaves ordinary enemies flat', () => {
    for (const turn of [1, 5, 50]) expect(enemyAttackAt(plain, turn)).toBe(20)
  })

  it('holds base attack through the grace period, then ramps', () => {
    expect(enemyAttackAt(boss, 3)).toBe(20)
    expect(enemyAttackAt(boss, 4)).toBe(30)
    expect(enemyAttackAt(boss, 5)).toBe(40)
  })

  it('flags the turn it starts, once', () => {
    // A tank that cannot out-damage the boss will be ground down by the ramp.
    const tank: PlayerStats = { maxHp: 300, atk: 6, def: 4 }
    const result = resolveBattle({ player: tank, enemy: boss, rewards: { exp: 1, gold: 1 } })
    const flagged = result.log.filter((e) => e.announce === 'enraged')
    expect(flagged).toHaveLength(1)
    expect(flagged[0].turn).toBe(4)
    expect(result.win).toBe(false)
  })

  it('punishes a pure-health build that an equal-power attacker survives', () => {
    // Same rough "power", split differently: damage clears the check, bulk does not.
    const bulky: PlayerStats = { maxHp: 1200, atk: 12, def: 8 }
    const sharp: PlayerStats = { maxHp: 300, atk: 60, def: 8 }
    expect(resolveBattle({ player: bulky, enemy: boss, rewards: { exp: 1, gold: 1 } }).win).toBe(false)
    expect(resolveBattle({ player: sharp, enemy: boss, rewards: { exp: 1, gold: 1 } }).win).toBe(true)
  })

  it('closes off the long attrition wins the real final boss would otherwise allow', () => {
    // Measured across the plausible stat range: without enrage a low-damage
    // hero can grind the last boss down over 100+ turns. The ramp is what
    // makes that a loss, and it is the mechanic's whole reason to exist.
    const final = CHAPTERS[CHAPTERS.length - 1].boss
    const toothless = { ...final.enemy, boss: undefined }
    const grinder: PlayerStats = { maxHp: 2000, atk: 25, def: 25 }

    const without = resolveBattle({ player: grinder, enemy: toothless, rewards: final.rewards })
    expect(without.win).toBe(true)
    expect(without.log[without.log.length - 1].turn).toBeGreaterThan(40)

    expect(resolveBattle({ player: grinder, enemy: final.enemy, rewards: final.rewards }).win).toBe(false)
  })

  it('is visible in the stage preview', () => {
    // The outlook simulates the real fight, so enrage must be reflected there.
    const state = {
      ...createDefaultPlayerState('Hero'),
      level: 3,
      stats: { maxHp: 2000, atk: 12, def: 6 },
    }
    expect(stageOutlook(state, CHAPTERS[2].boss).willWin).toBe(false)
  })
})

describe('boss-slayer achievement', () => {
  const achievement = ACHIEVEMENT_BY_ID.get('boss-slayer')!

  it('counts only boss clears', () => {
    const state = {
      ...createDefaultPlayerState('Hero'),
      stageProgress: { highestUnlocked: 9, completedStageIds: ['stage-1', 'stage-2', 'stage-3', BOSS_STAGE_IDS[0]] },
    }
    expect(achievementStatus(state, achievement).current).toBe(1)
  })

  it('completes once every boss is down', () => {
    const state = {
      ...createDefaultPlayerState('Hero'),
      stageProgress: { highestUnlocked: 12, completedStageIds: [...BOSS_STAGE_IDS] },
    }
    const status = achievementStatus(state, achievement)
    expect(status.complete).toBe(true)
    expect(status.claimable).toBe(true)
  })
})
