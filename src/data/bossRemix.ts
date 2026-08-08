import { WORLDS } from './worlds'
import { TRAIT_IDS } from './enemyTraits'
import { backgroundFor } from './biomes'
import type { MessageKey } from '../i18n'
import type { BossPhase, EnemyConfig, StageConfig } from '../types'

/**
 * Boss Remix: the twenty world bosses, brought back harder.
 *
 * The expansion plan asks for the existing bosses to be reused rather than for
 * twenty more to be written, and for three things to be true of the result:
 * each boss should suit a different build, no build should be best against all
 * of them, and the important rewards should be guaranteed rather than rolled.
 *
 * ## Two traits, not one
 *
 * "Paired traits" is built out of machinery the bosses already have. An
 * `EnemyConfig` carries one trait, but a boss phase can *swap* it — so a remix
 * boss opens on its campaign trait and changes to a second one partway down its
 * health bar. That is a pair the player meets in sequence rather than at once,
 * which is legible in a way two simultaneous traits are not, and it costs the
 * turn loop nothing: phase trait swaps already work, are already deterministic,
 * and already show up in the pre-fight intel panel.
 *
 * The second trait is walked from the boss's own index, never shuffled, so a
 * remix is the same fight on every device and the forecast stays exact.
 *
 * ## Nothing new in the save
 *
 * A remix is unlocked by having beaten that boss in the campaign, which the
 * save already records. Its relic is "first clear" by virtue of not being owned
 * yet, which the save already records too. So the whole mode adds no stored
 * field and no schema bump — and, like the Codex, it is retroactive: a save
 * from before it existed arrives with every remix it has earned already open.
 */

export type RemixTierId = 'normal' | 'veteran' | 'mythic'

export interface RemixTier {
  id: RemixTierId
  nameKey: MessageKey
  hp: number
  atk: number
  reward: number
  /** Worlds that must be fully cleared before this tier is offered at all. */
  unlockWorlds: number
  /**
   * Stat floors, as `base + perWorld * world`. Absent on Normal.
   *
   * A multiplier on the campaign boss cannot work for the gated tiers, and the
   * measurement is unambiguous. A hero who has finished the campaign carries
   * 134-178 defence; the World 20 boss attacks for 90, and x1.45 of that is
   * 131. Defence is subtracted before the minimum-1 damage floor, so *every*
   * blow lands for exactly 1 and multiplying the boss's health only makes the
   * formality longer. Measured across all six kin, every relic boss at every
   * tier finished with the hero on 100% health.
   *
   * Health needs a floor for the same reason: a World 5 boss at x2.4 health is
   * still under a thousand, which an endgame hero deletes in three turns no
   * matter how hard it hits back.
   *
   * Veteran and Mythic therefore get their own curve, anchored to what an
   * endgame hero actually wears rather than to a campaign number balanced for a
   * level-20 one — the same reasoning that gives the tower its own curve
   * instead of extending the campaign's. Both tiers are gated behind most or
   * all of the campaign, so every fight in them is an endgame fight and the
   * world index is a modest ramp rather than the main axis.
   *
   * Normal keeps the multiplier on purpose: it opens after a single world boss,
   * so it is fought by players anywhere in the campaign and has to scale with
   * where they are rather than with where they will end up.
   */
  atkFloor?: { base: number; perWorld: number }
  hpFloor?: { base: number; perWorld: number }
}

/**
 * Even the gentlest tier is a step up on the campaign fight. A "Normal" that
 * re-ran the boss exactly as it was would be a fight the player has already
 * proven, and proving it twice tests nothing.
 */
export const REMIX_TIERS: RemixTier[] = [
  { id: 'normal', nameKey: 'remix.normal', hp: 1.25, atk: 1.1, reward: 1.4, unlockWorlds: 0 },
  {
    id: 'veteran',
    nameKey: 'remix.veteran',
    hp: 1.7,
    atk: 1.25,
    reward: 2.2,
    unlockWorlds: 12,
    atkFloor: { base: 230, perWorld: 3 },
    hpFloor: { base: 2200, perWorld: 40 },
  },
  {
    id: 'mythic',
    nameKey: 'remix.mythic',
    hp: 2.4,
    atk: 1.45,
    reward: 3.4,
    unlockWorlds: 20,
    atkFloor: { base: 340, perWorld: 4 },
    hpFloor: { base: 3600, perWorld: 60 },
  },
]

export const REMIX_TIER_BY_ID = new Map(REMIX_TIERS.map((tier) => [tier.id, tier]))

/**
 * Which boss pays which relic, on first clear of Mythic.
 *
 * Mythic rather than Normal because the three tiers otherwise have no reason to
 * exist as a ladder: the lower two are the run-up, and the relic is what the
 * top of the climb is for. Spread across the campaign's back half so no single
 * evening's play collects the set.
 */
export const REMIX_RELIC_BOSSES: { world: number; itemId: string }[] = [
  { world: 5, itemId: 'hunter-knives' },
  { world: 8, itemId: 'aegis-lance' },
  { world: 11, itemId: 'mirror-plate' },
  { world: 14, itemId: 'fortress-heart' },
  { world: 17, itemId: 'rhythm-dial' },
  { world: 20, itemId: 'sunbreaker-axe' },
]

export function relicForRemix(world: number, tier: RemixTierId): string | undefined {
  if (tier !== 'mythic') return undefined
  return REMIX_RELIC_BOSSES.find((entry) => entry.world === world)?.itemId
}

/**
 * The trait a remix boss changes into.
 *
 * Walked from the boss's index and skipped past its own opening trait, so the
 * pair is always two different things — a boss that "changes" into what it
 * already was is a phase banner announcing nothing.
 */
export function secondTrait(world: number, opening: string | undefined): (typeof TRAIT_IDS)[number] {
  const start = (world * 3) % TRAIT_IDS.length
  for (let i = 0; i < TRAIT_IDS.length; i += 1) {
    const candidate = TRAIT_IDS[(start + i) % TRAIT_IDS.length]
    if (candidate !== opening) return candidate
  }
  return TRAIT_IDS[0]
}

function remixPhases(world: number, opening: string | undefined, tier: RemixTier): BossPhase[] {
  const phases: BossPhase[] = [
    {
      atHpBelow: 0.55,
      labelKey: 'remix.phaseTurn',
      trait: secondTrait(world, opening),
      atkScale: 1.1,
    },
  ]
  if (tier.id !== 'normal') {
    phases.push({ atHpBelow: 0.3, labelKey: 'boss.phaseShield', shield: 0.18, cleanse: true })
  }
  return phases
}

/**
 * The attack a remix boss actually swings with: the larger of the campaign
 * boss scaled by the tier, and the tier's own floor. Whichever is larger, never
 * a blend — a blend would make the early bosses drift up and the late ones down
 * and leave neither curve saying what it means.
 */
export function remixAttack(world: number, tier: RemixTier): number {
  const scaled = Math.round(WORLDS[world - 1].boss.enemy.atk * tier.atk)
  if (!tier.atkFloor) return scaled
  return Math.max(scaled, Math.round(tier.atkFloor.base + tier.atkFloor.perWorld * world))
}

export function remixHealth(world: number, tier: RemixTier): number {
  const scaled = Math.round(WORLDS[world - 1].boss.enemy.maxHp * tier.hp)
  if (!tier.hpFloor) return scaled
  return Math.max(scaled, Math.round(tier.hpFloor.base + tier.hpFloor.perWorld * world))
}

export function remixEnemy(world: number, tier: RemixTier): EnemyConfig {
  const boss = WORLDS[world - 1].boss.enemy
  return {
    ...boss,
    name: boss.name,
    maxHp: remixHealth(world, tier),
    atk: remixAttack(world, tier),
    // Defence is left exactly as the campaign set it. Scaling it would push a
    // low-attack kin onto the minimum-1 damage floor, which is the same trap
    // the tower's band rules had to be measured out of — see data/towerMutators.
    def: boss.def,
    boss: {
      enrageAfterTurn: boss.boss?.enrageAfterTurn ?? 6,
      enrageAtkPerTurn: boss.boss?.enrageAtkPerTurn ?? 0.15,
      phases: remixPhases(world, boss.trait, tier),
    },
  }
}

export function remixStageId(world: number, tier: RemixTierId): string {
  return `remix-${world}-${tier}`
}

export function isRemixStageId(id: string): boolean {
  return id.startsWith('remix-')
}

/** The world and tier a remix id names, or undefined if it names neither. */
export function parseRemixStageId(id: string): { world: number; tier: RemixTierId } | undefined {
  if (!isRemixStageId(id)) return undefined
  const [, worldRaw, tierRaw] = id.split('-')
  const world = Number.parseInt(worldRaw, 10)
  if (!Number.isFinite(world) || world < 1 || world > WORLDS.length) return undefined
  if (!REMIX_TIER_BY_ID.has(tierRaw as RemixTierId)) return undefined
  return { world, tier: tierRaw as RemixTierId }
}

/**
 * A remix shaped exactly like a campaign stage, so preview, battle, log and
 * result take it for free. The id sits outside the `stage-` namespace, which
 * keeps the validator from ever reading a remix as campaign progress.
 */
export function remixStage(world: number, tierId: RemixTierId): StageConfig {
  const tier = REMIX_TIER_BY_ID.get(tierId)!
  const source = WORLDS[world - 1].boss
  return {
    id: remixStageId(world, tierId),
    name: source.enemy.name,
    order: world,
    enemy: remixEnemy(world, tier),
    rewards: {
      exp: Math.round(source.rewards.exp * tier.reward),
      gold: Math.round(source.rewards.gold * tier.reward),
    },
    bg: backgroundFor(source.visual),
    visual: source.visual,
  }
}
