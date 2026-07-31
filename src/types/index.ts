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

export interface ShopItem {
  id: string
  name: string
  emoji: string
  bonus: StatBonus
  cost: number
  minLevel?: number
}

export interface PlayerState {
  name: string
  avatar: string
  level: number
  exp: number
  gold: number
  stats: PlayerStats
  upgrades: UpgradeCounts
  ownedItemIds: string[]
  stageProgress: StageProgress
}

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
