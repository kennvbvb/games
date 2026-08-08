import { describe, it, expect } from 'vitest'
import { RESOLUTION_ORDER, STATUSES, STATUS_IDS, statusOf } from '../src/data/statuses'
import {
  applyStatus,
  attackScale,
  cleanse,
  decayStatuses,
  defenceScale,
  healingScale,
  hasStatus,
  reflectFraction,
  stacksOf,
  tickStatuses,
} from '../src/systems/status'
import { ENEMY_TRAITS, TRAIT_IDS, traitOf } from '../src/data/enemyTraits'
import { resolveBattle } from '../src/systems/combat'
import { STAGES, isBossStage } from '../src/data/stages'
import { WORLDS } from '../src/data/worlds'
import type { StatusBag } from '../src/systems/status'
import type { EnemyConfig } from '../src/types'

const REWARDS = { exp: 10, gold: 10 }
const PLAYER = { maxHp: 400, atk: 60, def: 15 }
const enemy = (over: Partial<EnemyConfig> = {}): EnemyConfig => ({
  name: 'Dummy',
  sprite: 'enemy_1',
  maxHp: 900,
  atk: 40,
  def: 10,
  ...over,
})

describe('status data', () => {
  it('gives every status a config, an icon and a magnitude that means something', () => {
    expect(STATUSES).toHaveLength(STATUS_IDS.length)
    for (const status of STATUSES) {
      expect(statusOf(status.id)).toBe(status)
      expect(status.maxStacks).toBeGreaterThanOrEqual(1)
      if (status.kind !== 'control') expect(status.defaultMagnitude).toBeGreaterThan(0)
      if (status.kind === 'scale') expect(status.scales).toBeDefined()
    }
  })

  it('fixes the resolution order, damage before healing before control', () => {
    // Order is a rule, not an accident of array layout: a burn that would kill
    // must not be outrun by a regen landing in the same instant, and being
    // frozen is not immunity to the burn already running.
    expect(RESOLUTION_ORDER).toEqual(['damage-over-turn', 'heal-over-turn', 'control'])
  })
})

describe('status engine', () => {
  const bag = (...applications: Parameters<typeof applyStatus>[1][]): StatusBag =>
    applications.reduce<StatusBag>((acc, a) => applyStatus(acc, a, 'enemy'), [])

  it('stacks up to the cap and no further', () => {
    let b: StatusBag = []
    for (let i = 0; i < 20; i++) b = applyStatus(b, { id: 'poison', turns: 3 }, 'enemy')
    expect(stacksOf(b, 'poison')).toBe(statusOf('poison').maxStacks)
  })

  it('refreshes to the longer duration rather than overwriting it', () => {
    // A second application must never be able to cut the first one short,
    // which is what a naive overwrite does and what reads as "it fell off for
    // no reason".
    let b = bag({ id: 'burn', turns: 6 })
    b = applyStatus(b, { id: 'burn', turns: 2 }, 'enemy')
    expect(b[0].remainingTurns).toBe(6)
  })

  it('reports damage and healing separately rather than pre-netting them', () => {
    // Netting them here would hide a kill: a burn that takes the last point of
    // health must land before a regen in the same instant can undo it, and only
    // the caller knows where the health currently stands.
    const tick = tickStatuses(bag({ id: 'burn', turns: 3 }, { id: 'regen', turns: 3 }), 1000, 0)
    expect(tick.damage).toBeGreaterThan(0)
    expect(tick.heal).toBeGreaterThan(0)
    expect(Object.keys(tick).sort()).toEqual(['damage', 'heal', 'skipsTurn'])
  })

  it('freezes without granting immunity to what is already running', () => {
    const tick = tickStatuses(bag({ id: 'freeze', turns: 2 }, { id: 'burn', turns: 2 }), 500, 0)
    expect(tick.skipsTurn).toBe(true)
    expect(tick.damage).toBeGreaterThan(0)
  })

  it('grows bleed with how often its owner has been struck', () => {
    const b = bag({ id: 'bleed', turns: 5 })
    expect(tickStatuses(b, 1000, 10).damage).toBeGreaterThan(tickStatuses(b, 1000, 1).damage)
  })

  it('compounds scale statuses by stack rather than adding them', () => {
    const one = bag({ id: 'weaken', turns: 3 })
    const two = applyStatus(one, { id: 'weaken', turns: 3 }, 'enemy')
    expect(attackScale(one)).toBeCloseTo(0.88, 10)
    expect(attackScale(two)).toBeCloseTo(0.88 ** 2, 10)
    expect(defenceScale(bag({ id: 'armor-break', turns: 2 }))).toBeLessThan(1)
    expect(healingScale(bag({ id: 'curse', turns: 2 }))).toBeLessThan(1)
  })

  it('adds reflect rather than compounding it, and caps it at the whole blow', () => {
    let b = bag({ id: 'reflect', turns: 3 })
    expect(reflectFraction(b)).toBeCloseTo(0.25, 10)
    b = applyStatus(b, { id: 'reflect', turns: 3 }, 'player')
    expect(reflectFraction(b)).toBeCloseTo(0.5, 10)
    expect(reflectFraction(bag({ id: 'reflect', turns: 3, magnitude: 5 }))).toBe(1)
  })

  it('clears only the harmful half on a cleanse', () => {
    const b = bag({ id: 'poison', turns: 4 }, { id: 'regen', turns: 4 }, { id: 'freeze', turns: 2 })
    const clean = cleanse(b)
    expect(hasStatus(clean, 'poison')).toBe(false)
    expect(hasStatus(clean, 'freeze')).toBe(false)
    expect(hasStatus(clean, 'regen')).toBe(true)
  })

  it('counts down and drops what has run out', () => {
    let b = bag({ id: 'burn', turns: 2 })
    b = decayStatuses(b)
    expect(hasStatus(b, 'burn')).toBe(true)
    b = decayStatuses(b)
    expect(b).toEqual([])
  })

  it('does nothing at all with an empty bag', () => {
    expect(tickStatuses([], 500, 3)).toEqual({ damage: 0, heal: 0, skipsTurn: false })
    expect(attackScale([])).toBe(1)
    expect(reflectFraction([])).toBe(0)
  })
})

describe('enemy traits in combat', () => {
  it('leaves a fight with no trait exactly as it was', () => {
    const plain = resolveBattle({ player: PLAYER, enemy: enemy(), rewards: REWARDS })
    const explicit = resolveBattle({
      player: PLAYER,
      enemy: enemy({ trait: 'straightforward' }),
      rewards: REWARDS,
    })
    expect(explicit).toEqual(plain)
  })

  it('makes an Armored enemy take less without making it unkillable', () => {
    const plain = resolveBattle({ player: PLAYER, enemy: enemy(), rewards: REWARDS })
    const armored = resolveBattle({ player: PLAYER, enemy: enemy({ trait: 'armored' }), rewards: REWARDS })
    expect(armored.log[0].damage).toBeLessThan(plain.log[0].damage)
    // The floor is the danger: a low-attack build against high defence ends up
    // dealing 1 a turn, which is a wall rather than a challenge.
    expect(armored.log[0].damage).toBeGreaterThan(1)
  })

  it('poisons on the cadence it advertises, and the poison bites', () => {
    const result = resolveBattle({ player: PLAYER, enemy: enemy({ trait: 'venomous' }), rewards: REWARDS })
    const applied = result.log.filter((e) => e.applied?.includes('poison'))
    expect(applied.length).toBeGreaterThan(0)
    expect(result.log.some((e) => e.attacker === 'player' && (e.statusDamage ?? 0) > 0)).toBe(true)
  })

  it('sends part of a blow back on a Countering enemy', () => {
    const result = resolveBattle({ player: PLAYER, enemy: enemy({ trait: 'countering' }), rewards: REWARDS })
    const first = result.log[0]
    expect(first.counter).toBeGreaterThan(0)
    expect(first.counter).toBeLessThan(first.damage)
  })

  it('drains health back on a Vampiric enemy', () => {
    const drained = resolveBattle({ player: PLAYER, enemy: enemy({ trait: 'vampiric' }), rewards: REWARDS })
    const plain = resolveBattle({ player: PLAYER, enemy: enemy(), rewards: REWARDS })
    // Both fights run the same number of turns, because this player runs out
    // of health first either way — the drain shows up as the enemy finishing
    // with more left, which is what a player would feel as "it healed itself".
    expect(drained.enemyHpLeft).toBeGreaterThan(plain.enemyHpLeft)
  })

  it('puts a Shielded enemy behind something before its health', () => {
    const result = resolveBattle({ player: PLAYER, enemy: enemy({ trait: 'shielded' }), rewards: REWARDS })
    const first = result.log[0]
    expect(first.absorbed).toBeGreaterThan(0)
    expect(first.targetHpAfter).toBe(900)
  })

  it('alternates an Unstable enemy between a harder hit and a wider opening', () => {
    const result = resolveBattle({ player: PLAYER, enemy: enemy({ trait: 'unstable' }), rewards: REWARDS })
    const hits = result.log.filter((e) => e.attacker === 'enemy' && !e.dodged && e.damage > 0)
    expect(new Set(hits.map((e) => e.damage)).size).toBeGreaterThan(1)
  })

  it('stays deterministic with every trait, however elaborate', () => {
    for (const trait of TRAIT_IDS) {
      const run = () => resolveBattle({ player: PLAYER, enemy: enemy({ trait }), rewards: REWARDS })
      const first = JSON.stringify(run())
      for (let i = 0; i < 20; i++) expect(JSON.stringify(run()), trait).toBe(first)
    }
  })

  it('always ends, for every trait and every plan', () => {
    // The traits that heal, shield and drain are exactly the ones that could
    // make a fight run forever; the healing ramp is what stops them.
    for (const trait of TRAIT_IDS) {
      const result = resolveBattle({
        player: { maxHp: 300, atk: 12, def: 30 },
        enemy: enemy({ trait, maxHp: 4000, atk: 12, def: 8 }),
        rewards: REWARDS,
      })
      expect(['win', 'loss', 'timeout']).toContain(result.outcome)
      expect(result.log.length).toBeLessThan(500)
    }
  })

  it('gives every trait a name and a hint the player can read', () => {
    for (const trait of ENEMY_TRAITS) {
      expect(trait.nameKey.startsWith('trait.')).toBe(true)
      expect(trait.descriptionKey.startsWith('trait.')).toBe(true)
    }
  })
})

describe('boss phases', () => {
  const phased = enemy({
    maxHp: 1000,
    boss: {
      enrageAfterTurn: 6,
      enrageAtkPerTurn: 0.15,
      phases: [
        { atHpBelow: 0.6, labelKey: 'boss.phaseShield', shield: 0.2 },
        { atHpBelow: 0.3, labelKey: 'boss.phaseFrenzy', atkScale: 1.3 },
      ],
    },
  })

  it('enters each phase once, in health order', () => {
    // Strong enough to actually reach the second threshold: the default player
    // dies at about 40% of this boss, having only ever seen the first.
    const strong = { maxHp: 1200, atk: 160, def: 40 }
    const result = resolveBattle({ player: strong, enemy: phased, rewards: REWARDS })
    expect(result.phasesEntered).toBe(2)
    // Two transitions, one banner: the announcement latches so a boss with
    // three phases does not take the log over.
    expect(result.log.filter((e) => e.announce === 'phase')).toHaveLength(1)
  })

  it('sees only the phases the fight actually reaches', () => {
    const weak = { maxHp: 200, atk: 30, def: 5 }
    expect(resolveBattle({ player: weak, enemy: phased, rewards: REWARDS }).phasesEntered).toBeLessThan(2)
  })

  it('never re-enters a phase a heal pushed the boss back above', () => {
    // A fight that could re-enter a phase could re-enter it forever, so the
    // transition is one-way by construction.
    const healing = { ...phased, trait: 'mending' as const }
    const result = resolveBattle({ player: PLAYER, enemy: healing, rewards: REWARDS })
    expect(result.phasesEntered).toBeLessThanOrEqual(2)
  })

  it('reports zero phases for a boss that only enrages', () => {
    const plain = enemy({ boss: { enrageAfterTurn: 6, enrageAtkPerTurn: 0.15 } })
    expect(resolveBattle({ player: PLAYER, enemy: plain, rewards: REWARDS }).phasesEntered).toBe(0)
  })

  it('ramps phase count with depth across the campaign', () => {
    const phasesAt = (order: number) =>
      STAGES[order - 1].enemy.boss?.phases?.length ?? 0
    // Early bosses teach enrage alone; the tools to answer a transformation
    // do not exist yet at World 2.
    expect(phasesAt(10)).toBe(0)
    expect(phasesAt(50)).toBe(1)
    expect(phasesAt(70)).toBe(2)
    expect(phasesAt(100)).toBe(3)
  })

  it('gives every boss in the campaign a phase list its world implies', () => {
    for (const world of WORLDS) {
      const boss = world.boss
      expect(isBossStage(boss)).toBe(true)
      const phases = boss.enemy.boss!.phases ?? []
      for (const phase of phases) {
        expect(phase.atHpBelow).toBeGreaterThan(0)
        expect(phase.atHpBelow).toBeLessThan(1)
        expect(phase.labelKey.startsWith('boss.')).toBe(true)
      }
      // Thresholds have to descend, or a later phase would be unreachable.
      const thresholds = phases.map((p) => p.atHpBelow)
      expect(thresholds).toEqual([...thresholds].sort((a, b) => b - a))
    }
  })

  it('keeps the whole campaign deterministic, phases and all', () => {
    for (const world of WORLDS) {
      const stage = world.boss
      const run = () =>
        JSON.stringify(
          resolveBattle({ player: { maxHp: 2000, atk: 200, def: 60 }, enemy: stage.enemy, rewards: stage.rewards }),
        )
      expect(run(), stage.id).toBe(run())
    }
  })
})

describe('trait coverage across the campaign', () => {
  it('holds the first twelve worlds to the traits they were balanced with', () => {
    // Those worlds were tuned before the richer traits existed; changing them
    // would silently re-balance a stretch nobody asked to re-balance.
    const early = new Set(STAGES.slice(0, 60).map((s) => s.enemy.trait))
    expect([...early].sort()).toEqual(['fierce', 'mending', 'slippery', 'straightforward'])
  })

  it('uses every new trait somewhere in the back half', () => {
    const late = new Set(STAGES.slice(60).map((s) => s.enemy.trait))
    for (const trait of ['armored', 'venomous', 'countering', 'disruptive', 'vampiric', 'shielded', 'unstable', 'phasebound']) {
      expect(late.has(trait as never), `${trait} is never used`).toBe(true)
    }
  })

  it('never starts a boss on the trait its own last phase would swap it to', () => {
    // Doubling up made those fights a dodge wall from turn one, and cost five
    // of six kin twenty-plus replays each.
    for (const world of WORLDS) {
      const boss = world.boss.enemy
      const swaps = (boss.boss?.phases ?? []).map((p) => p.trait).filter(Boolean)
      expect(swaps, `${world.boss.id} starts on a trait it swaps to`).not.toContain(boss.trait)
    }
  })

  it('leaves every trait reachable through traitOf', () => {
    for (const id of TRAIT_IDS) expect(traitOf(id).id).toBe(id)
    expect(traitOf(undefined).id).toBe('straightforward')
  })
})
