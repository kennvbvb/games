import { BIOMES, backgroundFor } from './biomes'
import { TRAIT_IDS } from './enemyTraits'
import { STAGES } from './stages'
import { applyMutatorToEnemy, mutatorForFloor } from './towerMutators'
import type { BiomeId, StageVisual } from './biomes'
import type { BossPhase, EnemyConfig, StageConfig } from '../types'

/**
 * The Endless Tower: one floor generated per request, forever.
 *
 * Floors are *computed*, not authored. A hundred hand-written stages is a
 * campaign; an endless mode written the same way is a hundred stages with a
 * different name, and it would end. Everything a floor needs — stats, trait,
 * boss phases, backdrop — is a pure function of the floor number, so floor
 * 4,000 exists and looks like somewhere without anyone typing it out.
 *
 * The curve is the point of difference. The campaign flattens enemy health to
 * order^1.08 so that reward, which is what player power compounds from, can
 * keep up; the tower compounds *geometrically* instead. Player power grows from
 * levels and gear, both of which flatten out, so a geometric enemy always wins
 * eventually. That is what makes a run end — and it is deliberately the
 * opposite choice from the campaign, where nothing walls anybody.
 *
 * The growth rates were swept rather than guessed. Measured against a hero who
 * has just finished the campaign, farming the last cleared floor when stopped:
 *
 *   health x1.075 / attack x1.045  ->  walls at floor 20-30
 *   health x1.050 / attack x1.030  ->  walls at floor 29-40
 *   health x1.035 / attack x1.022  ->  walls at floor 40-60   <- chosen
 *
 * Flatter than this and the climb drags without ever getting anywhere new.
 * Every wall lands on a boss floor, which is the shape wanted: the multiples of
 * ten are the gates, and the nine floors between them are the run-up.
 */
const BOSS_EVERY = 10

const HP_BASE = 2100
const HP_GROWTH = 1.035
const ATK_BASE = 92
const ATK_GROWTH = 1.022
/**
 * Defence is nearly flat and capped on purpose. It is subtracted before the
 * minimum-1 damage floor, so a defence that climbed with the rest of the curve
 * would stop a low-attack kin dealing anything at all — the run would not get
 * harder, it would become arithmetically impossible while the health bar still
 * suggested a fight. Health and attack carry the difficulty instead.
 */
const DEF_BASE = 52
const DEF_PER_FLOOR = 1.4
const DEF_CAP = 220

const GOLD_BASE = 90
const GOLD_GROWTH = 1.055
const EXP_BASE = 150
const EXP_GROWTH = 1.05

const BOSS_HP = 1.22
const BOSS_ATK = 1.08
const BOSS_REWARD = 1.6

export const TOWER_FIRST_FLOOR = 1

/** Worlds that must be fully cleared before the tower opens at all. */
export const TOWER_UNLOCK_WORLDS = 20

const BIOME_IDS = Object.keys(BIOMES) as BiomeId[]

export function isTowerBossFloor(floor: number): boolean {
  return floor % BOSS_EVERY === 0
}

/**
 * Phases deepen every fifty floors and then stop growing.
 *
 * Uncapped phase counts would eventually make a boss a list of scripted
 * transitions rather than a fight, and each phase costs the player a rewind
 * when it surprises them. Three is where the campaign's own bosses top out, so
 * the tower tops out there too and lets the stat curve do the rest.
 */
function towerPhases(floor: number): BossPhase[] {
  if (!isTowerBossFloor(floor)) return []
  const depth = Math.min(3, 1 + Math.floor(floor / 50))

  const phases: BossPhase[] = [
    { atHpBelow: 0.6, labelKey: 'boss.phaseHarden', atkScale: 1.15, defScale: 1.15 },
  ]
  if (depth >= 2) {
    phases.push({ atHpBelow: 0.35, labelKey: 'boss.phaseShield', shield: 0.15, trait: 'shielded' })
  }
  if (depth >= 3) {
    phases.push({
      atHpBelow: 0.15,
      labelKey: 'boss.phaseCleanse',
      cleanse: true,
      atkScale: 1.12,
      inflict: { id: 'curse', turns: 8 },
    })
  }
  return phases
}

/**
 * The trait a floor fights under.
 *
 * Walked rather than picked at random: the tower has no shuffle anywhere in it,
 * so a floor is the same floor on every device and in every run, and the stage
 * preview stays an exact simulation rather than a guess. A boss floor never
 * starts on the trait its own shield phase swaps it into, for the same reason
 * the campaign bosses do not — that stacked the effect twice and was a real
 * balance bug the first time it happened.
 */
export function towerTrait(floor: number): (typeof TRAIT_IDS)[number] {
  const trait = TRAIT_IDS[(floor - 1) % TRAIT_IDS.length]
  if (isTowerBossFloor(floor) && trait === 'shielded') return 'fierce'
  return trait
}

export function towerVisual(floor: number): StageVisual {
  const biome = BIOME_IDS[(floor - 1) % BIOME_IDS.length]
  const pool = BIOMES[biome].decor
  return { biome, landmark: pool[(floor - 1) % pool.length] }
}

/**
 * The floor's enemy, before the band rule is applied. Kept separate so the
 * curve above stays readable as a curve — the rule is a layer on top of it,
 * exactly as the difficulty modes are a layer on top of the campaign's.
 */
function baseTowerEnemy(floor: number): EnemyConfig {
  const n = floor - 1
  const maxHp = Math.round(HP_BASE * HP_GROWTH ** n)
  const atk = Math.round(ATK_BASE * ATK_GROWTH ** n)
  const def = Math.min(DEF_CAP, Math.round(DEF_BASE + DEF_PER_FLOOR * n))
  // Sprites cycle through the ones the campaign already preloads, so a floor
  // never asks for a texture that is not on disk.
  const base = {
    name: `Warden ${floor}`,
    sprite: STAGES[n % STAGES.length].enemy.sprite,
    trait: towerTrait(floor),
    def,
  }

  if (!isTowerBossFloor(floor)) return { ...base, maxHp, atk }
  return {
    ...base,
    maxHp: Math.round(maxHp * BOSS_HP),
    atk: Math.round(atk * BOSS_ATK),
    boss: { enrageAfterTurn: 6, enrageAtkPerTurn: 0.15, phases: towerPhases(floor) },
  }
}

/**
 * A floor shaped exactly like a campaign stage, so every system that already
 * knows how to fight, preview, farm and log a stage takes the tower for free.
 * The id is positional and outside the `stage-` namespace, which keeps a floor
 * from ever being mistaken for campaign progress by the save validator.
 */
export function towerEnemy(floor: number): EnemyConfig {
  return applyMutatorToEnemy(baseTowerEnemy(floor), mutatorForFloor(floor))
}

export function towerFloor(floor: number): StageConfig {
  const clamped = Math.max(TOWER_FIRST_FLOOR, Math.floor(floor))
  const visual = towerVisual(clamped)
  const multiplier = isTowerBossFloor(clamped) ? BOSS_REWARD : 1
  const n = clamped - 1
  return {
    id: `tower-${clamped}`,
    name: `Floor ${clamped}`,
    order: clamped,
    enemy: towerEnemy(clamped),
    rewards: {
      exp: Math.round(EXP_BASE * EXP_GROWTH ** n * multiplier),
      gold: Math.round(GOLD_BASE * GOLD_GROWTH ** n * multiplier),
    },
    bg: backgroundFor(visual),
    visual,
  }
}

export function isTowerStageId(id: string): boolean {
  return id.startsWith('tower-')
}
