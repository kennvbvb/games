import { describe, it, expect } from 'vitest'
import {
  CONTRACTS_PER_WEEK,
  CONTRACTS_TO_CLEAR,
  CONTRACT_GRACE_WEEKS,
  CONTRACT_POOL,
  CONTRACT_REWARD,
  MS_PER_WEEK,
  contractWeek,
  contractsForWeek,
} from '../src/data/contracts'
import {
  claimContracts,
  claimableWeeks,
  clearedThisWeek,
  contractViews,
  currentContracts,
  recordContractWin,
  sanitizeContracts,
  weekComplete,
} from '../src/systems/contracts'
import { STAGES } from '../src/data/stages'
import { WORLDS } from '../src/data/worlds'
import { towerFloor } from '../src/data/tower'
import { remixStage } from '../src/data/bossRemix'
import { createDefaultPlayerState } from '../src/state/playerState'
import { parsePlayerState } from '../src/state/validate'
import { SAVE_SCHEMA_VERSION } from '../src/types'
import type { BattleResult, PlayerState, StageConfig } from '../src/types'

const NOW = 40 * MS_PER_WEEK + 1000
const WEEK = contractWeek(NOW)

function hero(patch: Partial<PlayerState> = {}): PlayerState {
  return {
    ...createDefaultPlayerState('Con'),
    contracts: { week: WEEK, counts: [], unclaimed: [] },
    ...patch,
  }
}

function win(hpLeft = 100, maxHp = 100): BattleResult {
  return {
    outcome: 'win',
    win: true,
    log: [],
    playerHpLeft: hpLeft,
    playerMaxHp: maxHp,
    enemyHpLeft: 0,
    shieldLeft: 0,
    phasesEntered: 0,
    rewards: { exp: 0, gold: 0 },
  }
}

/** Fights the given contract slot until it is finished. */
function grind(state: PlayerState, slot: number, stage: StageConfig, plan = 'brave' as const): PlayerState {
  const target = contractsForWeek(WEEK)[slot].target
  let current = state
  for (let i = 0; i < target; i += 1) {
    current = recordContractWin(current, stage, win(), plan, NOW)
  }
  return current
}

describe('the week on offer', () => {
  it('offers three, and always the same three for a given week', () => {
    expect(contractsForWeek(WEEK)).toHaveLength(CONTRACTS_PER_WEEK)
    expect(contractsForWeek(WEEK)).toEqual(contractsForWeek(WEEK))
  })

  it('never offers the same job twice in one week', () => {
    for (let week = 0; week < 60; week += 1) {
      const ids = contractsForWeek(week).map((c) => c.id)
      expect(new Set(ids).size, `week ${week}`).toBe(ids.length)
    }
  })

  it('does not simply re-offer most of last week', () => {
    // A window that slides by one would make three quarters of every week a
    // repeat, which is the failure mode a stride exists to avoid.
    let repeats = 0
    for (let week = 1; week < 60; week += 1) {
      const prev = new Set(contractsForWeek(week - 1).map((c) => c.id))
      repeats += contractsForWeek(week).filter((c) => prev.has(c.id)).length
    }
    expect(repeats / 59).toBeLessThan(CONTRACTS_PER_WEEK - 1)
  })

  it('draws only from jobs a player is already doing', () => {
    for (const contract of CONTRACT_POOL) {
      expect(contract.target).toBeGreaterThan(0)
      expect(contract.labelKey.startsWith('contract.')).toBe(true)
    }
  })
})

describe('progress', () => {
  it('counts only the fights a contract actually asked for', () => {
    const state = hero()
    const configs = contractsForWeek(WEEK)
    const planSlot = configs.findIndex((c) => c.kind === 'winsWithPlan')
    if (planSlot < 0) return

    const wrongPlan = configs[planSlot].plan === 'cozy' ? 'brave' : 'cozy'
    const after = recordContractWin(state, STAGES[0], win(), wrongPlan, NOW)
    expect(contractViews(after, NOW)[planSlot].count).toBe(0)

    const right = recordContractWin(state, STAGES[0], win(), configs[planSlot].plan!, NOW)
    expect(contractViews(right, NOW)[planSlot].count).toBe(1)
  })

  it('ignores a loss entirely', () => {
    const state = hero()
    const lost = { ...win(), win: false, outcome: 'loss' as const }
    expect(recordContractWin(state, STAGES[0], lost, 'brave', NOW)).toBe(state)
  })

  it('never counts past a contract’s own target', () => {
    const state = grind(hero(), 0, towerFloor(3))
    const before = contractViews(state, NOW)[0].count
    const after = grind(state, 0, towerFloor(3))
    expect(contractViews(after, NOW)[0].count).toBe(before)
  })

  it('feeds every mode from the one place a fight finishes', () => {
    // Whichever three this week offers, each is satisfiable by *some* fight —
    // a contract nothing can complete is a contract that fails the week.
    const stages = [STAGES[0], WORLDS[0].boss, towerFloor(4), remixStage(3, 'normal')]
    for (const [slot, config] of contractsForWeek(WEEK).entries()) {
      const moved = stages.some((stage) =>
        ['brave', 'cozy', 'clever'].some(
          (plan) =>
            contractViews(recordContractWin(hero(), stage, win(), plan as never, NOW), NOW)[slot]
              .count > 0,
        ),
      )
      expect(moved, config.id).toBe(true)
    }
  })

  it('resets the counters when the week turns, but never the unpaid rewards', () => {
    const old = hero({ contracts: { week: WEEK - 1, counts: [5, 5, 5], unclaimed: [WEEK - 1] } })
    const now = currentContracts(old, NOW)
    expect(now.week).toBe(WEEK)
    expect(now.counts).toEqual([])
    expect(now.unclaimed).toEqual([WEEK - 1])
  })
})

describe('two of three pays', () => {
  it('does not pay for one', () => {
    const state = grind(hero(), 0, towerFloor(3))
    expect(clearedThisWeek(state, NOW)).toBeLessThanOrEqual(CONTRACTS_TO_CLEAR)
    if (clearedThisWeek(state, NOW) < CONTRACTS_TO_CLEAR) {
      expect(weekComplete(state, NOW)).toBe(false)
      expect(claimableWeeks(state, NOW)).toEqual([])
    }
  })

  it('queues the week the moment the second one lands, not when the screen opens', () => {
    // A reward that only exists while the player is looking at it is a reward
    // they lose by closing the game.
    let state = hero()
    const configs = contractsForWeek(WEEK)
    const stages: StageConfig[] = [STAGES[0], WORLDS[0].boss, towerFloor(4), remixStage(3, 'normal')]
    for (const [slot, config] of configs.entries()) {
      for (const stage of stages) {
        for (const plan of ['brave', 'cozy', 'clever'] as const) {
          const probe = recordContractWin(state, stage, win(), plan, NOW)
          if (contractViews(probe, NOW)[slot].count > contractViews(state, NOW)[slot].count) {
            for (let i = 0; i < config.target; i += 1) {
              state = recordContractWin(state, stage, win(), plan, NOW)
            }
          }
        }
      }
      if (clearedThisWeek(state, NOW) >= CONTRACTS_TO_CLEAR) break
    }
    expect(weekComplete(state, NOW)).toBe(true)
    expect(claimableWeeks(state, NOW)).toEqual([WEEK])
  })

  it('pays gold and EXP, and pays each week exactly once', () => {
    const state = hero({ contracts: { week: WEEK, counts: [], unclaimed: [WEEK] } })
    const paid = claimContracts(state, NOW)
    expect(paid.gold).toBe(state.gold + CONTRACT_REWARD.gold)
    expect(claimableWeeks(paid, NOW)).toEqual([])
    // Claiming again is a no-op rather than a second payout.
    expect(claimContracts(paid, NOW).gold).toBe(paid.gold)
  })

  it('keeps an unclaimed week waiting through the grace period, then lets it go', () => {
    const banked = hero({ contracts: { week: WEEK, counts: [], unclaimed: [WEEK - 1] } })
    expect(claimableWeeks(banked, NOW)).toEqual([WEEK - 1])

    const stale = hero({
      contracts: { week: WEEK, counts: [], unclaimed: [WEEK - CONTRACT_GRACE_WEEKS] },
    })
    expect(claimableWeeks(stale, NOW)).toEqual([])
  })
})

describe('an untrusted contract block', () => {
  it('cannot claim a week from the future', () => {
    const clean = sanitizeContracts({ week: WEEK + 500, counts: [], unclaimed: [WEEK + 500] }, NOW)
    expect(clean.week).toBe(WEEK)
    expect(clean.unclaimed).toEqual([])
  })

  it('clamps every counter to its own contract’s target', () => {
    const clean = sanitizeContracts({ week: WEEK, counts: [1e9, -4, 'lots'], unclaimed: [] }, NOW)
    contractsForWeek(WEEK).forEach((config, i) => {
      expect(clean.counts[i]).toBeLessThanOrEqual(config.target)
      expect(clean.counts[i]).toBeGreaterThanOrEqual(0)
    })
  })

  it('caps the unpaid queue by both age and length', () => {
    const many = Array.from({ length: 50 }, (_, i) => WEEK - i)
    const clean = sanitizeContracts({ week: WEEK, counts: [], unclaimed: many }, NOW)
    expect(clean.unclaimed.length).toBeLessThanOrEqual(CONTRACT_GRACE_WEEKS)
    for (const w of clean.unclaimed) expect(w).toBeGreaterThan(WEEK - CONTRACT_GRACE_WEEKS)
  })

  it('survives a garbage block entirely', () => {
    for (const junk of [null, 'contracts!', 42, []]) {
      const clean = sanitizeContracts(junk, NOW)
      expect(clean.week).toBe(WEEK)
      expect(clean.unclaimed).toEqual([])
    }
  })
})

describe('save migration', () => {
  it('loads a v18 save with no contract block at all', () => {
    const old = createDefaultPlayerState('Vet') as Partial<PlayerState> & Record<string, unknown>
    old.schemaVersion = 18
    delete old.contracts
    const migrated = parsePlayerState(old)!
    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION)
    expect(migrated.contracts.counts.every((c) => c === 0)).toBe(true)
    expect(migrated.contracts.unclaimed).toEqual([])
  })
})
