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

export interface PlayerState {
  name: string
  level: number
  exp: number
  gold: number
  stats: PlayerStats
  upgrades: UpgradeCounts
  stageProgress: StageProgress
}

export interface EnemyConfig {
  name: string
  emoji?: string
  maxHp: number
  atk: number
  def: number
}

export interface StageRewards {
  exp: number
  gold: number
}

export interface StageConfig {
  id: string
  name: string
  order: number
  enemy: EnemyConfig
  rewards: StageRewards
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
