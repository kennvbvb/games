import { traitOf } from '../data/enemyTraits'
import {
  applyStatus,
  attackScale,
  cleanse,
  decayStatuses,
  defenceScale,
  healingScale,
  reflectFraction,
  tickStatuses,
} from './status'
import type { StatusBag } from './status'
import { NEUTRAL, foldModifiers, planModifiers } from './combatModifiers'
import type { CombatModifiers, ModifierSource } from './combatModifiers'
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

/**
 * Passive hooks a race contributes. Kept as its own shape because it is what
 * `data/races` is written in; `raceModifiers` translates it.
 */
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

export function raceModifiers(passive: RaceCombatPassive | undefined): ModifierSource | undefined {
  if (!passive) return undefined
  return {
    firstStrike: passive.firstStrike,
    lowHp: passive.lowHp,
    lowHpBelow: passive.lowHpBelow,
    incoming: passive.damageTaken,
    dodgeEvery: passive.dodgeEvery,
    heal: passive.heal,
    healEvery: passive.healEvery,
  }
}

export interface BattleContext {
  player: PlayerStats
  enemy: EnemyConfig
  rewards: StageRewards
  /** Omitted means no plan modifiers, which keeps pre-plan results reproducible. */
  plan?: PlanId
  /** Omitted means no racial passive. */
  passive?: RaceCombatPassive
  /**
   * Anything else bending the fight — equipped skills, gear affixes, set
   * bonuses. Folded into the same product as the plan and the passive, so a
   * new system cannot reorder the existing ones.
   */
  modifiers?: (ModifierSource | undefined)[]
}

/** The player's stat block after percentage modifiers, rounded once. */
function scaledStats(stats: PlayerStats, mods: CombatModifiers): PlayerStats {
  if (mods.hpScale === 1 && mods.atkScale === 1 && mods.defScale === 1) return stats
  return {
    maxHp: Math.max(1, Math.round(stats.maxHp * mods.hpScale)),
    atk: Math.max(1, Math.round(stats.atk * mods.atkScale)),
    def: Math.max(0, Math.round(stats.def * mods.defScale)),
  }
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
  const { enemy, rewards } = ctx
  const trait = traitOf(enemy.trait)
  const mods = foldModifiers([
    planModifiers(ctx.plan),
    raceModifiers(ctx.passive),
    ...(ctx.modifiers ?? []),
  ])
  const player = scaledStats(ctx.player, mods)
  const isBoss = enemy.boss !== undefined

  let playerHp = player.maxHp
  let enemyHp = enemy.maxHp
  // Statuses ride on the side they afflict, not the side that applied them.
  let playerStatuses: StatusBag = []
  let enemyStatuses: StatusBag = []
  let playerHitsTaken = 0
  let enemyHitsTaken = 0
  let phasesEntered = 0
  const phases = [...(enemy.boss?.phases ?? [])].sort((a, b) => b.atHpBelow - a.atHpBelow)
  let phaseAtk = 1
  let phaseDef = 1
  let enemyShield = 0
  let activeTrait = trait
  // Shield sits in front of health and is spent first. It is deliberately not
  // part of Max HP: a build that runs on shields should read as fragile on the
  // health bar, because it is — nothing refills it once the sources stop.
  let shield = Math.round(player.maxHp * mods.shield * mods.sustainScale)
  // Counters advance on every *attempted* attack, dodged or not. One counter
  // per side means a dodge cannot silently shift an unrelated effect's cadence,
  // and the player can predict every proc by counting blows on screen.
  let playerAttacks = 0
  let enemyAttacks = 0
  let firstStrikeSpent = false
  const announced = new Set<AnnounceKind>()
  const log: TurnEvent[] = []
  let turn = 0

  // A Shielded enemy starts behind one; a phase can grant another later.
  enemyShield = Math.round(enemy.maxHp * (trait.shield ?? 0))

  /** At most one announcement per blow; a loser stays unlatched and tries again. */
  const announce = (event: TurnEvent, kind: AnnounceKind) => {
    if (announced.has(kind) || event.announce !== undefined) return
    event.announce = kind
    announced.add(kind)
  }

  /**
   * Restores health, then turns any excess into shield when a barrier effect is
   * running. Returning both parts keeps overflow past Max HP structurally
   * impossible whether or not a barrier is in play.
   */
  const applyHeal = (fraction: number): { healed: number; banked: number } => {
    if (fraction <= 0) return { healed: 0, banked: 0 }
    const raw = Math.round(player.maxHp * fraction * healScale(turn) * mods.sustainScale)
    if (raw <= 0) return { healed: 0, banked: 0 }
    const healed = Math.min(raw, player.maxHp - playerHp)
    const banked = mods.barrier ? raw - healed : 0
    playerHp += healed
    shield += banked
    return { healed, banked }
  }

  /** Applies a blow to the player, spending shield before health. */
  const strikePlayer = (damage: number): number => {
    const absorbed = Math.min(shield, damage)
    shield -= absorbed
    playerHp = Math.max(0, playerHp - (damage - absorbed))
    return absorbed
  }

  /** Applies a blow to the enemy, spending its shield before its health. */
  const strikeEnemy = (damage: number): number => {
    const absorbed = Math.min(enemyShield, damage)
    enemyShield -= absorbed
    enemyHp = Math.max(0, enemyHp - (damage - absorbed))
    return absorbed
  }

  /**
   * Enters every phase the boss has crossed into. One-way on purpose: a boss
   * healed back above a threshold does not un-transform, because a fight that
   * could re-enter a phase could re-enter it forever.
   */
  const checkPhases = (event: TurnEvent) => {
    while (phasesEntered < phases.length && enemyHp > 0 && enemyHp <= enemy.maxHp * phases[phasesEntered].atHpBelow) {
      const phase = phases[phasesEntered]
      phasesEntered += 1
      phaseAtk *= phase.atkScale ?? 1
      phaseDef *= phase.defScale ?? 1
      if (phase.shield) enemyShield += Math.round(enemy.maxHp * phase.shield)
      if (phase.cleanse) enemyStatuses = cleanse(enemyStatuses)
      if (phase.trait) activeTrait = traitOf(phase.trait)
      if (phase.inflict) playerStatuses = applyStatus(playerStatuses, phase.inflict, 'enemy')
      announce(event, 'phase')
    }
  }

  while (playerHp > 0 && enemyHp > 0 && turn < MAX_TURNS) {
    turn++

    // ---- player attacks ----
    playerAttacks += 1
    const playerEvent: TurnEvent = { turn, attacker: 'player', damage: 0, targetHpAfter: enemyHp }

    // Statuses resolve before the blow: a burn that kills should kill, rather
    // than being outrun by the attack it would have prevented.
    const playerTick = tickStatuses(playerStatuses, player.maxHp, playerHitsTaken)
    if (playerTick.damage > 0) {
      playerHp = Math.max(0, playerHp - playerTick.damage)
      playerEvent.statusDamage = playerTick.damage
    }
    if (playerTick.heal > 0) {
      playerHp = Math.min(player.maxHp, playerHp + Math.round(playerTick.heal * healingScale(playerStatuses)))
    }
    if (playerHp <= 0) {
      playerEvent.targetHpAfter = enemyHp
      log.push(playerEvent)
      break
    }

    if (playerTick.skipsTurn) {
      playerEvent.frozen = true
    } else if (activeTrait.dodgeEvery > 0 && playerAttacks % activeTrait.dodgeEvery === 0) {
      // A gate, not a zero multiplier — the minimum-1 floor would undo a zero.
      playerEvent.dodged = true
    } else {
      let multiplier = mods.outgoing
      const combo = mods.comboEvery > 0 && playerAttacks % mods.comboEvery === 0
      const firstStrike = mods.firstStrike !== 1 && !firstStrikeSpent
      // Thresholds read HP as it stands *before* this blow lands.
      const lowHp = mods.lowHp !== 1 && playerHp < player.maxHp * mods.lowHpBelow
      const execute = mods.execute !== 1 && enemyHp <= enemy.maxHp * mods.executeBelow

      if (combo) multiplier *= mods.combo
      if (firstStrike) multiplier *= mods.firstStrike
      if (lowHp) multiplier *= mods.lowHp
      if (execute) multiplier *= mods.execute
      if (isBoss) multiplier *= mods.bossDamage

      // Weaken cuts the player's attack; Armor Break and the enemy's own
      // traits and phases move its defence.
      const atk = player.atk * attackScale(playerStatuses)
      // Pierce comes off after the enemy's own multipliers, so armouring up
      // still helps the enemy — it just stops being an answer on its own. The
      // floor at zero keeps a heavily pierced enemy from handing the player
      // *bonus* damage for defence it does not have.
      const scaledDef = enemy.def * (activeTrait.defScale ?? 1) * phaseDef * defenceScale(enemyStatuses)
      const def = Math.max(0, scaledDef - mods.pierce)
      const damage = Math.max(1, Math.round((atk - def) * multiplier))
      const absorbed = strikeEnemy(damage)
      enemyHitsTaken += 1
      playerEvent.damage = damage
      if (absorbed > 0) playerEvent.absorbed = absorbed

      // Countering sends part of the blow straight back, on the same event.
      const thrownBack = Math.round(damage * ((activeTrait.reflect ?? 0) + reflectFraction(enemyStatuses)))
      if (thrownBack > 0) {
        strikePlayer(thrownBack)
        playerEvent.counter = thrownBack
      }
      if (combo || firstStrike || execute) playerEvent.crit = true
      // Spent only on a landed hit; burning it on a whiff would read as a bug.
      if (firstStrike) {
        firstStrikeSpent = true
        announce(playerEvent, 'precision')
      }
      if (lowHp) announce(playerEvent, 'bloodrage')
      if (execute) announce(playerEvent, 'execute')
    }
    playerEvent.targetHpAfter = enemyHp
    checkPhases(playerEvent)

    // No healing after a killing blow, so the log always ends on the kill.
    if (enemyHp > 0 && mods.healEvery > 0 && playerAttacks % mods.healEvery === 0) {
      const { healed, banked } = applyHeal(mods.heal * healingScale(playerStatuses))
      if (healed > 0 || banked > 0) {
        if (healed > 0) playerEvent.healed = healed
        if (banked > 0) playerEvent.barriered = banked
        playerEvent.selfHpAfter = playerHp
      }
      if (healScale(turn) < 1) announce(playerEvent, 'attrition')
    }

    log.push(playerEvent)
    if (enemyHp <= 0 || playerHp <= 0) break

    // ---- enemy attacks ----
    enemyAttacks += 1
    const enemyEvent: TurnEvent = { turn, attacker: 'enemy', damage: 0, targetHpAfter: playerHp }

    const enemyTick = tickStatuses(enemyStatuses, enemy.maxHp, enemyHitsTaken)
    if (enemyTick.damage > 0) {
      enemyHp = Math.max(0, enemyHp - enemyTick.damage)
      enemyEvent.statusDamage = enemyTick.damage
    }
    if (enemyTick.heal > 0) enemyHp = Math.min(enemy.maxHp, enemyHp + enemyTick.heal)
    if (enemyHp <= 0) {
      enemyEvent.targetHpAfter = playerHp
      log.push(enemyEvent)
      break
    }

    if (enemyTick.skipsTurn) {
      enemyEvent.frozen = true
    } else if (mods.dodgeEvery > 0 && enemyAttacks % mods.dodgeEvery === 0) {
      enemyEvent.dodged = true
      // A counter rides on the dodge rather than taking its own turn, so a
      // dodge build still trades in the same number of turns as everyone else.
      if (mods.counter > 0) {
        const damage = Math.max(1, Math.round((player.atk - enemy.def) * mods.counter))
        enemyHp = Math.max(0, enemyHp - damage)
        enemyEvent.counter = damage
        enemyEvent.counterHpAfter = enemyHp
      }
    } else {
      // An Unstable enemy alternates between a wilder swing and a wider
      // opening; both halves key off the turn number, so it stays predictable.
      const swinging = activeTrait.alternateEvery
        ? turn % activeTrait.alternateEvery === 0
        : false
      const attack =
        enemyAttackAt(enemy, turn) *
        phaseAtk *
        attackScale(enemyStatuses) *
        (swinging ? (activeTrait.alternateAtk ?? 1) : 1)
      let multiplier = mods.incoming * (swinging ? (activeTrait.alternateIncoming ?? 1) : 1)
      const fierce = activeTrait.fierce > 1 && enemyHp <= enemy.maxHp * activeTrait.fierceBelow

      if (fierce) multiplier *= activeTrait.fierce

      const def = player.def * defenceScale(playerStatuses)
      const damage = Math.max(1, Math.round((attack - def) * multiplier))
      const absorbed = strikePlayer(damage)
      playerHitsTaken += 1
      enemyEvent.damage = damage
      if (absorbed > 0) enemyEvent.absorbed = absorbed
      if (enemyAttackAt(enemy, turn) > enemy.atk) announce(enemyEvent, 'enraged')
      if (fierce) announce(enemyEvent, 'fierce')

      // Vampiric drinks back part of what it dealt; the player's own Reflect
      // sends part of it home.
      if (activeTrait.drain) {
        enemyHp = Math.min(enemy.maxHp, enemyHp + Math.round(damage * activeTrait.drain))
        enemyEvent.selfHpAfter = enemyHp
      }
      const sentBack = Math.round(damage * reflectFraction(playerStatuses))
      if (sentBack > 0) {
        strikeEnemy(sentBack)
        enemyEvent.counter = sentBack
        enemyEvent.counterHpAfter = enemyHp
      }

      // Statuses land only on a blow that connected, so a dodge is a clean
      // escape rather than "you avoided the hit but caught the poison".
      const inflict = activeTrait.inflict
      if (inflict && (!inflict.everyN || enemyAttacks % inflict.everyN === 0)) {
        playerStatuses = applyStatus(playerStatuses, inflict, 'enemy')
        enemyEvent.applied = [inflict.id]
      }
    }
    enemyEvent.targetHpAfter = playerHp

    if (playerHp > 0 && enemyHp > 0 && activeTrait.healEvery > 0 && enemyAttacks % activeTrait.healEvery === 0) {
      const raw = Math.round(enemy.maxHp * activeTrait.heal * healScale(turn))
      const healed = Math.max(0, Math.min(raw, enemy.maxHp - enemyHp))
      if (healed > 0) {
        enemyHp += healed
        enemyEvent.healed = healed
        enemyEvent.selfHpAfter = enemyHp
      }
      if (healScale(turn) < 1) announce(enemyEvent, 'attrition')
    }

    enemyEvent.targetHpAfter = playerHp
    checkPhases(enemyEvent)
    log.push(enemyEvent)
    if (enemyHp <= 0) break

    // Durations count down once per full turn, at the end, so a status applied
    // this turn is still running when its owner next acts.
    playerStatuses = decayStatuses(playerStatuses)
    enemyStatuses = decayStatuses(enemyStatuses)
  }

  const outcome: BattleOutcome =
    enemyHp <= 0 && playerHp > 0 ? 'win' : playerHp <= 0 ? 'loss' : 'timeout'

  return {
    outcome,
    win: outcome === 'win',
    log,
    playerHpLeft: playerHp,
    playerMaxHp: player.maxHp,
    enemyHpLeft: enemyHp,
    shieldLeft: shield,
    phasesEntered,
    rewards: outcome === 'win' ? rewards : { exp: 0, gold: 0 },
  }
}

export { NEUTRAL }
