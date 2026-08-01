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

export const SAVE_SCHEMA_VERSION = 9

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
  avatar: string
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
  bg: StageBackground
}

export interface TurnEvent {
  turn: number
  attacker: 'player' | 'enemy'
  damage: number
  targetHpAfter: number
  /** Set on the enemy blow where a boss first goes over its base attack. */
  enraged?: boolean
}

export interface BattleResult {
  win: boolean
  log: TurnEvent[]
  rewards: StageRewards
}
