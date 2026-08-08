import { describe, it, expect } from 'vitest'
import {
  CATCH_UP_MULTIPLIER,
  FRONTIER_BAND,
  MAX_EQUIP_RANK,
  RANK_WINS,
  WINS_FOR_MAX,
  bestOwnedWins,
  creditsMastery,
  equipRank,
  masteryStatScale,
  rankForWins,
  recordFightWon,
  sanitizeEquipmentMastery,
  statScaleForRank,
  winsToNextRank,
} from '../src/systems/equipmentMastery'
import { STAGES, STAGES_PER_WORLD } from '../src/data/stages'
import { ITEM_BY_ID } from '../src/data/items'
import { createDefaultPlayerState } from '../src/state/playerState'
import { parsePlayerState } from '../src/state/validate'
import { effectiveStats } from '../src/systems/upgrades'
import { towerFloor } from '../src/data/tower'
import { SAVE_SCHEMA_VERSION } from '../src/types'
import type { PlayerState } from '../src/types'

function hero(patch: Partial<PlayerState> = {}): PlayerState {
  return { ...createDefaultPlayerState('Mast'), ...patch }
}

/** A hero standing at `world`, wearing one piece. */
function standing(world: number, itemId = 'iron-sword'): PlayerState {
  return hero({
    ownedItemIds: [itemId],
    equipped: { ...createDefaultPlayerState().equipped, weapon: itemId },
    stageProgress: {
      highestUnlocked: (world - 1) * STAGES_PER_WORLD + 1,
      completedStageIds: STAGES.slice(0, (world - 1) * STAGES_PER_WORLD).map((s) => s.id),
    },
  })
}

describe('equipment mastery ranks', () => {
  it('starts every piece at rank 1 with nothing recorded', () => {
    const state = hero()
    expect(state.equipmentMastery).toEqual({})
    expect(equipRank(state, 'iron-sword')).toBe(1)
    expect(masteryStatScale(state, 'iron-sword')).toBe(1)
  })

  it('climbs exactly at the published thresholds and never between them', () => {
    RANK_WINS.forEach((wins, i) => {
      expect(rankForWins(wins), `${wins} wins`).toBe(i + 1)
      if (wins > 0) expect(rankForWins(wins - 1), `${wins - 1} wins`).toBe(i)
    })
    expect(rankForWins(WINS_FOR_MAX * 10)).toBe(MAX_EQUIP_RANK)
  })

  it('reports what the next rank costs, and nothing at the top', () => {
    expect(winsToNextRank(0)).toBe(RANK_WINS[1])
    expect(winsToNextRank(RANK_WINS[1] - 1)).toBe(1)
    expect(winsToNextRank(WINS_FOR_MAX)).toBeNull()
  })

  it('pays out at only two of the five ranks, and caps at +6%', () => {
    // The plan is explicit that mastery must not make a player afraid to try
    // new gear: ranks 3 and 5 are the rank itself and nothing more.
    const scales = Array.from({ length: MAX_EQUIP_RANK }, (_, i) => statScaleForRank(i + 1))
    expect(scales[0]).toBe(1)
    expect(new Set(scales).size).toBe(3)
    expect(Math.max(...scales)).toBeCloseTo(1.06, 5)
    // Monotonic: a rank can never be worth less than the one below it.
    for (let i = 1; i < scales.length; i += 1) expect(scales[i]).toBeGreaterThanOrEqual(scales[i - 1])
  })

  it('is worth only a few points even fully mastered', () => {
    // Guards the design intent with a number rather than a comment: swapping to
    // a fresh piece must cost close to nothing.
    const mail = ITEM_BY_ID.get('bastion-mail')!
    const base = hero({ ownedItemIds: ['bastion-mail'], equipped: { ...hero().equipped, body: 'bastion-mail' } })
    const mastered = { ...base, equipmentMastery: { 'bastion-mail': WINS_FOR_MAX } }
    const gained = effectiveStats(mastered).maxHp - effectiveStats(base).maxHp
    expect(gained).toBeGreaterThan(0)
    expect(gained).toBeLessThanOrEqual(Math.ceil((mail.bonus.hp ?? 0) * 0.06))
  })
})

describe('what a fight is worth', () => {
  it('credits every worn piece for a fight at the frontier', () => {
    const state = standing(5)
    const next = recordFightWon(state, STAGES[(5 - 1) * STAGES_PER_WORLD])
    expect(next.equipmentMastery['iron-sword']).toBe(1)
  })

  it('pays nothing for grinding the opening world at the end of the game', () => {
    // The plan's own requirement: farming Stage 1 late must not earn mastery.
    const late = standing(20)
    expect(creditsMastery(late, STAGES[0])).toBe(false)
    expect(recordFightWon(late, STAGES[0])).toBe(late)
  })

  it('still counts the worlds just behind the frontier, not only the newest', () => {
    const state = standing(10)
    const bandEdge = STAGES[(10 - FRONTIER_BAND - 1) * STAGES_PER_WORLD]
    const tooFar = STAGES[(10 - FRONTIER_BAND - 2) * STAGES_PER_WORLD]
    expect(creditsMastery(state, bandEdge)).toBe(true)
    expect(creditsMastery(state, tooFar)).toBe(false)
  })

  it('always counts a tower floor, because the tower scales to the player', () => {
    const late = standing(20)
    expect(creditsMastery(late, towerFloor(1))).toBe(true)
    expect(recordFightWon(late, towerFloor(1)).equipmentMastery['iron-sword']).toBe(1)
  })

  it('does nothing at all when the hero is wearing nothing', () => {
    const bare = hero({
      stageProgress: { highestUnlocked: 1, completedStageIds: [] },
    })
    expect(recordFightWon(bare, STAGES[0])).toBe(bare)
  })

  it('never walks a count past the top of the track', () => {
    const state = { ...standing(1), equipmentMastery: { 'iron-sword': WINS_FOR_MAX } }
    expect(recordFightWon(state, STAGES[0]).equipmentMastery['iron-sword']).toBe(WINS_FOR_MAX)
  })
})

describe('catch-up', () => {
  it('doubles the rate for a piece behind the player’s best', () => {
    const state = {
      ...standing(1, 'iron-sword'),
      ownedItemIds: ['iron-sword', 'knight-blade'],
      equipmentMastery: { 'knight-blade': 40 },
    }
    const next = recordFightWon(state, STAGES[0])
    expect(bestOwnedWins(state)).toBe(40)
    expect(next.equipmentMastery['iron-sword']).toBe(CATCH_UP_MULTIPLIER)
  })

  it('stops doubling once the piece has caught up', () => {
    const state = {
      ...standing(1, 'iron-sword'),
      ownedItemIds: ['iron-sword'],
      equipmentMastery: { 'iron-sword': 40 },
    }
    expect(recordFightWon(state, STAGES[0]).equipmentMastery['iron-sword']).toBe(41)
  })

  it('measures every worn piece against one bar, not against each other', () => {
    // Reading the bar inside the loop would make the result depend on slot
    // order: whichever piece was credited first could lift the bar for the next.
    const base = createDefaultPlayerState()
    const state: PlayerState = {
      ...standing(1),
      ownedItemIds: ['iron-sword', 'iron-helm', 'knight-blade'],
      equipped: { ...base.equipped, weapon: 'iron-sword', head: 'iron-helm' },
      equipmentMastery: { 'knight-blade': 50 },
    }
    const next = recordFightWon(state, STAGES[0])
    expect(next.equipmentMastery['iron-sword']).toBe(CATCH_UP_MULTIPLIER)
    expect(next.equipmentMastery['iron-helm']).toBe(CATCH_UP_MULTIPLIER)
  })
})

describe('an untrusted mastery block', () => {
  it('cannot claim more wins than the hero has ever won', () => {
    // The bound that matters: a fresh save arriving with everything mastered.
    const clean = sanitizeEquipmentMastery({ 'iron-sword': WINS_FOR_MAX }, 0)
    expect(clean).toEqual({})
    expect(sanitizeEquipmentMastery({ 'iron-sword': WINS_FOR_MAX }, 12)['iron-sword']).toBe(12)
  })

  it('drops unknown items, junk values and negatives', () => {
    const clean = sanitizeEquipmentMastery(
      { 'not-an-item': 50, 'iron-sword': -5, 'iron-helm': 'lots', 'knight-blade': 20 },
      999,
    )
    expect(clean).toEqual({ 'knight-blade': 20 })
  })

  it('survives a garbage block entirely', () => {
    expect(sanitizeEquipmentMastery(null, 10)).toEqual({})
    expect(sanitizeEquipmentMastery('mastered!', 10)).toEqual({})
    expect(sanitizeEquipmentMastery([1, 2, 3], 10)).toEqual({})
  })

  it('clamps a wildly inflated count to the top of the track', () => {
    expect(sanitizeEquipmentMastery({ 'iron-sword': 1e9 }, 1e9)['iron-sword']).toBe(WINS_FOR_MAX)
  })
})

describe('save migration', () => {
  it('loads a v17 save with no mastery block and starts every piece at rank 1', () => {
    const old = createDefaultPlayerState('Vet') as Partial<PlayerState> & Record<string, unknown>
    old.schemaVersion = 17
    delete old.equipmentMastery
    const migrated = parsePlayerState(old)!
    expect(migrated.schemaVersion).toBe(SAVE_SCHEMA_VERSION)
    expect(migrated.equipmentMastery).toEqual({})
    expect(equipRank(migrated, 'iron-sword')).toBe(1)
  })

  it('keeps a legitimate block through a round trip', () => {
    const saved = {
      ...createDefaultPlayerState('Vet'),
      lifetime: { battlesWon: 500, goldEarned: 0 },
      equipmentMastery: { 'iron-sword': 30 },
    }
    expect(parsePlayerState(saved)!.equipmentMastery).toEqual({ 'iron-sword': 30 })
  })
})
