import type { ModifierSource } from '../systems/combatModifiers'
import type { MessageKey } from '../i18n'
import type { RaceId } from './races'

/**
 * A relic earned by mastering a kin.
 *
 * Relics are the only part of mastery the player chooses. Everything else about
 * the track ramps on its own, which keeps mastery from becoming a second skill
 * tree — one budget to spend is a build decision, two is bookkeeping.
 *
 * They are deliberately *not* buyable. Skills cost points and gear costs gold;
 * a relic costs nothing but the miles put in on that kin, which is the only
 * thing on this track that money and levels cannot shortcut.
 */
export interface RelicConfig {
  id: string
  raceId: RaceId
  /** Mastery rank at which this relic becomes equippable. */
  unlockRank: number
  nameKey: MessageKey
  descriptionKey: MessageKey
  /** An already-loaded texture key; relics add no new assets. */
  sprite: string
  mods: ModifierSource
}

/** Ranks that hand out a relic, in order. Pinned by a test against the data. */
export const RELIC_RANKS = [3, 6, 9] as const

/**
 * Three relics per kin, one per relic rank, each pulling in a different
 * direction so the choice is a real one rather than a strictly-better ladder:
 * the rank-3 relic is broad, the rank-6 relic is conditional but larger, and
 * the rank-9 relic is the kin's own passive turned up.
 */
export const RELICS: RelicConfig[] = [
  // Human — the adaptable kin, so its relics are the least conditional.
  {
    id: 'relic-human-1',
    raceId: 'human',
    unlockRank: 3,
    nameKey: 'relic.humanBalance',
    descriptionKey: 'relic.humanBalanceHint',
    sprite: 'decor_scales',
    mods: { outgoing: 1.06, incoming: 0.96 },
  },
  {
    id: 'relic-human-2',
    raceId: 'human',
    unlockRank: 6,
    nameKey: 'relic.humanBand',
    descriptionKey: 'relic.humanBandHint',
    sprite: 'decor_ring',
    mods: { hpScale: 1.08, atkScale: 1.06 },
  },
  {
    id: 'relic-human-3',
    raceId: 'human',
    unlockRank: 9,
    nameKey: 'relic.humanHourglass',
    descriptionKey: 'relic.humanHourglassHint',
    sprite: 'decor_clock',
    mods: { comboEvery: 4, combo: 1.35 },
  },

  // Elf — front-loaded damage, so its relics reward ending fights early.
  {
    id: 'relic-elf-1',
    raceId: 'elf',
    unlockRank: 3,
    nameKey: 'relic.elfQuill',
    descriptionKey: 'relic.elfQuillHint',
    sprite: 'decor_feather',
    mods: { firstStrike: 1.4 },
  },
  {
    id: 'relic-elf-2',
    raceId: 'elf',
    unlockRank: 6,
    nameKey: 'relic.elfLeaf',
    descriptionKey: 'relic.elfLeafHint',
    sprite: 'decor_leaf',
    mods: { execute: 1.5, executeBelow: 0.25 },
  },
  {
    id: 'relic-elf-3',
    raceId: 'elf',
    unlockRank: 9,
    nameKey: 'relic.elfBloom',
    descriptionKey: 'relic.elfBloomHint',
    sprite: 'decor_sakura',
    mods: { outgoing: 1.12, incoming: 1.04 },
  },

  // Dwarf — the wall. Its relics buy survivability that its low attack needs
  // to convert into wins over long fights.
  {
    id: 'relic-dwarf-1',
    raceId: 'dwarf',
    unlockRank: 3,
    nameKey: 'relic.dwarfStone',
    descriptionKey: 'relic.dwarfStoneHint',
    sprite: 'decor_rock',
    mods: { incoming: 0.9 },
  },
  {
    id: 'relic-dwarf-2',
    raceId: 'dwarf',
    unlockRank: 6,
    nameKey: 'relic.dwarfGem',
    descriptionKey: 'relic.dwarfGemHint',
    sprite: 'decor_gem',
    mods: { shield: 0.18, barrier: true },
  },
  {
    id: 'relic-dwarf-3',
    raceId: 'dwarf',
    unlockRank: 9,
    nameKey: 'relic.dwarfAnchor',
    descriptionKey: 'relic.dwarfAnchorHint',
    sprite: 'decor_anchor',
    mods: { atkScale: 1.18, defScale: 1.1 },
  },

  // Orc — dangerous when wounded, so two of three relics only pay off there.
  {
    id: 'relic-orc-1',
    raceId: 'orc',
    unlockRank: 3,
    nameKey: 'relic.orcBone',
    descriptionKey: 'relic.orcBoneHint',
    sprite: 'decor_bone',
    mods: { lowHp: 1.18, lowHpBelow: 0.5 },
  },
  {
    id: 'relic-orc-2',
    raceId: 'orc',
    unlockRank: 6,
    nameKey: 'relic.orcEmber',
    descriptionKey: 'relic.orcEmberHint',
    sprite: 'decor_fire',
    mods: { heal: 0.05, healEvery: 4 },
  },
  {
    id: 'relic-orc-3',
    raceId: 'orc',
    unlockRank: 9,
    nameKey: 'relic.orcCaldera',
    descriptionKey: 'relic.orcCalderaHint',
    sprite: 'decor_volcano',
    mods: { bossDamage: 1.25 },
  },

  // Fae — evasion. Counter turns the dodges it already has into damage.
  {
    id: 'relic-fae-1',
    raceId: 'fae',
    unlockRank: 3,
    nameKey: 'relic.faeSpark',
    descriptionKey: 'relic.faeSparkHint',
    sprite: 'decor_sparkle',
    mods: { dodgeEvery: 5 },
  },
  {
    id: 'relic-fae-2',
    raceId: 'fae',
    unlockRank: 6,
    nameKey: 'relic.faeBubble',
    descriptionKey: 'relic.faeBubbleHint',
    sprite: 'decor_bubble',
    mods: { counter: 0.6 },
  },
  {
    id: 'relic-fae-3',
    raceId: 'fae',
    unlockRank: 9,
    nameKey: 'relic.faeLantern',
    descriptionKey: 'relic.faeLanternHint',
    sprite: 'decor_lantern',
    mods: { outgoing: 1.1, hpScale: 1.12 },
  },

  // Undead — attrition. Its relics all extend how long it can keep standing.
  {
    id: 'relic-undead-1',
    raceId: 'undead',
    unlockRank: 3,
    nameKey: 'relic.undeadSkull',
    descriptionKey: 'relic.undeadSkullHint',
    sprite: 'decor_skull',
    mods: { heal: 0.04, healEvery: 3 },
  },
  {
    id: 'relic-undead-2',
    raceId: 'undead',
    unlockRank: 6,
    nameKey: 'relic.undeadCandle',
    descriptionKey: 'relic.undeadCandleHint',
    sprite: 'decor_candle',
    mods: { barrier: true, hpScale: 1.14 },
  },
  {
    id: 'relic-undead-3',
    raceId: 'undead',
    unlockRank: 9,
    nameKey: 'relic.undeadGrave',
    descriptionKey: 'relic.undeadGraveHint',
    sprite: 'decor_headstone',
    mods: { incoming: 0.88, outgoing: 1.08 },
  },
]

export const RELIC_BY_ID = new Map(RELICS.map((relic) => [relic.id, relic]))

export function relicsForRace(raceId: RaceId | string): RelicConfig[] {
  return RELICS.filter((relic) => relic.raceId === raceId).sort((a, b) => a.unlockRank - b.unlockRank)
}
