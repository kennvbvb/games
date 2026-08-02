import { describe, it, expect } from 'vitest'
import { compareRaces, comparePlans, diagnoseLoss, measure, repeat, runLab, toCsv } from '../src/admin/battleLab'
import { enemyFor, rewardsFor, DIFFICULTIES } from '../src/data/difficulties'
import { STAGE_BY_ID, STAGES, STAGES_PER_WORLD } from '../src/data/stages'
import { WORLDS } from '../src/data/worlds'
import { activeDifficulty, unlockedDifficulties, worldsCleared } from '../src/systems/campaignModes'
import { stageOutlook } from '../src/systems/difficulty'
import { RACE_IDS } from '../src/data/races'
import { PLAN_IDS } from '../src/data/battlePlans'
import { createDefaultPlayerState } from '../src/state/playerState'
import { statsForLevel } from '../src/systems/leveling'
import { resolveBattle } from '../src/systems/combat'
import type { PlayerState } from '../src/types'

function heroAt(level: number, patch: Partial<PlayerState> = {}): PlayerState {
  const base = createDefaultPlayerState('Lab')
  return { ...base, level, stats: statsForLevel(level, base.raceId), ...patch }
}

describe('difficulty modes', () => {
  it('leaves the Normal numbers exactly as authored', () => {
    for (const stage of STAGES) {
      expect(enemyFor(stage.enemy, 'normal')).toBe(stage.enemy)
      expect(rewardsFor(stage.rewards, 'normal')).toBe(stage.rewards)
    }
  })

  it('scales health, attack and reward but never defence', () => {
    const enemy = STAGE_BY_ID.get('stage-10')!.enemy
    const veteran = enemyFor(enemy, 'veteran')
    expect(veteran.maxHp).toBeGreaterThan(enemy.maxHp)
    expect(veteran.atk).toBeGreaterThan(enemy.atk)
    // Defence is subtracted before the minimum-1 floor, so scaling it would
    // push weak builds onto the floor and turn "harder" into "impossible".
    expect(veteran.def).toBe(enemy.def)
  })

  it('keeps boss enrage attached and scaled by the new base attack', () => {
    const boss = STAGE_BY_ID.get('stage-5')!.enemy
    const nightmare = enemyFor(boss, 'nightmare')
    expect(nightmare.boss).toEqual(boss.boss)
    expect(nightmare.atk).toBeGreaterThan(boss.atk)
  })

  it('orders the three modes by both danger and payout', () => {
    const [normal, veteran, nightmare] = DIFFICULTIES
    expect(veteran.enemyHp).toBeGreaterThan(normal.enemyHp)
    expect(nightmare.enemyHp).toBeGreaterThan(veteran.enemyHp)
    expect(veteran.reward).toBeGreaterThan(normal.reward)
    expect(nightmare.reward).toBeGreaterThan(veteran.reward)
    // A harder mode that paid the same would never be worth choosing.
    expect(veteran.reward).toBeGreaterThan(veteran.enemyHp)
  })

  it('falls closed to Normal for an unknown mode', () => {
    const enemy = STAGE_BY_ID.get('stage-10')!.enemy
    expect(enemyFor(enemy, 'impossible')).toBe(enemy)
    expect(enemyFor(enemy, undefined)).toBe(enemy)
  })
})

describe('battle lab', () => {
  it('runs the same combat the game runs, not a copy of it', () => {
    const player = heroAt(6)
    const stage = STAGE_BY_ID.get('stage-3')!
    const { result } = runLab({ player, stage, plan: 'brave' })
    const direct = resolveBattle({
      player: statsForLevel(6, 'human'),
      enemy: stage.enemy,
      rewards: stage.rewards,
      plan: 'brave',
      passive: undefined,
    })
    expect(result).toEqual(direct)
  })

  it('reads its metrics off the log without changing the fight', () => {
    const player = heroAt(8)
    const stage = STAGE_BY_ID.get('stage-4')!
    const { result, metrics } = runLab({ player, stage, plan: 'cozy' })

    const dealt = result.log.filter((e) => e.attacker === 'player').reduce((n, e) => n + e.damage, 0)
    const taken = result.log.filter((e) => e.attacker === 'enemy').reduce((n, e) => n + e.damage, 0)
    expect(metrics.damageDealt).toBe(dealt)
    expect(metrics.damageTaken).toBe(taken)
    expect(metrics.playerHpLeft).toBe(result.playerHpLeft)
    expect(metrics.turns).toBe(result.log[result.log.length - 1].turn)
  })

  it('attributes a dodge to whoever evaded, not to whoever swung', () => {
    // Stage 2 is Slippery: it dodges every 4th player attack. Those events are
    // logged with attacker 'player', so counting naively would credit them to
    // the player.
    // Level 1 on purpose: a stronger hero kills it in three swings and the
    // fourth attack — the one that would be dodged — never happens.
    const { metrics } = runLab({ player: heroAt(1), stage: STAGE_BY_ID.get('stage-2')!, plan: 'brave' })
    expect(metrics.enemyDodges).toBeGreaterThan(0)
    expect(metrics.playerDodges).toBe(0)
  })

  it('is reproducible: a thousand runs of one input give one result', () => {
    const { distinct } = repeat(
      { player: heroAt(7), stage: STAGE_BY_ID.get('stage-6')!, plan: 'clever' },
      1000,
    )
    expect(distinct).toBe(1)
  })

  it('compares every plan and every race for one stage', () => {
    const run = { player: heroAt(9), stage: STAGE_BY_ID.get('stage-7')! }
    const plans = comparePlans(run)
    const races = compareRaces(run)
    expect(Object.keys(plans).sort()).toEqual([...PLAN_IDS].sort())
    expect(Object.keys(races).sort()).toEqual([...RACE_IDS].sort())
  })

  it('gives each race its own stat block when comparing, not the one on the save', () => {
    // Holding stats fixed would compare only the passives, and the stat block
    // is most of what distinguishes a race.
    const races = compareRaces({ player: heroAt(12), stage: STAGE_BY_ID.get('stage-8')! })
    expect(races.dwarf.playerMaxHp).toBeGreaterThan(races.elf.playerMaxHp)
    expect(new Set(RACE_IDS.map((id) => races[id].playerMaxHp)).size).toBeGreaterThan(1)
  })

  it('banks the human EXP bonus in the metrics', () => {
    const stage = STAGE_BY_ID.get('stage-1')!
    const races = compareRaces({ player: heroAt(10), stage, plan: 'brave' })
    // Human is the only race with an EXP passive, and it must show up in what
    // the lab reports as banked or the reward-per-fight comparison lies.
    expect(races.human.exp).toBe(Math.round(stage.rewards.exp * 1.08))
    expect(races.elf.exp).toBe(stage.rewards.exp)
  })

  it('pays the difficulty bonus only on a win', () => {
    const stage = STAGE_BY_ID.get('stage-2')!
    const won = runLab({ player: heroAt(12), stage, plan: 'brave', difficulty: 'veteran' }).metrics
    expect(won.win).toBe(true)
    expect(won.gold).toBe(Math.round(stage.rewards.gold * 1.35))

    const lost = runLab({ player: heroAt(1), stage: STAGES[55], plan: 'brave', difficulty: 'veteran' }).metrics
    expect(lost.win).toBe(false)
    expect(lost.gold).toBe(0)
    expect(lost.exp).toBe(0)
  })

  it('makes a stage measurably harder on a higher difficulty', () => {
    const run = { player: heroAt(14), stage: STAGE_BY_ID.get('stage-12')!, plan: 'brave' as const }
    const normal = runLab({ ...run, difficulty: 'normal' }).metrics
    const nightmare = runLab({ ...run, difficulty: 'nightmare' }).metrics
    expect(nightmare.playerHpLeft).toBeLessThan(normal.playerHpLeft)
    expect(nightmare.turns).toBeGreaterThan(normal.turns)
  })
})

describe('loss diagnosis', () => {
  const enemyMax = 1000
  const lost = (enemyHpLeft: number) =>
    ({ win: false, outcome: 'loss', enemyHpLeft, playerHpLeft: 0, log: [], rewards: { exp: 0, gold: 0 } }) as never

  it('says nothing about a fight that was won', () => {
    expect(diagnoseLoss({ win: true, outcome: 'win' } as never, enemyMax)).toBeNull()
  })

  it('separates "barely dented it" from "so close"', () => {
    expect(diagnoseLoss(lost(900), enemyMax)).toBe('damage')
    expect(diagnoseLoss(lost(400), enemyMax)).toBe('survivability')
    expect(diagnoseLoss(lost(80), enemyMax)).toBe('narrow')
  })

  it('calls a fight that never ended a stalemate rather than a loss', () => {
    // A timeout is not "you lost" — telling the player to get stronger would be
    // the wrong advice for a fight neither side could finish.
    const timeout = { win: false, outcome: 'timeout', enemyHpLeft: 500 } as never
    expect(diagnoseLoss(timeout, enemyMax)).toBe('stalemate')
  })

  it('reaches a real diagnosis from a real losing fight', () => {
    const { metrics } = runLab({ player: heroAt(1), stage: STAGES[59], plan: 'brave' })
    expect(metrics.win).toBe(false)
    expect(metrics.lossReason).toBe('damage')
  })
})

describe('lab export', () => {
  it('emits one CSV row per label with a stable column order', () => {
    const rows = comparePlans({ player: heroAt(9), stage: STAGE_BY_ID.get('stage-5')! })
    const csv = toCsv(rows)
    const lines = csv.split('\n')
    expect(lines).toHaveLength(1 + PLAN_IDS.length)
    expect(lines[0].startsWith('label,outcome,turns,')).toBe(true)
    for (const line of lines) expect(line.split(',')).toHaveLength(lines[0].split(',').length)
  })

  it('writes an empty cell rather than "null" for a fight that was won', () => {
    const csv = toCsv({ won: measure({ win: true, outcome: 'win', log: [], playerHpLeft: 5, enemyHpLeft: 0, rewards: { exp: 1, gold: 1 } } as never, 10, 10, 'human') })
    expect(csv.split('\n')[1].endsWith(',')).toBe(true)
  })
})

describe('difficulty unlocking', () => {
  const withCleared = (worlds: number): PlayerState => ({
    ...createDefaultPlayerState('Gate'),
    stageProgress: {
      highestUnlocked: STAGES.length,
      completedStageIds: STAGES.slice(0, worlds * STAGES_PER_WORLD).map((s) => s.id),
    },
  })

  it('counts a world only once every stage in it is actually cleared', () => {
    // Unlocking runs a stage ahead of clearing, so a player who lost to a boss
    // must not open a harder mode on the strength of a fight they did not win.
    const almost: PlayerState = {
      ...createDefaultPlayerState('Gate'),
      stageProgress: {
        highestUnlocked: 5,
        completedStageIds: STAGES.slice(0, STAGES_PER_WORLD - 1).map((s) => s.id),
      },
    }
    expect(worldsCleared(almost)).toBe(0)
    expect(worldsCleared(withCleared(1))).toBe(1)
    expect(worldsCleared(withCleared(7))).toBe(7)
  })

  it('opens Veteran after four worlds and Nightmare only at the end', () => {
    expect(unlockedDifficulties(withCleared(0)).map((m) => m.id)).toEqual(['normal'])
    expect(unlockedDifficulties(withCleared(3)).map((m) => m.id)).toEqual(['normal'])
    expect(unlockedDifficulties(withCleared(4)).map((m) => m.id)).toEqual(['normal', 'veteran'])
    expect(unlockedDifficulties(withCleared(WORLDS.length)).map((m) => m.id)).toEqual([
      'normal',
      'veteran',
      'nightmare',
    ])
  })

  it('falls back to Normal for a mode the save has not earned', () => {
    // A save can name a mode it never unlocked — by a hand edit, or from a
    // cloud copy written on a device that had cleared more.
    const forged: PlayerState = {
      ...withCleared(1),
      settings: { ...createDefaultPlayerState().settings, difficulty: 'nightmare' },
    }
    expect(forged.settings.difficulty).toBe('nightmare')
    expect(activeDifficulty(forged)).toBe('normal')

    const earned: PlayerState = {
      ...withCleared(WORLDS.length),
      settings: { ...createDefaultPlayerState().settings, difficulty: 'nightmare' },
    }
    expect(activeDifficulty(earned)).toBe('nightmare')
  })

  it('re-rates a stage preview when the mode changes', () => {
    const veteran: PlayerState = {
      ...withCleared(WORLDS.length),
      level: 20,
      stats: statsForLevel(20, 'human'),
      settings: { ...createDefaultPlayerState().settings, difficulty: 'veteran' },
    }
    const normal: PlayerState = {
      ...veteran,
      settings: { ...veteran.settings, difficulty: 'normal' },
    }
    const stage = STAGE_BY_ID.get('stage-20')!
    // The preview is the promise the player acts on, so it has to follow the
    // mode rather than only the fight that gets animated.
    expect(stageOutlook(veteran, stage).hpRemaining).toBeLessThan(stageOutlook(normal, stage).hpRemaining)
  })
})
