import type { EnemyConfig, PlayerStats, BattleResult, StageRewards, TurnEvent } from '../types'

const MAX_TURNS = 200

export function resolveBattle(player: PlayerStats, enemy: EnemyConfig, rewards: StageRewards): BattleResult {
  let playerHp = player.maxHp
  let enemyHp = enemy.maxHp
  const log: TurnEvent[] = []
  let turn = 0

  while (playerHp > 0 && enemyHp > 0 && turn < MAX_TURNS) {
    turn++

    const dmgToEnemy = Math.max(1, player.atk - enemy.def)
    enemyHp = Math.max(0, enemyHp - dmgToEnemy)
    log.push({ turn, attacker: 'player', damage: dmgToEnemy, targetHpAfter: enemyHp })
    if (enemyHp <= 0) break

    const dmgToPlayer = Math.max(1, enemy.atk - player.def)
    playerHp = Math.max(0, playerHp - dmgToPlayer)
    log.push({ turn, attacker: 'enemy', damage: dmgToPlayer, targetHpAfter: playerHp })
  }

  const win = enemyHp <= 0 && playerHp > 0
  return { win, log, rewards: win ? rewards : { exp: 0, gold: 0 } }
}
