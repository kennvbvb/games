import { describe, it, expect } from 'vitest'
import {
  REMIX_RELIC_BOSSES,
  REMIX_TIERS,
  isRemixStageId,
  parseRemixStageId,
  relicForRemix,
  remixAttack,
  remixHealth,
  remixStage,
  remixStageId,
  secondTrait,
} from '../src/data/bossRemix'
import {
  canFightRemix,
  grantRemixRelic,
  pendingRemixRelic,
  remixRelicsWon,
  remixUnlocked,
  unlockedRemixWorlds,
  unlockedTiers,
} from '../src/systems/bossRemix'
import { WORLDS, BOSS_STAGE_IDS } from '../src/data/worlds'
import { STAGES } from '../src/data/stages'
import { ITEMS, ITEM_BY_ID, SHOP_ITEMS } from '../src/data/items'
import { STAGE_BY_ID } from '../src/data/stages'
import { createDefaultPlayerState } from '../src/state/playerState'
import { parsePlayerState } from '../src/state/validate'
import { buyItem } from '../src/systems/upgrades'
import type { PlayerState } from '../src/types'

/** A hero who has cleared every stage up to and including world `through`. */
function through(worlds: number, patch: Partial<PlayerState> = {}): PlayerState {
  const cleared = WORLDS.slice(0, worlds).flatMap((w) => w.stages.map((s) => s.id))
  return {
    ...createDefaultPlayerState('Rem'),
    level: 40,
    stageProgress: { highestUnlocked: cleared.length + 1, completedStageIds: cleared },
    ...patch,
  }
}

describe('what a remix is', () => {
  it('reuses the campaign bosses rather than inventing new ones', () => {
    for (const world of WORLDS) {
      const stage = remixStage(world.index, 'normal')
      expect(stage.enemy.name).toBe(world.boss.enemy.name)
      expect(stage.enemy.sprite).toBe(world.boss.enemy.sprite)
    }
  })

  it('is harder than the campaign fight even at the gentlest tier', () => {
    // A "Normal" that re-ran the boss unchanged would be a fight already proven.
    for (const world of [1, 10, 20]) {
      const campaign = WORLDS[world - 1].boss.enemy
      const remix = remixStage(world, 'normal').enemy
      expect(remix.maxHp).toBeGreaterThan(campaign.maxHp)
      expect(remix.atk).toBeGreaterThan(campaign.atk)
    }
  })

  it('anchors the gated tiers to an endgame hero, not to a campaign number', () => {
    // The measurement that forced this: a finished-campaign hero carries 134-178
    // defence, and x1.45 of the World 20 boss's attack is 131. Every blow would
    // land for exactly 1. So Veteran and Mythic carry their own floors, and the
    // floor has to be what actually applies at the late bosses.
    for (const tier of REMIX_TIERS.filter((t) => t.atkFloor)) {
      for (const world of [5, 20]) {
        const scaled = Math.round(WORLDS[world - 1].boss.enemy.atk * tier.atk)
        expect(remixAttack(world, tier), `${tier.id} w${world}`).toBeGreaterThan(scaled)
        expect(remixAttack(world, tier)).toBeGreaterThan(180)
        expect(remixHealth(world, tier)).toBeGreaterThan(
          Math.round(WORLDS[world - 1].boss.enemy.maxHp * tier.hp),
        )
      }
    }
    // Normal keeps the multiplier: it opens after one world boss, so it is
    // fought from anywhere in the campaign and must scale with the player.
    const normal = REMIX_TIERS[0]
    expect(normal.atkFloor).toBeUndefined()
    expect(remixAttack(3, normal)).toBe(Math.round(WORLDS[2].boss.enemy.atk * normal.atk))
  })

  it('climbs with the tier, in health, attack and reward alike', () => {
    const stages = REMIX_TIERS.map((tier) => remixStage(7, tier.id))
    for (let i = 1; i < stages.length; i += 1) {
      expect(stages[i].enemy.maxHp).toBeGreaterThan(stages[i - 1].enemy.maxHp)
      expect(stages[i].enemy.atk).toBeGreaterThan(stages[i - 1].enemy.atk)
      expect(stages[i].rewards.gold).toBeGreaterThan(stages[i - 1].rewards.gold)
    }
  })

  it('never scales defence, which is the trap the tower had to be measured out of', () => {
    for (const tier of REMIX_TIERS) {
      for (const world of [1, 10, 20]) {
        expect(remixStage(world, tier.id).enemy.def).toBe(WORLDS[world - 1].boss.enemy.def)
      }
    }
  })

  it('pairs a second trait onto every boss, and never the one it already had', () => {
    for (const world of WORLDS) {
      const stage = remixStage(world.index, 'normal')
      const swap = stage.enemy.boss!.phases!.find((phase) => phase.trait !== undefined)
      expect(swap, `world ${world.index}`).toBeDefined()
      expect(swap!.trait).not.toBe(stage.enemy.trait)
    }
  })

  it('is deterministic — the same remix on every device and every run', () => {
    for (const world of [3, 11, 19]) {
      expect(remixStage(world, 'mythic')).toEqual(remixStage(world, 'mythic'))
      expect(secondTrait(world, undefined)).toBe(secondTrait(world, undefined))
    }
  })
})

describe('remix ids stay out of the campaign namespace', () => {
  it('never collides with a stage, a tower floor or a rift', () => {
    for (const world of WORLDS) {
      for (const tier of REMIX_TIERS) {
        const id = remixStageId(world.index, tier.id)
        expect(isRemixStageId(id)).toBe(true)
        expect(STAGE_BY_ID.has(id)).toBe(false)
        expect(id.startsWith('stage-')).toBe(false)
        expect(id.startsWith('tower-')).toBe(false)
        expect(id.startsWith('rift-')).toBe(false)
      }
    }
  })

  it('round-trips through its own id, and refuses anything else', () => {
    expect(parseRemixStageId(remixStageId(9, 'veteran'))).toEqual({ world: 9, tier: 'veteran' })
    expect(parseRemixStageId('stage-9')).toBeUndefined()
    expect(parseRemixStageId('remix-999-mythic')).toBeUndefined()
    expect(parseRemixStageId('remix-9-legendary')).toBeUndefined()
    expect(parseRemixStageId('remix-nonsense-mythic')).toBeUndefined()
  })

  it('is dropped by the validator if a save tries to log one as progress', () => {
    const forged = {
      ...createDefaultPlayerState('Cheat'),
      stageProgress: { highestUnlocked: 1, completedStageIds: [remixStageId(3, 'mythic'), 'stage-1'] },
    }
    expect(parsePlayerState(forged)!.stageProgress.completedStageIds).toEqual(['stage-1'])
  })
})

describe('everything about a remix is derived', () => {
  it('opens a boss only once that boss has actually been beaten', () => {
    expect(remixUnlocked(through(0))).toBe(false)
    expect(unlockedRemixWorlds(through(0))).toEqual([])
    expect(unlockedRemixWorlds(through(3))).toEqual([1, 2, 3])
    expect(canFightRemix(through(3), 3, 'normal')).toBe(true)
    expect(canFightRemix(through(3), 4, 'normal')).toBe(false)
  })

  it('gates the harder tiers behind the campaign rather than behind a counter', () => {
    expect(unlockedTiers(through(3)).map((t) => t.id)).toEqual(['normal'])
    expect(unlockedTiers(through(12)).map((t) => t.id)).toEqual(['normal', 'veteran'])
    expect(unlockedTiers(through(20)).map((t) => t.id)).toEqual(['normal', 'veteran', 'mythic'])
  })

  it('is retroactive: a save from before it existed arrives with it already open', () => {
    // The whole reason the mode stores nothing. A finished campaign opens every
    // boss and every tier the moment the feature ships.
    const veteran = through(20)
    expect(unlockedRemixWorlds(veteran)).toHaveLength(WORLDS.length)
    expect(unlockedTiers(veteran)).toHaveLength(REMIX_TIERS.length)
  })

  it('adds no field to the save at all', () => {
    const fresh = createDefaultPlayerState('New') as Record<string, unknown>
    expect(Object.keys(fresh).filter((k) => k.toLowerCase().includes('remix'))).toEqual([])
  })
})

describe('remix relics', () => {
  it('pays six, one per boss, only at the top tier', () => {
    expect(REMIX_RELIC_BOSSES).toHaveLength(6)
    for (const { world, itemId } of REMIX_RELIC_BOSSES) {
      expect(BOSS_STAGE_IDS).toContain(WORLDS[world - 1].boss.id)
      expect(ITEM_BY_ID.get(itemId)?.source).toBe('remix')
      expect(relicForRemix(world, 'mythic')).toBe(itemId)
      // The lower tiers are the run-up, not a second way to the same prize.
      expect(relicForRemix(world, 'normal')).toBeUndefined()
      expect(relicForRemix(world, 'veteran')).toBeUndefined()
    }
  })

  it('gives every remix-sourced piece a boss that pays it', () => {
    const paid = new Set(REMIX_RELIC_BOSSES.map((r) => r.itemId))
    const sourced = ITEMS.filter((i) => i.source === 'remix')
    for (const item of sourced) expect(paid, item.id).toContain(item.id)
    expect(paid.size).toBe(sourced.length)
  })

  it('treats ownership as the first-clear record', () => {
    const hero = through(20)
    const first = REMIX_RELIC_BOSSES[0]
    expect(pendingRemixRelic(hero, first.world, 'mythic')).toBe(first.itemId)

    const won = grantRemixRelic(hero, remixStageId(first.world, 'mythic'))
    expect(won.ownedItemIds).toContain(first.itemId)
    expect(pendingRemixRelic(won, first.world, 'mythic')).toBeUndefined()
    // Second clear hands over nothing, so the bag cannot grow a duplicate.
    expect(grantRemixRelic(won, remixStageId(first.world, 'mythic'))).toBe(won)
    expect(remixRelicsWon(won)).toBe(1)
  })

  it('pays nothing on a boss with no relic, or on a lower tier', () => {
    const hero = through(20)
    const barren = WORLDS.map((w) => w.index).find((w) => !REMIX_RELIC_BOSSES.some((r) => r.world === w))!
    expect(grantRemixRelic(hero, remixStageId(barren, 'mythic'))).toBe(hero)
    expect(grantRemixRelic(hero, remixStageId(REMIX_RELIC_BOSSES[0].world, 'veteran'))).toBe(hero)
    expect(grantRemixRelic(hero, 'stage-5')).toBe(hero)
  })

  it('cannot be bought at any level or any pile of gold', () => {
    const rich = { ...through(20), level: 99, gold: 9_999_999 }
    for (const item of ITEMS.filter((i) => i.source === 'remix')) {
      expect(SHOP_ITEMS, item.id).not.toContain(item)
      expect(buyItem(rich, item.id), item.id).toBeNull()
    }
  })
})

describe('no single build answers every boss', () => {
  it('spreads the remix relics across all three builds', () => {
    // The plan's own rule. Six pieces that all leaned one way would make the
    // mode a single shopping list rather than a set of different problems.
    const tags = new Set(
      REMIX_RELIC_BOSSES.map(({ itemId }) => ITEM_BY_ID.get(itemId)!.buildTag),
    )
    expect(tags.size).toBeGreaterThanOrEqual(3)
  })

  it('gives the remix bosses more than one opening trait between them', () => {
    const traits = new Set(WORLDS.map((w) => remixStage(w.index, 'mythic').enemy.trait))
    expect(traits.size).toBeGreaterThan(2)
    // And the pairs differ too, so two bosses are not the same fight twice.
    const pairs = new Set(
      WORLDS.map((w) => {
        const stage = remixStage(w.index, 'mythic')
        const swap = stage.enemy.boss!.phases!.find((p) => p.trait)!.trait
        return `${stage.enemy.trait}->${swap}`
      }),
    )
    expect(pairs.size).toBeGreaterThan(2)
  })

  it('leaves the campaign stages completely untouched', () => {
    // Building a remix must not mutate the boss it was built from.
    const before = STAGES.map((s) => `${s.id}:${s.enemy.maxHp}:${s.enemy.atk}:${s.enemy.def}`)
    for (const world of WORLDS) for (const tier of REMIX_TIERS) remixStage(world.index, tier.id)
    const after = STAGES.map((s) => `${s.id}:${s.enemy.maxHp}:${s.enemy.atk}:${s.enemy.def}`)
    expect(after).toEqual(before)
  })
})
