export interface PlayerStats {
  maxHp: number
  atk: number
  def: number
}

export interface StageProgress {
  highestUnlocked: number
  completedStageIds: string[]
}

export interface PlayerState {
  name: string
  level: number
  exp: number
  gold: number
  stats: PlayerStats
  stageProgress: StageProgress
}

export interface EnemyConfig {
  name: string
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
