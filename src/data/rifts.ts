import { BIOMES, backgroundFor } from './biomes'
import { STAGES } from './stages'
import type { BiomeId } from './biomes'
import type { TraitId } from './enemyTraits'
import type { ModifierSource } from '../systems/combatModifiers'
import type { MessageKey } from '../i18n'
import type { EnemyConfig, StageConfig } from '../types'

/**
 * The Realm Rift: one fight, rebuilt every week from the week number.
 *
 * The rotation is seeded rather than random. Everybody playing in the same week
 * gets the same rift, which is what makes it worth talking about, and the whole
 * thing is still a pure function so the pre-fight forecast remains an exact
 * simulation like everywhere else in the game.
 *
 * ## What the rift deliberately does not pay
 *
 * Nothing permanent. The week is read from the device clock, and there is no
 * server to check it against — a player who moves their clock forward can claim
 * as many weeks as they have patience for. Every option that closes that hole
 * needs a server, so instead the rift is built so the hole is not worth
 * crawling through: it pays gold and EXP, which the game already hands out
 * without limit through idle farming. Clock-shifting the rift buys the same
 * thing as leaving the game running, which is to say nothing.
 *
 * That is the reason relics stayed on the mastery track, where they are earned
 * from campaign progress a clock cannot fake, rather than being the rift's
 * prize as first sketched.
 */
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** Worlds that must be cleared before the rift appears at all. */
export const RIFT_UNLOCK_WORLDS = 8

/**
 * Weeks since the epoch. Monday-aligned is not worth the complication — what
 * matters is only that the number changes exactly once every seven days and is
 * the same number for everyone in that span.
 */
export function weekIndex(now: number = Date.now()): number {
  return Math.max(0, Math.floor(now / WEEK_MS))
}

export function weekStart(week: number): number {
  return week * WEEK_MS
}

/** A boon helps the player; every week grants exactly one. */
export interface RiftBoon {
  id: string
  nameKey: MessageKey
  descriptionKey: MessageKey
  sprite: string
  mods: ModifierSource
}

/** A bane hardens the rift; every week carries exactly one. */
export interface RiftBane {
  id: string
  nameKey: MessageKey
  descriptionKey: MessageKey
  sprite: string
  /** Applied to the rift enemy on top of the base stat block. */
  hpScale: number
  atkScale: number
  trait: TraitId
}

export const BOONS: RiftBoon[] = [
  {
    id: 'boon-edge',
    nameKey: 'rift.boonEdge',
    descriptionKey: 'rift.boonEdgeHint',
    sprite: 'icon_atk',
    mods: { outgoing: 1.35 },
  },
  {
    id: 'boon-ward',
    nameKey: 'rift.boonWard',
    descriptionKey: 'rift.boonWardHint',
    sprite: 'icon_def',
    mods: { incoming: 0.7 },
  },
  {
    id: 'boon-vigour',
    nameKey: 'rift.boonVigour',
    descriptionKey: 'rift.boonVigourHint',
    sprite: 'icon_hp',
    mods: { hpScale: 1.4 },
  },
  {
    id: 'boon-rhythm',
    nameKey: 'rift.boonRhythm',
    descriptionKey: 'rift.boonRhythmHint',
    sprite: 'icon_bolt',
    mods: { comboEvery: 3, combo: 1.5 },
  },
  {
    id: 'boon-mirror',
    nameKey: 'rift.boonMirror',
    descriptionKey: 'rift.boonMirrorHint',
    sprite: 'decor_crystal',
    mods: { dodgeEvery: 4, counter: 0.75 },
  },
  {
    id: 'boon-spring',
    nameKey: 'rift.boonSpring',
    descriptionKey: 'rift.boonSpringHint',
    sprite: 'decor_droplet',
    mods: { heal: 0.07, healEvery: 3, barrier: true },
  },
  {
    id: 'boon-hunt',
    nameKey: 'rift.boonHunt',
    descriptionKey: 'rift.boonHuntHint',
    sprite: 'decor_bone',
    mods: { execute: 1.8, executeBelow: 0.3 },
  },
]

export const BANES: RiftBane[] = [
  {
    id: 'bane-bulk',
    nameKey: 'rift.baneBulk',
    descriptionKey: 'rift.baneBulkHint',
    sprite: 'decor_rock',
    hpScale: 1.55,
    atkScale: 0.95,
    trait: 'armored',
  },
  {
    id: 'bane-fury',
    nameKey: 'rift.baneFury',
    descriptionKey: 'rift.baneFuryHint',
    sprite: 'decor_fire',
    hpScale: 1.05,
    atkScale: 1.35,
    trait: 'fierce',
  },
  {
    id: 'bane-venom',
    nameKey: 'rift.baneVenom',
    descriptionKey: 'rift.baneVenomHint',
    sprite: 'decor_herb',
    hpScale: 1.2,
    atkScale: 1.05,
    trait: 'venomous',
  },
  {
    id: 'bane-thorns',
    nameKey: 'rift.baneThorns',
    descriptionKey: 'rift.baneThornsHint',
    sprite: 'decor_cactus',
    hpScale: 1.25,
    atkScale: 1,
    trait: 'countering',
  },
  {
    id: 'bane-thirst',
    nameKey: 'rift.baneThirst',
    descriptionKey: 'rift.baneThirstHint',
    sprite: 'decor_gem',
    hpScale: 1.15,
    atkScale: 1.15,
    trait: 'vampiric',
  },
  {
    id: 'bane-veil',
    nameKey: 'rift.baneVeil',
    descriptionKey: 'rift.baneVeilHint',
    sprite: 'decor_fog',
    hpScale: 1.3,
    atkScale: 1,
    trait: 'shielded',
  },
]

const BIOME_IDS = Object.keys(BIOMES) as BiomeId[]

/**
 * How far above the player's own frontier the rift sits.
 *
 * A rift with fixed stats cannot work across the range this game covers. Built
 * for the eight-world gate it would be a joke by world twenty; built for
 * twenty, it is unwinnable at eight — measured, not guessed: a fixed 3400-health
 * rift was beaten in 0 of 42 weeks by every kin at the gate, and still only 25
 * to 38 of 42 by a hero who had finished the whole campaign.
 *
 * So the *shape* of the week is shared — same boon, same bane, same look, same
 * name — and the numbers meet the player where they are, scaled off the last
 * world boss they actually beat. Two players comparing notes are comparing the
 * same fight; they are simply not fighting the same health bar.
 */
const TIER_HP = 1.3
const TIER_ATK = 1.1
const TIER_REWARD = 3.2

/** The rift creeps up week over week so a long-running save keeps a reason to open it. */
const WEEKLY_HP_STEP = 0.02
const WEEKLY_ATK_STEP = 0.012

export interface Rift {
  week: number
  /** Worlds cleared when this rift was built; the numbers are scaled off it. */
  tier: number
  boon: RiftBoon
  bane: RiftBane
  stage: StageConfig
}

/** The frontier the rift is measured against: the last world boss beaten. */
function tierStage(tier: number) {
  const worlds = Math.min(Math.max(Math.floor(tier), 1), STAGES.length / 5)
  return STAGES[worlds * 5 - 1]
}

/**
 * Boon and bane are walked off the week with *different strides*, so the pair
 * cycles over 42 weeks rather than repeating every 7. Co-prime counts (7 boons,
 * 6 banes) are what make that work, and a test pins it — picking both with the
 * same index would have shipped a rotation that repeats within two months.
 */
export function boonForWeek(week: number): RiftBoon {
  return BOONS[week % BOONS.length]
}

export function baneForWeek(week: number): RiftBane {
  return BANES[week % BANES.length]
}

export function riftEnemy(week: number, tier: number): EnemyConfig {
  const bane = baneForWeek(week)
  const base = tierStage(tier).enemy
  const drift = week % 52
  return {
    name: `Riftborn ${week % 1000}`,
    sprite: STAGES[week % STAGES.length].enemy.sprite,
    maxHp: Math.round(base.maxHp * TIER_HP * bane.hpScale * (1 + WEEKLY_HP_STEP) ** drift),
    atk: Math.round(base.atk * TIER_ATK * bane.atkScale * (1 + WEEKLY_ATK_STEP) ** drift),
    // Defence tracks the frontier untouched. Scaling it up here would push a
    // low-attack kin onto the minimum-1 damage floor, which is the same trap
    // the difficulty modes and the tower both step around.
    def: base.def,
    trait: bane.trait,
    boss: {
      enrageAfterTurn: 6,
      enrageAtkPerTurn: 0.15,
      phases: [{ atHpBelow: 0.45, labelKey: 'boss.phaseHarden', atkScale: 1.18, defScale: 1.12 }],
    },
  }
}

export function riftFor(week: number, tier: number = RIFT_UNLOCK_WORLDS): Rift {
  const biome = BIOME_IDS[week % BIOME_IDS.length]
  const pool = BIOMES[biome].decor
  const visual = { biome, landmark: pool[week % pool.length] }
  const frontier = tierStage(tier)
  return {
    week,
    tier,
    boon: boonForWeek(week),
    bane: baneForWeek(week),
    stage: {
      // Outside the `stage-` and `tower-` namespaces for the same reason both
      // of those are kept apart: a rift id must never read as campaign
      // progress. The tier is deliberately *not* in the id — the boon is read
      // back out of it, and the boon is the part that must be identical for
      // everyone in a given week.
      id: `rift-${week}`,
      name: `Rift ${week}`,
      order: week,
      enemy: riftEnemy(week, tier),
      rewards: {
        exp: Math.round(frontier.rewards.exp * TIER_REWARD * (1 + WEEKLY_HP_STEP) ** (week % 52)),
        gold: Math.round(frontier.rewards.gold * TIER_REWARD * (1 + WEEKLY_HP_STEP) ** (week % 52)),
      },
      bg: backgroundFor(visual),
      visual,
    },
  }
}

export function isRiftStageId(id: string): boolean {
  return id.startsWith('rift-')
}

/**
 * The boon a rift stage is fought under, read back out of its own id rather
 * than from the clock.
 *
 * Taking it from `Date.now()` would mean a preview rendered on Sunday night and
 * a fight begun a minute later could disagree about which boon is running — the
 * one case where the forecast would stop being an exact simulation. The week is
 * baked into the id, so the stage carries its own boon wherever it travels.
 */
export function boonForStageId(id: string): RiftBoon | undefined {
  if (!isRiftStageId(id)) return undefined
  const week = Number.parseInt(id.slice('rift-'.length), 10)
  return Number.isFinite(week) ? boonForWeek(week) : undefined
}
