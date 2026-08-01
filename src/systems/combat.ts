import type { EnemyConfig, PlayerStats, BattleResult, StageRewards, TurnEvent } from '../types'

const MAX_TURNS = 200

/**
 * A boss ramps its attack once the grace period is over, so a fight cannot be
 * ground out by soaking hits with a big HP pool and a weak weapon. Ordinary
 * enemies always hit for their base attack.
 */
export function enemyAttackAt(enemy: EnemyConfig, turn: number): number {
  const boss = enemy.boss
  if (!boss || turn <= boss.enrageAfterTurn) return enemy.atk
  const enragedTurns = turn - boss.enrageAfterTurn
  return Math.round(enemy.atk * (1 + enragedTurns * boss.enrageAtkPerTurn))
}

export function resolveBattle(player: PlayerStats, enemy: EnemyConfig, rewards: StageRewards): BattleResult {
  let playerHp = player.maxHp
  let enemyHp = enemy.maxHp
  const log: TurnEvent[] = []
  let turn = 0
  let wasEnraged = false

  while (playerHp > 0 && enemyHp > 0 && turn < MAX_TURNS) {
    turn++

    const dmgToEnemy = Math.max(1, player.atk - enemy.def)
    enemyHp = Math.max(0, enemyHp - dmgToEnemy)
    log.push({ turn, attacker: 'player', damage: dmgToEnemy, targetHpAfter: enemyHp })
    if (enemyHp <= 0) break

    const atk = enemyAttackAt(enemy, turn)
    const dmgToPlayer = Math.max(1, atk - player.def)
    playerHp = Math.max(0, playerHp - dmgToPlayer)
    const event: TurnEvent = { turn, attacker: 'enemy', damage: dmgToPlayer, targetHpAfter: playerHp }
    // Flag only the turn it kicks in; the UI announces it once, not every hit.
    if (atk > enemy.atk && !wasEnraged) {
      event.enraged = true
      wasEnraged = true
    }
    log.push(event)
  }

  const win = enemyHp <= 0 && playerHp > 0
  return { win, log, rewards: win ? rewards : { exp: 0, gold: 0 } }
}
