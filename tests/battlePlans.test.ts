import { describe, it, expect } from 'vitest'
import { resolveBattle, healScale } from '../src/systems/combat'
import { stageOutlook, planOutlooks, recommendPlan } from '../src/systems/difficulty'
import { PLAN_IDS, normalizePlan, DEFAULT_PLAN } from '../src/data/battlePlans'
import { TRAIT_IDS } from '../src/data/enemyTraits'
import { createDefaultPlayerState } from '../src/state/playerState'
import { parsePlayerState } from '../src/state/validate'
import { effectiveStats } from '../src/systems/upgrades'
import { STAGES } from '../src/data/stages'
import type { EnemyConfig, PlayerStats } from '../src/types'
import type { RaceCombatPassive } from '../src/systems/combat'

const REWARDS = { exp: 10, gold: 5 }

function enemy(over: Partial<EnemyConfig> = {}): EnemyConfig {
  return { name: 'Dummy', sprite: 'enemy_1', maxHp: 400, atk: 30, def: 5, ...over }
}

describe('damage pipeline', () => {
  it('rounds once, so multipliers commute', () => {
    // round(round(4*1.25)*1.30) is 7 but round(round(4*1.30)*1.25) is 6.
    // Rounding once removes that order-dependence entirely.
    const player: PlayerStats = { maxHp: 500, atk: 9, def: 100 }
    const target = enemy({ def: 5, maxHp: 10_000, atk: 1 })
    const brave = resolveBattle({ player, enemy: target, rewards: REWARDS, plan: 'brave' })
    // base 4, x1.25 -> round(5) = 5
    expect(brave.log[0].damage).toBe(5)

    const precise: RaceCombatPassive = { firstStrike: 1.3 }
    const both = resolveBattle({ player, enemy: target, rewards: REWARDS, plan: 'brave', passive: precise })
    // base 4 x 1.25 x 1.30 = 6.5 -> round -> 7, not round(round(4*1.25)*1.3)=7 by luck
    // and not round(round(4*1.3)*1.25)=6, which per-step rounding would give.
    expect(both.log[0].damage).toBe(7)
  })

  it('applies a damage-taken passive multiplicatively, not by subtraction', () => {
    // Cozy 0.65 and Stoneblood 0.95 compound to 0.6175, not 0.60.
    const player: PlayerStats = { maxHp: 5000, atk: 1, def: 0 }
    const target = enemy({ atk: 100, def: 500, maxHp: 100_000 })
    const cozy = resolveBattle({ player, enemy: target, rewards: REWARDS, plan: 'cozy' })
    const both = resolveBattle({
      player,
      enemy: target,
      rewards: REWARDS,
      plan: 'cozy',
      passive: { damageTaken: 0.95 },
    })
    expect(cozy.log[1].damage).toBe(65) // round(100 * 0.65)
    expect(both.log[1].damage).toBe(62) // round(100 * 0.6175), not round(100 * 0.60) = 60
  })

  it('never deals less than 1 except when the blow did not happen', () => {
    for (const plan of PLAN_IDS) {
      for (const trait of TRAIT_IDS) {
        const result = resolveBattle({
          player: { maxHp: 300, atk: 3, def: 3 },
          enemy: enemy({ trait, atk: 4, def: 200, maxHp: 900 }),
          rewards: REWARDS,
          plan,
        })
        for (const event of result.log) {
          // Three ways a blow can land for nothing: it was dodged, the attacker
          // was frozen, or the attacker died to a status before it could swing.
          // Everything else is subject to the minimum-1 floor.
          const missed = event.dodged || event.frozen || event.statusDamage !== undefined
          if (event.dodged) expect(event.damage).toBe(0)
          else if (!missed) expect(event.damage).toBeGreaterThanOrEqual(1)
        }
      }
    }
  })
})

describe('thresholds', () => {
  it('keeps the operators the spec asks for: fierce at exactly half fires, low-HP does not', () => {
    // Fierce is "<= 50%", the low-HP passive is "< 50%". The asymmetry is
    // deliberate; this test exists so nobody tidies it into consistency.
    const atHalf = enemy({ trait: 'fierce', maxHp: 100, atk: 100, def: 0 })
    const player: PlayerStats = { maxHp: 10_000, atk: 50, def: 0 }
    // First player blow takes the enemy 100 -> 50, exactly half. The enemy's
    // reply that turn reads HP before its own blow, so fierce is already on.
    const result = resolveBattle({ player, enemy: atHalf, rewards: REWARDS })
    expect(result.log[1].damage).toBe(145) // round(100 * 1.45)

    // The low-HP passive at exactly half must NOT fire.
    const exactly: PlayerStats = { maxHp: 400, atk: 10, def: 0 }
    const chip = enemy({ maxHp: 100_000, atk: 100, def: 0 })
    const passive: RaceCombatPassive = { lowHp: 2, lowHpBelow: 0.5 }
    const run = resolveBattle({ player: exactly, enemy: chip, rewards: REWARDS, passive })
    // Turn 3's swing opens at exactly 200/400 — half, so no boost.
    expect(run.log[4].damage).toBe(10)
    // Turn 4's opens at 100/400, below half, so it lands.
    expect(run.log[6].damage).toBe(20)
  })
})

describe('counters', () => {
  const player: PlayerStats = { maxHp: 4000, atk: 40, def: 40 }

  it('counts attempted attacks, so a dodged swing still advances a heal', () => {
    // Slippery dodges the 4th player attack; Cozy heals on every 3rd. If the
    // counter only advanced on landed hits, an unrelated trait would silently
    // shift the heal cadence.
    const result = resolveBattle({
      player,
      enemy: enemy({ trait: 'slippery', maxHp: 100_000, atk: 200 }),
      rewards: REWARDS,
      plan: 'cozy',
    })
    const playerBlows = result.log.filter((e) => e.attacker === 'player')
    expect(playerBlows[3].dodged).toBe(true)
    // Heals land on player attacks 3, 6, 9 regardless of the dodge at 4.
    expect(playerBlows[2].healed).toBeGreaterThan(0)
    expect(playerBlows[5].healed).toBeGreaterThan(0)
  })

  it('lets a dodge eat a combo without banking it for the next swing', () => {
    // Clever combos on every 3rd attack, Slippery dodges every 4th, so they
    // collide at attack 12. The combo is a property of the counter, not of
    // whether the blow landed.
    const result = resolveBattle({
      player,
      enemy: enemy({ trait: 'slippery', maxHp: 500_000, atk: 1 }),
      rewards: REWARDS,
      plan: 'clever',
    })
    const blows = result.log.filter((e) => e.attacker === 'player')
    expect(blows[11].dodged).toBe(true) // attack 12: combo turn AND dodge turn
    expect(blows[12].crit).toBeUndefined() // attack 13 is an ordinary swing
    expect(blows[14].crit).toBe(true) // attack 15 is the next real combo
  })

  it('merges two heals landing on the same blow into one', () => {
    // Cozy Guard 6% and a 3% racial heal share the third-attack tick. One
    // event, one rounding — not 6% then 3% computed separately.
    const result = resolveBattle({
      player: { maxHp: 1000, atk: 1, def: 0 },
      // Deals enough that there is room to heal by the third swing; healing is
      // clamped to the gap, so a full-health hero would show a smaller number.
      // 80 attack softened to round(80 * 0.65) = 52 a turn, so two blows open
      // 104 points of room — more than the merged heal needs.
      enemy: enemy({ maxHp: 100_000, atk: 80, def: 0 }),
      rewards: REWARDS,
      plan: 'cozy',
      passive: { heal: 0.03, healEvery: 3 },
    })
    const healed = result.log.filter((e) => e.healed !== undefined)
    expect(healed[0].healed).toBe(90) // round(1000 * 0.09), as one heal not two
    expect(healed[0].selfHpAfter).toBe(986) // 1000 - 104 + 90
  })

  it('spends a first-strike bonus only on a blow that lands', () => {
    const result = resolveBattle({
      player,
      enemy: enemy({ trait: 'slippery', maxHp: 500_000, atk: 1 }),
      rewards: REWARDS,
      passive: { firstStrike: 1.3 },
    })
    const blows = result.log.filter((e) => e.attacker === 'player')
    expect(blows[0].crit).toBe(true)
    expect(blows[1].crit).toBeUndefined()
  })
})

describe('healing bounds', () => {
  it('never lets a side exceed its own maximum', () => {
    const result = resolveBattle({
      player: { maxHp: 500, atk: 1, def: 10_000 },
      enemy: enemy({ trait: 'mending', maxHp: 500, atk: 1, def: 0 }),
      rewards: REWARDS,
      plan: 'cozy',
    })
    for (const event of result.log) {
      if (event.selfHpAfter === undefined) continue
      const max = event.attacker === 'player' ? 500 : 500
      expect(event.selfHpAfter).toBeLessThanOrEqual(max)
    }
  })

  it('fades healing out entirely by the attrition turn', () => {
    expect(healScale(1)).toBe(1)
    expect(healScale(20)).toBe(1)
    expect(healScale(30)).toBeCloseTo(0.5)
    expect(healScale(40)).toBe(0)
    expect(healScale(999)).toBe(0)
  })

  it('ends a fight that healing alone would otherwise make endless', () => {
    // Both sides chip for the minimum and both mend faster than they are hurt,
    // so without the attrition ramp neither could ever die — and the turn cap
    // would then score an unlosable fight as a defeat.
    const result = resolveBattle({
      player: { maxHp: 120, atk: 1, def: 1000 },
      enemy: enemy({ trait: 'mending', maxHp: 120, atk: 30, def: 1000 }),
      rewards: REWARDS,
      plan: 'cozy',
      passive: { heal: 0.03, healEvery: 3 },
    })
    expect(result.outcome).not.toBe('timeout')
    // Healing keeps it alive well past where a plain 1-per-turn trade would end.
    expect(result.log[result.log.length - 1].turn).toBeGreaterThan(40)
  })

  it('calls a fight nobody can finish a stalemate, not a defeat', () => {
    // Huge health pools and minimum damage: the ramp cannot help, because the
    // problem is reach, not healing. Saying "you lost" here would be wrong —
    // and the stage preview and offline payout would repeat it.
    const result = resolveBattle({
      player: { maxHp: 5000, atk: 1, def: 1000 },
      enemy: enemy({ maxHp: 5000, atk: 1, def: 1000 }),
      rewards: REWARDS,
    })
    expect(result.outcome).toBe('timeout')
    expect(result.win).toBe(false)
    expect(result.playerHpLeft).toBeGreaterThan(0)
    expect(result.enemyHpLeft).toBeGreaterThan(0)
    expect(result.rewards).toEqual({ exp: 0, gold: 0 })
  })
})

describe('outcome', () => {
  it('keeps win as a plain alias so reward code needs no special case', () => {
    for (const plan of PLAN_IDS) {
      const won = resolveBattle({
        player: { maxHp: 900, atk: 200, def: 90 },
        enemy: enemy(),
        rewards: REWARDS,
        plan,
      })
      expect(won.win).toBe(won.outcome === 'win')
      expect(won.rewards).toEqual(REWARDS)

      const lost = resolveBattle({
        player: { maxHp: 10, atk: 1, def: 0 },
        enemy: enemy({ atk: 500 }),
        rewards: REWARDS,
        plan,
      })
      expect(lost.win).toBe(false)
      expect(lost.rewards).toEqual({ exp: 0, gold: 0 })
    }
  })

  it('reports final HP directly rather than leaving it to be re-derived', () => {
    const result = resolveBattle({
      player: { maxHp: 600, atk: 30, def: 10 },
      enemy: enemy(),
      rewards: REWARDS,
      plan: 'cozy',
    })
    const lastAgainstPlayer = [...result.log].reverse().find((e) => e.attacker === 'enemy')
    // With healing on a player-attacker event, the last blow against the player
    // is no longer the final word — which is exactly why this is returned.
    expect(result.playerHpLeft).toBeGreaterThanOrEqual(0)
    expect(lastAgainstPlayer).toBeDefined()
  })

  it('is deterministic for every plan and trait pairing', () => {
    for (const plan of PLAN_IDS) {
      for (const trait of TRAIT_IDS) {
        const ctx = {
          player: { maxHp: 320, atk: 26, def: 9 },
          enemy: enemy({ trait }),
          rewards: REWARDS,
          plan,
        }
        expect(resolveBattle(ctx)).toEqual(resolveBattle(ctx))
      }
    }
  })
})

describe('forecast', () => {
  const state = { ...createDefaultPlayerState('Hero'), level: 8, stats: { maxHp: 200, atk: 40, def: 12 } }

  it('matches the fight the battle scene would actually run', () => {
    // This contract is asserted in three separate comments and has never had a
    // direct test. It is the reason combat must stay free of randomness.
    for (const stage of STAGES) {
      for (const plan of PLAN_IDS) {
        const outlook = stageOutlook(state, stage, plan)
        const fight = resolveBattle({
          player: effectiveStats(state),
          enemy: stage.enemy,
          rewards: stage.rewards,
          plan,
        })
        expect(outlook.willWin).toBe(fight.win)
        expect(outlook.hpRemaining).toBeCloseTo(fight.playerHpLeft / effectiveStats(state).maxHp)
      }
    }
  })

  it('previews the plan saved on the state when none is named', () => {
    const cozy = { ...state, settings: { ...state.settings, battlePlan: 'cozy' as const } }
    expect(stageOutlook(cozy, STAGES[5])).toEqual(stageOutlook(cozy, STAGES[5], 'cozy'))
  })

  it('offers one outlook per plan', () => {
    const outlooks = planOutlooks(state, STAGES[0])
    expect(Object.keys(outlooks).sort()).toEqual([...PLAN_IDS].sort())
  })

  it('recommends nothing when no plan clears the stage', () => {
    const weak = { ...createDefaultPlayerState('Weak'), stats: { maxHp: 12, atk: 1, def: 0 } }
    expect(recommendPlan(weak, STAGES[STAGES.length - 1])).toBeNull()
  })

  it('recommends a plan that actually wins', () => {
    const strong = { ...state, stats: { maxHp: 4000, atk: 400, def: 200 } }
    const best = recommendPlan(strong, STAGES[0])
    expect(best).not.toBeNull()
    expect(best!.outlook.willWin).toBe(true)
  })
})

describe('saved plan', () => {
  it('defaults to the plan closest to plain trading of blows', () => {
    expect(createDefaultPlayerState('Hero').settings.battlePlan).toBe(DEFAULT_PLAN)
  })

  it('falls back rather than trusting an unknown plan from a save', () => {
    expect(normalizePlan('nonsense')).toBe(DEFAULT_PLAN)
    expect(normalizePlan(undefined)).toBe(DEFAULT_PLAN)
    expect(normalizePlan('cozy')).toBe('cozy')
  })

  it('gives a pre-v10 save the default without disturbing anything else', () => {
    const legacy = { ...createDefaultPlayerState('Hero'), gold: 250, level: 7 }
    // @ts-expect-error simulating a save written before plans existed
    delete legacy.settings.battlePlan
    const parsed = parsePlayerState(legacy)!
    expect(parsed.settings.battlePlan).toBe(DEFAULT_PLAN)
    expect(parsed.gold).toBe(250)
    expect(parsed.level).toBe(7)
  })
})
