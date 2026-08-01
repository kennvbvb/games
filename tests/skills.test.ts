import { describe, it, expect } from 'vitest'
import { SKILLS, SKILL_BY_ID, branchesFor, prerequisiteOf, skillCost, BRANCH_COST } from '../src/data/skills'
import {
  LOADOUT_SIZE,
  availableSkillPoints,
  earnedSkillPoints,
  equipSkill,
  equippedSkills,
  respec,
  respecCost,
  sanitizeLoadout,
  sanitizeSkills,
  skillModifiers,
  spentSkillPoints,
  unequipSkill,
  unlockBlocker,
  unlockSkill,
} from '../src/systems/skills'
import { RACE_IDS } from '../src/data/races'
import { STAGES } from '../src/data/stages'
import { BOSS_STAGE_IDS } from '../src/data/worlds'
import { createDefaultPlayerState } from '../src/state/playerState'
import { parsePlayerState } from '../src/state/validate'
import { resolveBattle } from '../src/systems/combat'
import { foldModifiers } from '../src/systems/combatModifiers'
import { statsForLevel } from '../src/systems/leveling'
import type { PlayerState } from '../src/types'

/** A hero with enough points to buy anything, so tests can isolate one rule. */
function rich(raceId: PlayerState['raceId'] = 'human', level = 60): PlayerState {
  const base = createDefaultPlayerState('Skiller')
  return {
    ...base,
    raceId,
    level,
    stats: statsForLevel(level, raceId),
    stageProgress: { highestUnlocked: STAGES.length, completedStageIds: [...BOSS_STAGE_IDS] },
  }
}

describe('skill data', () => {
  it('gives every race three branches of four', () => {
    for (const raceId of RACE_IDS) {
      const branches = branchesFor(raceId)
      expect(branches, raceId).toHaveLength(3)
      for (const branch of branches) {
        expect(branch.skills.map((s) => s.tier), `${raceId}/${branch.name}`).toEqual([1, 2, 3, 4])
      }
    }
    expect(SKILLS).toHaveLength(RACE_IDS.length * 3 * 4)
    expect(new Set(SKILLS.map((s) => s.id)).size).toBe(SKILLS.length)
  })

  it('chains each tier to the one below it, within its own branch', () => {
    for (const skill of SKILLS) {
      const prerequisite = prerequisiteOf(skill)
      if (skill.tier === 1) {
        expect(prerequisite, skill.id).toBeNull()
      } else {
        expect(prerequisite, skill.id).not.toBeNull()
        expect(prerequisite!.tier).toBe(skill.tier - 1)
        expect(prerequisite!.branch).toBe(skill.branch)
        expect(prerequisite!.raceId).toBe(skill.raceId)
      }
    }
  })

  it('makes every skill do something, and half of them do more than add a number', () => {
    // A tree of percentages is a tree with one right answer. The handoff asks
    // for skills that change how a fight plays, so at least half must touch a
    // mechanic rather than a multiplier.
    const mechanics = ['comboEvery', 'dodgeEvery', 'counter', 'execute', 'shield', 'barrier', 'heal', 'firstStrike']
    let mechanical = 0
    for (const skill of SKILLS) {
      expect(Object.keys(skill.mods).length, `${skill.id} does nothing`).toBeGreaterThan(0)
      if (mechanics.some((key) => key in skill.mods)) mechanical += 1
    }
    expect(mechanical / SKILLS.length).toBeGreaterThanOrEqual(0.5)
  })

  it('never lets a deeper node cost less than a shallower one', () => {
    for (let tier = 2; tier <= 4; tier++) {
      expect(skillCost(tier)).toBeGreaterThan(skillCost(tier - 1))
    }
    expect(BRANCH_COST).toBe(skillCost(1) + skillCost(2) + skillCost(3) + skillCost(4))
  })

  it('reads back as English text a player can act on', () => {
    for (const skill of SKILLS) {
      expect(skill.name.length, skill.id).toBeGreaterThan(2)
      expect(skill.description.length, skill.id).toBeGreaterThan(10)
      expect(skill.icon.startsWith('icon_') || skill.icon.startsWith('decor_'), skill.id).toBe(true)
    }
  })
})

describe('skill points', () => {
  it('derives the budget from level and bosses, never from the save', () => {
    const state = { ...createDefaultPlayerState(), level: 10 }
    expect(earnedSkillPoints(state)).toBe(9)

    const withBosses = {
      ...state,
      stageProgress: { highestUnlocked: 20, completedStageIds: BOSS_STAGE_IDS.slice(0, 3) },
    }
    expect(earnedSkillPoints(withBosses)).toBe(9 + 3)

    // Ordinary stages are not bosses, however many are cleared.
    const withStages = {
      ...state,
      stageProgress: { highestUnlocked: 20, completedStageIds: ['stage-1', 'stage-2', 'stage-3'] },
    }
    expect(earnedSkillPoints(withStages)).toBe(9)
  })

  it('spends what the tier costs and reports the remainder', () => {
    const state = rich()
    const t1 = SKILL_BY_ID.get('human-1-1')!
    const bought = unlockSkill(state, t1.id)!
    expect(spentSkillPoints(bought.unlockedSkillIds)).toBe(skillCost(1))
    expect(availableSkillPoints(bought)).toBe(earnedSkillPoints(state) - skillCost(1))
  })

  it('refuses a skill whose prerequisite is missing, and allows it once bought', () => {
    const state = rich()
    expect(unlockBlocker(state, 'human-1-2')).toBe('prerequisite')
    expect(unlockSkill(state, 'human-1-2')).toBeNull()

    const withTier1 = unlockSkill(state, 'human-1-1')!
    expect(unlockBlocker(withTier1, 'human-1-2')).toBeNull()
    expect(unlockSkill(withTier1, 'human-1-2')).not.toBeNull()
  })

  it('refuses another race tree, and refuses to buy the same skill twice', () => {
    const state = rich('human')
    expect(unlockBlocker(state, 'orc-1-1')).toBe('wrong-race')
    expect(unlockBlocker(state, 'no-such-skill')).toBe('wrong-race')
    const bought = unlockSkill(state, 'human-1-1')!
    expect(unlockBlocker(bought, 'human-1-1')).toBe('owned')
  })

  it('refuses a skill the player cannot afford', () => {
    // Level 2 earns exactly one point: enough for a tier-1 node and no more.
    const broke: PlayerState = { ...createDefaultPlayerState(), level: 2 }
    const first = unlockSkill(broke, 'human-1-1')!
    expect(availableSkillPoints(first)).toBe(0)
    expect(unlockBlocker(first, 'human-1-2')).toBe('points')
    expect(unlockBlocker(first, 'human-2-1')).toBe('points')
  })
})

describe('respec', () => {
  it('is free while the player is still experimenting', () => {
    const state = rich()
    let current = state
    for (const id of ['human-1-1', 'human-1-2', 'human-2-1']) current = unlockSkill(current, id)!
    expect(spentSkillPoints(current.unlockedSkillIds)).toBeLessThanOrEqual(10)
    expect(respecCost(current)).toBe(0)
  })

  it('costs gold once the tree is a real investment', () => {
    let current = rich('human', 40)
    for (const id of ['human-1-1', 'human-1-2', 'human-1-3', 'human-1-4']) current = unlockSkill(current, id)!
    expect(spentSkillPoints(current.unlockedSkillIds)).toBe(BRANCH_COST)
    expect(respecCost(current)).toBeGreaterThan(0)
    expect(respec(current)).toBeNull()

    const paid = respec({ ...current, gold: 99999 })!
    expect(paid.unlockedSkillIds).toEqual([])
    expect(paid.gold).toBeLessThan(99999)
  })

  it('clears the loadout with the tree', () => {
    // A slot pointing at a skill that is no longer unlocked would silently
    // contribute nothing to the next fight.
    let current = rich()
    current = unlockSkill(current, 'human-1-1')!
    current = equipSkill(current, 'human-1-1')
    expect(current.loadout).toEqual(['human-1-1'])
    expect(respec(current)!.loadout).toEqual([])
  })
})

describe('loadout', () => {
  function withTree(): PlayerState {
    let state = rich()
    for (const id of ['human-1-1', 'human-1-2', 'human-1-3', 'human-2-1', 'human-2-2', 'human-3-1']) {
      state = unlockSkill(state, id)!
    }
    return state
  }

  it('holds at most four, and refuses anything not unlocked', () => {
    let state = withTree()
    for (const id of ['human-1-1', 'human-1-2', 'human-1-3', 'human-2-1', 'human-2-2']) {
      state = equipSkill(state, id)
    }
    expect(state.loadout).toHaveLength(LOADOUT_SIZE)
    expect(state.loadout).not.toContain('human-2-2')

    expect(equipSkill(rich(), 'human-1-1').loadout).toEqual([])
  })

  it('ignores a duplicate equip and a spurious unequip', () => {
    let state = equipSkill(withTree(), 'human-1-1')
    state = equipSkill(state, 'human-1-1')
    expect(state.loadout).toEqual(['human-1-1'])
    expect(unequipSkill(state, 'human-2-1').loadout).toEqual(['human-1-1'])
    expect(unequipSkill(state, 'human-1-1').loadout).toEqual([])
  })

  it('feeds exactly the equipped skills into combat, in loadout order', () => {
    let state = withTree()
    state = equipSkill(state, 'human-1-2')
    state = equipSkill(state, 'human-1-1')
    expect(equippedSkills(state).map((s) => s.id)).toEqual(['human-1-2', 'human-1-1'])
    expect(skillModifiers(state)).toEqual([
      SKILL_BY_ID.get('human-1-2')!.mods,
      SKILL_BY_ID.get('human-1-1')!.mods,
    ])
  })
})

describe('skills in combat', () => {
  const enemy = { name: 'Dummy', sprite: 'enemy_1', maxHp: 400, atk: 20, def: 5 }
  const rewards = { exp: 0, gold: 0 }
  const player = { maxHp: 200, atk: 40, def: 10 }

  it('changes nothing when the loadout is empty', () => {
    const bare = resolveBattle({ player, enemy, rewards })
    const empty = resolveBattle({ player, enemy, rewards, modifiers: [] })
    expect(empty).toEqual(bare)
  })

  it('makes an outgoing skill strictly better and a defensive one strictly safer', () => {
    const bare = resolveBattle({ player, enemy, rewards })
    const rally = resolveBattle({ player, enemy, rewards, modifiers: [{ outgoing: 1.06 }] })
    expect(rally.log[0].damage).toBeGreaterThan(bare.log[0].damage)

    const guard = resolveBattle({ player, enemy, rewards, modifiers: [{ incoming: 0.9 }] })
    const bareHit = bare.log.find((e) => e.attacker === 'enemy')!
    const guardHit = guard.log.find((e) => e.attacker === 'enemy')!
    expect(guardHit.damage).toBeLessThan(bareHit.damage)
  })

  it('spends shield before health, and reports how much it ate', () => {
    const shielded = resolveBattle({ player, enemy, rewards, modifiers: [{ shield: 0.2 }] })
    const firstHit = shielded.log.find((e) => e.attacker === 'enemy')!
    expect(firstHit.absorbed).toBe(firstHit.damage)
    // Absorbed damage leaves health alone, which is the whole point of shield.
    expect(firstHit.targetHpAfter).toBe(player.maxHp)
  })

  it('turns overheal into shield only when a barrier is running', () => {
    // Full health with nothing to heal: without a barrier the heal is simply
    // discarded, with one it is banked.
    const plain = resolveBattle({ player, enemy, rewards, modifiers: [{ heal: 0.5, healEvery: 1 }] })
    expect(plain.log[0].healed).toBeUndefined()
    expect(plain.shieldLeft).toBe(0)

    const barrier = resolveBattle({
      player,
      enemy,
      rewards,
      modifiers: [{ heal: 0.5, healEvery: 1, barrier: true }],
    })
    expect(barrier.log[0].barriered).toBeGreaterThan(0)
    expect(barrier.shieldLeft).toBeGreaterThan(0)
  })

  it('answers a dodge with a counter on the same turn, not an extra one', () => {
    const dodgeOnly = resolveBattle({ player, enemy, rewards, modifiers: [{ dodgeEvery: 2 }] })
    const withCounter = resolveBattle({ player, enemy, rewards, modifiers: [{ dodgeEvery: 2, counter: 0.8 }] })

    const dodged = withCounter.log.find((e) => e.attacker === 'enemy' && e.dodged)!
    expect(dodged.counter).toBeGreaterThan(0)
    // The counter takes its damage off the enemy health the player's own swing
    // that turn left behind — it is an extra blow, not a re-application.
    const swingSameTurn = withCounter.log.find((e) => e.attacker === 'player' && e.turn === dodged.turn)!
    expect(dodged.counterHpAfter).toBe(swingSameTurn.targetHpAfter - dodged.counter!)
    // And it shortens the fight rather than adding turns to it.
    expect(withCounter.log.length).toBeLessThan(dodgeOnly.log.length)
  })

  it('only executes once the enemy is inside the window', () => {
    const mods = [{ execute: 2, executeBelow: 0.2 }]
    const result = resolveBattle({ player, enemy, rewards, modifiers: mods })
    const swings = result.log.filter((e) => e.attacker === 'player')
    // Early swings are ordinary; the ones landing under 20% are not.
    expect(swings[0].crit).toBeUndefined()
    expect(swings.some((e) => e.announce === 'execute')).toBe(true)
  })

  it('applies boss damage to bosses and nobody else', () => {
    const boss = { ...enemy, boss: { enrageAfterTurn: 6, enrageAtkPerTurn: 0.15 } }
    const mods = [{ bossDamage: 1.5 }]
    expect(resolveBattle({ player, enemy: boss, rewards, modifiers: mods }).log[0].damage).toBeGreaterThan(
      resolveBattle({ player, enemy: boss, rewards }).log[0].damage,
    )
    expect(resolveBattle({ player, enemy, rewards, modifiers: mods }).log[0].damage).toBe(
      resolveBattle({ player, enemy, rewards }).log[0].damage,
    )
  })

  it('multiplies two sources of the same effect rather than adding them', () => {
    // Two skills at +25% give x1.5625. Adding them would give x1.5, which is
    // what a player would get if the fold summed — and would make the second
    // copy of a skill quietly weaker than the first.
    const folded = foldModifiers([{ outgoing: 1.25 }, { outgoing: 1.25 }])
    expect(folded.outgoing).toBeCloseTo(1.5625, 10)
  })

  it('takes the tighter of two cadences rather than dodging twice on one blow', () => {
    const folded = foldModifiers([{ dodgeEvery: 6 }, { dodgeEvery: 4 }])
    expect(folded.dodgeEvery).toBe(4)
  })

  it('adds two heal fractions into one heal on the shared blow', () => {
    const folded = foldModifiers([
      { heal: 0.06, healEvery: 3 },
      { heal: 0.03, healEvery: 3 },
    ])
    expect(folded.heal).toBeCloseTo(0.09, 10)
    expect(folded.healEvery).toBe(3)
  })
})

describe('skill validation', () => {
  it('drops unknown ids and other races trees', () => {
    const kept = sanitizeSkills(['human-1-1', 'orc-1-1', 'nonsense', 42], 'human', 99)
    expect(kept).toEqual(['human-1-1'])
  })

  it('drops a skill whose prerequisite did not survive', () => {
    // Tier 3 without tier 2 is an orphan even though tier 1 is present.
    const kept = sanitizeSkills(['human-1-1', 'human-1-3', 'human-1-4'], 'human', 99)
    expect(kept).toEqual(['human-1-1'])
  })

  it('trims to the earned budget, keeping the shallow nodes the deep ones need', () => {
    const all = ['human-1-1', 'human-1-2', 'human-1-3', 'human-1-4']
    // Budget of 3 pays for tier 1 (1) and tier 2 (2) exactly.
    expect(sanitizeSkills(all, 'human', 3)).toEqual(['human-1-1', 'human-1-2'])
    expect(sanitizeSkills(all, 'human', 0)).toEqual([])
  })

  it('cannot be handed a full tree by editing the save', () => {
    // The concrete attack: claim every skill at level 1 with nothing cleared.
    const forged = {
      ...createDefaultPlayerState('Cheat'),
      unlockedSkillIds: SKILLS.filter((s) => s.raceId === 'human').map((s) => s.id),
      loadout: ['human-1-4', 'human-2-4', 'human-3-4'],
    }
    const parsed = parsePlayerState(forged)!
    expect(earnedSkillPoints(parsed)).toBe(0)
    expect(parsed.unlockedSkillIds).toEqual([])
    expect(parsed.loadout).toEqual([])
  })

  it('keeps a legitimate tree intact through a save round trip', () => {
    let state = rich('orc', 30)
    for (const id of ['orc-1-1', 'orc-1-2', 'orc-2-1']) state = unlockSkill(state, id)!
    state = equipSkill(state, 'orc-1-2')
    const parsed = parsePlayerState(JSON.parse(JSON.stringify(state)))!
    expect(parsed.unlockedSkillIds.sort()).toEqual(['orc-1-1', 'orc-1-2', 'orc-2-1'])
    expect(parsed.loadout).toEqual(['orc-1-2'])
  })

  it('drops the tree when the save is edited to another race', () => {
    // Changing raceId is a legal save edit; it must not carry another kin's
    // power along with it.
    let state = rich('orc', 30)
    for (const id of ['orc-1-1', 'orc-1-2']) state = unlockSkill(state, id)!
    const switched = parsePlayerState({ ...state, raceId: 'elf' })!
    expect(switched.raceId).toBe('elf')
    expect(switched.unlockedSkillIds).toEqual([])
  })

  it('never lets a loadout hold something the tree does not', () => {
    expect(sanitizeLoadout(['human-1-1'], [])).toEqual([])
    expect(sanitizeLoadout(['a', 'b', 'c', 'd', 'e'], ['a', 'b', 'c', 'd', 'e'])).toHaveLength(LOADOUT_SIZE)
    expect(sanitizeLoadout('nope', ['a'])).toEqual([])
  })
})
