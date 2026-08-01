import type { TraitId } from '../data/enemyTraits'
import type { PlanId } from '../data/battlePlans'
import type { RaceId } from '../data/races'
import type { StageVisual } from '../data/biomes'

export interface PlayerStats {
  maxHp: number
  atk: number
  def: number
}

export interface StageProgress {
  highestUnlocked: number
  completedStageIds: string[]
}

export type UpgradeType = 'hp' | 'atk' | 'def'

export type UpgradeCounts = Record<UpgradeType, number>

export interface StatBonus {
  hp?: number
  atk?: number
  def?: number
}

export type EquipSlot = 'weapon' | 'armor' | 'charm'

/** One item may be equipped per slot; the rest stay in the bag. */
export type Equipment = Record<EquipSlot, string | null>

export interface ShopItem {
  id: string
  slot: EquipSlot
  name: string
  emoji: string
  bonus: StatBonus
  cost: number
  minLevel?: number
}

export const SAVE_SCHEMA_VERSION = 11

export type BattleSpeed = 1 | 2 | 4

export interface GameSettings {
  /** Playback multiplier for battle animation; combat maths are unaffected. */
  battleSpeed: BattleSpeed
  /** Jump straight to the result once a stage has been cleared before. */
  skipCleared: boolean
  /** Keep fighting the current stage automatically after a win. */
  autoRepeat: boolean
  /** When auto-repeating, move on to the next stage once this one is cleared. */
  autoAdvance: boolean
  /**
   * Suppresses decorative motion. Defaults from the OS `prefers-reduced-motion`
   * setting on a new save, and can then be overridden in Settings.
   */
  reducedMotion: boolean
  /** UI language; defaults from the browser on a new save. */
  locale: 'en' | 'th'
  /**
   * The plan committed to most recently. This is what offline farming fights
   * under and what the stage cards forecast, so it has to be the player's own
   * last choice rather than whichever plan happens to be best.
   */
  battlePlan: PlanId
  /**
   * Opt-in gameplay analytics. Always starts false, including on upgraded
   * saves — consent cannot be inherited from a version that never asked.
   */
  analytics: boolean
}

/** Running totals that cannot be derived from the current state alone. */
export interface LifetimeStats {
  battlesWon: number
  goldEarned: number
}

export interface IdleState {
  /** Stage id the hero keeps farming while away; null disables offline gains. */
  farmingStageId: string | null
  /** Epoch ms of the last time offline rewards were settled. */
  lastSeenAt: number
}

export interface PlayerState {
  /** Bump SAVE_SCHEMA_VERSION and add a migration step when this shape changes. */
  schemaVersion: number
  /** Monotonic save counter, bumped on every persist. */
  revision: number
  /**
   * The revision at which this copy last matched the cloud. A counter alone
   * cannot tell "the cloud is behind" from "both copies moved independently";
   * comparing each side against this shared ancestor can. See detectConflict.
   */
  syncedRevision: number
  /** ISO timestamp of the last persist, informational only. */
  updatedAt: string
  name: string
  /**
   * The animal buddy picked before races existed. Kept so nobody's original
   * choice is thrown away, but the hero itself renders from `raceId`.
   */
  avatar: string
  /** Decides base stats, per-level growth and the passive. */
  raceId: RaceId
  /** Which of the race's looks; always one the race actually offers. */
  appearanceId: string
  level: number
  exp: number
  gold: number
  stats: PlayerStats
  upgrades: UpgradeCounts
  ownedItemIds: string[]
  equipped: Equipment
  stageProgress: StageProgress
  settings: GameSettings
  idle: IdleState
  /** How far through the 3-step intro the player is; TUTORIAL_DONE when finished. */
  tutorialStep: number
  lifetime: LifetimeStats
  /** Achievements whose reward has already been taken. */
  claimedAchievementIds: string[]
}

export const TUTORIAL_DONE = 3

/**
 * Extra rules a boss fights under, layered on the normal turn loop. Kept
 * deterministic so the stage preview stays an exact simulation rather than an
 * estimate — see systems/difficulty.
 */
export interface BossConfig {
  /** Turns of grace before the boss starts hitting harder every turn. */
  enrageAfterTurn: number
  /** Fraction of base ATK the boss gains per enraged turn. */
  enrageAtkPerTurn: number
}

export interface EnemyConfig {
  name: string
  /** Preloaded emoji texture key for this enemy's sprite. */
  sprite: string
  maxHp: number
  atk: number
  def: number
  /** Present only on chapter bosses. */
  boss?: BossConfig
  /**
   * Absent means 'straightforward'. Lives here rather than on StageConfig so
   * the difficulty preview and offline farming pick it up for free, the same
   * way `boss` already does.
   */
  trait?: TraitId
}

export interface StageRewards {
  exp: number
  gold: number
}

export interface StageBackground {
  skyTop: number
  skyBottom: number
  hillFar: number
  hillNear: number
  ground: number
  /** Emoji texture keys scattered across the ground band. */
  decor: string[]
  /** Emoji texture keys floating in the sky band. */
  sky: string[]
}

export interface StageConfig {
  id: string
  name: string
  order: number
  enemy: EnemyConfig
  rewards: StageRewards
  /** Flattened for the scenery painter; composed from `visual`. */
  bg: StageBackground
  /** The composition it was built from, so tests can assert all 60 differ. */
  visual: StageVisual
}

/**
 * Effects worth interrupting the battle log for. Each announces at most once
 * per fight — recurring things like dodges and heals get sprite-level feedback
 * instead, or the log would be unreadable.
 */
export type AnnounceKind =
  | 'enraged'
  | 'fierce'
  | 'bloodrage'
  | 'precision'
  | 'attrition'
  | 'execute'

export interface TurnEvent {
  turn: number
  attacker: 'player' | 'enemy'
  /** 0 when dodged; otherwise at least 1. */
  damage: number
  /** HP of the side that was struck, after the blow. */
  targetHpAfter: number

  /** The blow missed entirely — the only way to take 0 damage. */
  dodged?: true
  /** Went through a combo or first-strike multiplier; drives a bigger hit flash. */
  crit?: true
  /** How much the attacker restored to itself. Omitted when nothing was healed. */
  healed?: number
  /** Healing past Max HP banked as shield instead of being discarded. */
  barriered?: number
  /** The attacker's own HP after healing or barriering. */
  selfHpAfter?: number
  /** Part of this blow that shield ate rather than health. */
  absorbed?: number
  /** Damage the player dealt back on a dodge, on the enemy's own event. */
  counter?: number
  /** Enemy HP after the counter landed. Present exactly when `counter` is. */
  counterHpAfter?: number

  /** Latched: the one blow where this effect announces itself. */
  announce?: AnnounceKind
}

export type BattleOutcome = 'win' | 'loss' | 'timeout'

export interface BattleResult {
  outcome: BattleOutcome
  /** Always `outcome === 'win'`; kept so reward and result code needs no change. */
  win: boolean
  log: TurnEvent[]
  /**
   * Final HP, returned rather than re-derived from the log. Once healing can
   * change a side's HP on its *own* attack event, walking the log for the last
   * blow against that side silently reads a stale value.
   */
  playerHpLeft: number
  enemyHpLeft: number
  /** Shield still standing at the end; 0 unless a shield effect was running. */
  shieldLeft: number
  rewards: StageRewards
}
