import { SKILL_BY_ID, prerequisiteOf, skillCost } from '../data/skills'
import { BOSS_STAGE_IDS } from '../data/worlds'
import type { SkillConfig } from '../data/skills'
import type { ModifierSource } from './combatModifiers'
import type { PlayerState } from '../types'

/** How many skills can be brought into a fight at once. */
export const LOADOUT_SIZE = 4

/** A point per level after the first, plus one for each boss put down. */
export const POINTS_PER_LEVEL = 1
export const POINTS_PER_BOSS = 1

/**
 * Skill points are **derived**, never stored — the same rule that already
 * governs stats. A save can be edited to claim any number of unlocked skills,
 * but it cannot be edited to have earned the points for them: the budget comes
 * from level and bosses cleared, both of which are themselves bounded by the
 * validator. `sanitizeSkills` then drops whatever does not fit the budget.
 */
export function earnedSkillPoints(state: PlayerState): number {
  const bosses = state.stageProgress.completedStageIds.filter((id) =>
    BOSS_STAGE_IDS.includes(id),
  ).length
  return (state.level - 1) * POINTS_PER_LEVEL + bosses * POINTS_PER_BOSS
}

export function spentSkillPoints(unlockedSkillIds: string[]): number {
  return unlockedSkillIds.reduce((total, id) => {
    const skill = SKILL_BY_ID.get(id)
    return skill ? total + skillCost(skill.tier) : total
  }, 0)
}

export function availableSkillPoints(state: PlayerState): number {
  return earnedSkillPoints(state) - spentSkillPoints(state.unlockedSkillIds)
}

/** Why a skill cannot be bought right now, or null when it can. */
export type UnlockBlock = 'owned' | 'wrong-race' | 'prerequisite' | 'points'

export function unlockBlocker(state: PlayerState, skillId: string): UnlockBlock | null {
  const skill = SKILL_BY_ID.get(skillId)
  if (!skill) return 'wrong-race'
  if (state.unlockedSkillIds.includes(skillId)) return 'owned'
  if (skill.raceId !== state.raceId) return 'wrong-race'
  const prerequisite = prerequisiteOf(skill)
  if (prerequisite && !state.unlockedSkillIds.includes(prerequisite.id)) return 'prerequisite'
  if (availableSkillPoints(state) < skillCost(skill.tier)) return 'points'
  return null
}

/** Returns the new state, or null when the skill cannot be bought. */
export function unlockSkill(state: PlayerState, skillId: string): PlayerState | null {
  if (unlockBlocker(state, skillId) !== null) return null
  return { ...state, unlockedSkillIds: [...state.unlockedSkillIds, skillId] }
}

/**
 * Respec is free early and priced later, so an experiment costs nothing while
 * the player is still learning what the branches do, and a late swap is a
 * decision rather than a reflex.
 */
export const FREE_RESPEC_UNTIL_SPENT = 10
export const RESPEC_GOLD_PER_LEVEL = 40

export function respecCost(state: PlayerState): number {
  if (spentSkillPoints(state.unlockedSkillIds) <= FREE_RESPEC_UNTIL_SPENT) return 0
  return state.level * RESPEC_GOLD_PER_LEVEL
}

/** Returns the new state, or null when the player cannot pay. */
export function respec(state: PlayerState): PlayerState | null {
  const cost = respecCost(state)
  if (state.gold < cost) return null
  // The loadout has to go with the tree: a slot pointing at a skill that is no
  // longer unlocked would silently contribute nothing to the next fight.
  return { ...state, gold: state.gold - cost, unlockedSkillIds: [], loadout: [] }
}

export function equipSkill(state: PlayerState, skillId: string): PlayerState {
  if (!state.unlockedSkillIds.includes(skillId)) return state
  if (state.loadout.includes(skillId)) return state
  if (state.loadout.length >= LOADOUT_SIZE) return state
  return { ...state, loadout: [...state.loadout, skillId] }
}

export function unequipSkill(state: PlayerState, skillId: string): PlayerState {
  if (!state.loadout.includes(skillId)) return state
  return { ...state, loadout: state.loadout.filter((id) => id !== skillId) }
}

/** The skills a fight actually runs under, in loadout order. */
export function equippedSkills(state: PlayerState): SkillConfig[] {
  return state.loadout
    .map((id) => SKILL_BY_ID.get(id))
    .filter((skill): skill is SkillConfig => skill !== undefined)
}

export function skillModifiers(state: PlayerState): ModifierSource[] {
  return equippedSkills(state).map((skill) => skill.mods)
}

/**
 * Reduces an untrusted skill list to one the player could actually have.
 *
 * Four rules, applied in this order because each depends on the last:
 *
 *  1. Drop ids that are not skills at all.
 *  2. Drop skills belonging to another race — changing race is a legal save
 *     edit (see README), and it must not carry another tree's power along.
 *  3. Walk tiers upward, dropping any skill whose prerequisite did not survive.
 *     Going upward matters: a tier-4 kept because tier-3 was present, where
 *     tier-3 is then dropped, would leave an orphan.
 *  4. Drop from the end until the total cost fits the earned budget. Without
 *     this, `unlockedSkillIds` would be a free-for-all in a hand-edited save.
 */
export function sanitizeSkills(
  raw: unknown,
  raceId: string,
  budget: number,
): string[] {
  const ids = Array.isArray(raw)
    ? [...new Set(raw.filter((id): id is string => typeof id === 'string'))]
    : []

  const owned = ids
    .map((id) => SKILL_BY_ID.get(id))
    .filter((skill): skill is SkillConfig => skill !== undefined && skill.raceId === raceId)
    .sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id))

  const kept = new Set<string>()
  for (const skill of owned) {
    const prerequisite = prerequisiteOf(skill)
    if (prerequisite && !kept.has(prerequisite.id)) continue
    kept.add(skill.id)
  }

  // Cheapest first, so trimming to budget takes the deepest nodes off rather
  // than gutting the shallow ones the deep nodes depend on.
  const ordered = [...kept]
    .map((id) => SKILL_BY_ID.get(id)!)
    .sort((a, b) => a.tier - b.tier || a.id.localeCompare(b.id))

  const affordable: string[] = []
  let spent = 0
  for (const skill of ordered) {
    const cost = skillCost(skill.tier)
    if (spent + cost > budget) break
    spent += cost
    affordable.push(skill.id)
  }
  return affordable
}

/** A loadout is only ever a subset of what is unlocked, capped at four. */
export function sanitizeLoadout(raw: unknown, unlockedSkillIds: string[]): string[] {
  if (!Array.isArray(raw)) return []
  const unlocked = new Set(unlockedSkillIds)
  return [...new Set(raw.filter((id): id is string => typeof id === 'string' && unlocked.has(id)))].slice(
    0,
    LOADOUT_SIZE,
  )
}
