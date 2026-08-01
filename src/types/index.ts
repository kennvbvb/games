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

export const SAVE_SCHEMA_VERSION = 7

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
  /** Monotonic save counter; the higher revision wins when local and cloud disagree. */
  revision: number
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

export interface EnemyConfig {
  name: string
  /** Preloaded emoji texture key for this enemy's sprite. */
  sprite: string
  maxHp: number
  atk: number
  def: number
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
}

export interface BattleResult {
  win: boolean
  log: TurnEvent[]
  rewards: StageRewards
}
