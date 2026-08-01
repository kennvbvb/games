import { PLAN_BY_ID } from '../data/battlePlans'
import { traitOf } from '../data/enemyTraits'
import type { PlanId } from '../data/battlePlans'
import type {
  AnnounceKind,
  BattleOutcome,
  BattleResult,
  EnemyConfig,
  PlayerStats,
  StageRewards,
  TurnEvent,
} from '../types'

/** Backstop only. The healing ramp below is what actually bounds a fight. */
const MAX_TURNS = 200

/**
 * Healing fades out between these turns, symmetrically for both sides.
 *
 * Without it a fight can genuinely never end: a Cozy Guard hero with 200 Max HP
 * against an enemy whose damage floors to 1 takes 1 per turn and heals 12 every
 * third attack — net positive, forever. Capping turns would score that as a
 * loss, which is a lie the preview and the offline payout would both repeat.
 *
 * A pure function of the turn number, so the fight stays deterministic and the
 * stage preview stays an exact simulation. Real fights end in 5-25 turns, so
 * players never see it.
 */
const HEAL_FULL_UNTIL_TURN = 20
const HEAL_ZERO_FROM_TURN = 40

export function healScale(turn: number): number {
  if (turn <= HEAL_FULL_UNTIL_TURN) return 1
  if (turn >= HEAL_ZERO_FROM_TURN) return 0
  return (HEAL_ZERO_FROM_TURN - turn) / (HEAL_ZERO_FROM_TURN - HEAL_FULL_UNTIL_TURN)
}

/** Returns how much was actually restored, so overflow past Max HP cannot happen. */
function healAmount(currentHp: number, maxHp: number, fraction: number, turn: number): number {
  if (fraction <= 0) return 0
  const raw = Math.round(maxHp * fraction * healScale(turn))
  return Math.max(0, Math.min(raw, maxHp - currentHp))
}

/**
 * A boss ramps its attack once the grace period is over, so a fight cannot be
 * ground out by soaking hits with a big HP pool and a weak weapon. Ordinary
 * enemies always hit for their base attack.
 *
 * Note this rounds at the *attack stat*, upstream of damage — which is why the
 * damage pipeline below can round exactly once and still leave this intact.
 */
export function enemyAttackAt(enemy: EnemyConfig, turn: number): number {
  const boss = enemy.boss
  if (!boss || turn <= boss.enrageAfterTurn) return enemy.atk
  const enragedTurns = turn - boss.enrageAfterTurn
  return Math.round(enemy.atk * (1 + enragedTurns * boss.enrageAtkPerTurn))
}

/** Passive hooks a race can contribute to the turn loop. All deterministic. */
export interface RaceCombatPassive {
  /** Multiplier on the first player attack that actually lands. */
  firstStrike?: number
  /** Multiplier while the player is strictly below `lowHpBelow` of Max HP. */
  lowHp?: number
  lowHpBelow?: number
  /**
   * Multiplier on damage the player takes, applied as one more factor in the
   * same product — so it compounds with a plan's reduction rather than adding
   * to it (0.65 and 0.95 give 0.6175, not 0.60).
   */
  damageTaken?: number
  /** The player dodges every Nth enemy attack. */
  dodgeEvery?: number
  /** Fraction of Max HP restored on every `healEvery`-th player attack. */
  heal?: number
  healEvery?: number
}

export interface BattleContext {
  player: PlayerStats
  enemy: EnemyConfig
  rewards: StageRewards
  /** Omitted means no plan modifiers, which keeps pre-plan results reproducible. */
  plan?: PlanId
  /** Omitted means no racial passive. */
  passive?: RaceCombatPassive
}

/**
 * Resolves a whole fight up front. This function is also the oracle: the stage
 * preview and offline farming run it to promise the player an outcome before
 * they commit, so it must stay free of randomness and of any input beyond its
 * context.
 *
 * Damage is a single product of multipliers, **rounded once** at the end. That
 * matters: rounding per step makes the result depend on the order the
 * multipliers happen to be written in — `round(round(4 * 1.25) * 1.3)` is 7 but
 * `round(round(4 * 1.3) * 1.25)` is 6 — so every future passive would quietly
 * rebalance the existing ones. Rounding once makes them commute, leaving only
 * three things whose order genuinely matters: the dodge gate, the minimum-1
 * floor, and `enemyAttackAt`.
 */
export function resolveBattle(ctx: BattleContext): BattleResult {
  const { player, enemy, rewards } = ctx
  const plan = ctx.plan ? PLAN_BY_ID.get(ctx.plan) : undefined
  const trait = traitOf(enemy.trait)
  const passive = ctx.passive ?? {}

  let playerHp = player.maxHp
  let enemyHp = enemy.maxHp
  // Counters advance on every *attempted* attack, dodged or not. One counter
  // per side means a dodge cannot silently shift an unrelated effect's cadence,
  // and the player can predict every proc by counting blows on screen.
  let playerAttacks = 0
  let enemyAttacks = 0
  let firstStrikeSpent = false
  const announced = new Set<AnnounceKind>()
  const log: TurnEvent[] = []
  let turn = 0

  // Both heals are percentages of Max HP, so resolve the fractions once.
  const playerHeal = (plan?.heal ?? 0) + (passive.heal ?? 0)
  const playerHealEvery = plan?.healEvery || passive.healEvery || 0
  const enemyHeal = trait.heal
  const enemyHealEvery = trait.healEvery

  /** At most one announcement per blow; a loser stays unlatched and tries again. */
  const announce = (event: TurnEvent, kind: AnnounceKind) => {
    if (announced.has(kind) || event.announce !== undefined) return
    event.announce = kind
    announced.add(kind)
  }

  while (playerHp > 0 && enemyHp > 0 && turn < MAX_TURNS) {
    turn++

    // ---- player attacks ----
    playerAttacks += 1
    const playerEvent: TurnEvent = { turn, attacker: 'player', damage: 0, targetHpAfter: enemyHp }

    if (trait.dodgeEvery > 0 && playerAttacks % trait.dodgeEvery === 0) {
      // A gate, not a zero multiplier — the minimum-1 floor would undo a zero.
      playerEvent.dodged = true
    } else {
      let multiplier = plan?.outgoing ?? 1
      const combo = plan !== undefined && plan.comboEvery > 0 && playerAttacks % plan.comboEvery === 0
      const firstStrike = passive.firstStrike !== undefined && !firstStrikeSpent
      // Thresholds read HP as it stands *before* this blow lands.
      const lowHp =
        passive.lowHp !== undefined && playerHp < player.maxHp * (passive.lowHpBelow ?? 0.5)

      if (combo) multiplier *= plan!.combo
      if (firstStrike) multiplier *= passive.firstStrike!
      if (lowHp) multiplier *= passive.lowHp!

      const damage = Math.max(1, Math.round((player.atk - enemy.def) * multiplier))
      enemyHp = Math.max(0, enemyHp - damage)
      playerEvent.damage = damage
      if (combo || firstStrike) playerEvent.crit = true
      // Spent only on a landed hit; burning it on a whiff would read as a bug.
      if (firstStrike) {
        firstStrikeSpent = true
        announce(playerEvent, 'precision')
      }
      if (lowHp) announce(playerEvent, 'bloodrage')
    }
    playerEvent.targetHpAfter = enemyHp

    // No healing after a killing blow, so the log always ends on the kill.
    if (enemyHp > 0 && playerHealEvery > 0 && playerAttacks % playerHealEvery === 0) {
      const healed = healAmount(playerHp, player.maxHp, playerHeal, turn)
      if (healed > 0) {
        playerHp += healed
        playerEvent.healed = healed
        playerEvent.selfHpAfter = playerHp
      }
      if (healScale(turn) < 1) announce(playerEvent, 'attrition')
    }

    log.push(playerEvent)
    if (enemyHp <= 0) break

    // ---- enemy attacks ----
    enemyAttacks += 1
    const enemyEvent: TurnEvent = { turn, attacker: 'enemy', damage: 0, targetHpAfter: playerHp }

    const planDodge = plan !== undefined && plan.dodgeEvery > 0 && enemyAttacks % plan.dodgeEvery === 0
    const raceDodge =
      passive.dodgeEvery !== undefined &&
      passive.dodgeEvery > 0 &&
      enemyAttacks % passive.dodgeEvery === 0

    if (planDodge || raceDodge) {
      enemyEvent.dodged = true
    } else {
      const attack = enemyAttackAt(enemy, turn)
      let multiplier = plan?.incoming ?? 1
      const fierce = trait.fierce > 1 && enemyHp <= enemy.maxHp * trait.fierceBelow

      if (fierce) multiplier *= trait.fierce
      if (passive.damageTaken !== undefined) multiplier *= passive.damageTaken

      const damage = Math.max(1, Math.round((attack - player.def) * multiplier))
      playerHp = Math.max(0, playerHp - damage)
      enemyEvent.damage = damage
      if (attack > enemy.atk) announce(enemyEvent, 'enraged')
      if (fierce) announce(enemyEvent, 'fierce')
    }
    enemyEvent.targetHpAfter = playerHp

    if (playerHp > 0 && enemyHealEvery > 0 && enemyAttacks % enemyHealEvery === 0) {
      const healed = healAmount(enemyHp, enemy.maxHp, enemyHeal, turn)
      if (healed > 0) {
        enemyHp += healed
        enemyEvent.healed = healed
        enemyEvent.selfHpAfter = enemyHp
      }
      if (healScale(turn) < 1) announce(enemyEvent, 'attrition')
    }

    log.push(enemyEvent)
  }

  const outcome: BattleOutcome =
    enemyHp <= 0 && playerHp > 0 ? 'win' : playerHp <= 0 ? 'loss' : 'timeout'

  return {
    outcome,
    win: outcome === 'win',
    log,
    playerHpLeft: playerHp,
    enemyHpLeft: enemyHp,
    rewards: outcome === 'win' ? rewards : { exp: 0, gold: 0 },
  }
}
