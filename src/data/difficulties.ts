import type { MessageKey } from '../i18n'
import type { EnemyConfig, StageRewards } from '../types'

/**
 * Campaign difficulty. Multipliers scale the enemy's stat block and the payout;
 * they never touch the player's side, so a mode change cannot invalidate a
 * build the way re-tuning a race would.
 *
 * The numbers are the handoff's baseline. They are applied to already-rounded
 * enemy stats and rounded once, so `enemyFor(stage, mode)` is a pure function
 * of the two and the battle preview stays an exact simulation.
 */
export const DIFFICULTY_IDS = ['normal', 'veteran', 'nightmare'] as const

export type DifficultyId = (typeof DIFFICULTY_IDS)[number]

export const DEFAULT_DIFFICULTY: DifficultyId = 'normal'

export interface DifficultyMode {
  id: DifficultyId
  nameKey: MessageKey
  descriptionKey: MessageKey
  icon: string
  enemyHp: number
  enemyAtk: number
  reward: number
  /**
   * Worlds that must be fully cleared on Normal before this mode opens. Zero
   * means always available. Gating on *cleared worlds* rather than on the
   * furthest unlocked stage stops a single lucky boss kill from opening a mode
   * the player cannot survive.
   */
  unlockAfterWorlds: number
}

export const DIFFICULTIES: DifficultyMode[] = [
  {
    id: 'normal',
    nameKey: 'difficulty.normal',
    descriptionKey: 'difficulty.normalHint',
    icon: 'decor_leaf',
    enemyHp: 1,
    enemyAtk: 1,
    reward: 1,
    unlockAfterWorlds: 0,
  },
  {
    id: 'veteran',
    nameKey: 'difficulty.veteran',
    descriptionKey: 'difficulty.veteranHint',
    icon: 'decor_fire',
    enemyHp: 1.3,
    enemyAtk: 1.18,
    reward: 1.35,
    unlockAfterWorlds: 4,
  },
  {
    id: 'nightmare',
    nameKey: 'difficulty.nightmare',
    descriptionKey: 'difficulty.nightmareHint',
    icon: 'decor_skull',
    enemyHp: 1.65,
    enemyAtk: 1.35,
    reward: 1.75,
    unlockAfterWorlds: 20,
  },
]

export const DIFFICULTY_BY_ID = new Map(DIFFICULTIES.map((mode) => [mode.id, mode]))

/** Fails closed to Normal, so a hand-edited save cannot invent a mode. */
export function normalizeDifficulty(value: unknown): DifficultyId {
  if (typeof value !== 'string') return DEFAULT_DIFFICULTY
  return (DIFFICULTY_IDS as readonly string[]).includes(value)
    ? (value as DifficultyId)
    : DEFAULT_DIFFICULTY
}

export function difficultyOf(id: DifficultyId | string | undefined): DifficultyMode {
  return DIFFICULTY_BY_ID.get(normalizeDifficulty(id))!
}

/**
 * The enemy as this mode fights it. Defence is deliberately left alone: it is
 * subtracted from attack before the damage floor, so scaling it up alongside HP
 * would push low-attack builds onto the minimum-1 damage floor and turn a
 * harder fight into an unwinnable one.
 *
 * Boss enrage carries over untouched — it is a *rate* on the boss's own base
 * attack, so scaling that base already scales the ramp with it.
 */
export function enemyFor(enemy: EnemyConfig, id: DifficultyId | string | undefined): EnemyConfig {
  const mode = difficultyOf(id)
  if (mode.enemyHp === 1 && mode.enemyAtk === 1) return enemy
  return {
    ...enemy,
    maxHp: Math.round(enemy.maxHp * mode.enemyHp),
    atk: Math.round(enemy.atk * mode.enemyAtk),
  }
}

export function rewardsFor(
  rewards: StageRewards,
  id: DifficultyId | string | undefined,
): StageRewards {
  const mode = difficultyOf(id)
  if (mode.reward === 1) return rewards
  return {
    exp: Math.round(rewards.exp * mode.reward),
    gold: Math.round(rewards.gold * mode.reward),
  }
}
