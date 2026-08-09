import { RACE_IDS } from './races'
import type { RaceId } from './races'
import type { ModifierSource } from '../systems/combatModifiers'

/**
 * Twelve skills per race: three branches of four, each tier gated behind the
 * one before it.
 *
 * Names and descriptions are English in both locales, matching how stage,
 * enemy and item names are already handled — they are content rather than
 * interface text, and 144 more translated strings would be a lot of surface
 * for text the player reads once per skill.
 *
 * Every effect is a `ModifierSource`, which means every skill composes with
 * plans, race passives and gear by the rules in systems/combatModifiers rather
 * than by a special case in the turn loop. It also means every skill is
 * deterministic by construction: there is nowhere in that shape to put a
 * random number, so the stage preview stays an exact simulation.
 *
 * Branches are built around a mechanic rather than a stat, because a tree of
 * percentages is a tree with one right answer. Each race gets one branch that
 * leans on raw output, one on a timing mechanic (combo, dodge, counter,
 * execute) and one on staying alive (heal, shield, barrier).
 */
export interface SkillConfig {
  id: string
  raceId: RaceId
  branch: string
  /** 1-4. A skill needs the previous tier in its own branch first. */
  tier: number
  name: string
  description: string
  icon: string
  mods: ModifierSource
}

/** Points get steeper up a branch, so the last node is a real commitment. */
export const TIER_COST = [1, 2, 3, 5] as const

export function skillCost(tier: number): number {
  return TIER_COST[Math.min(Math.max(tier, 1), TIER_COST.length) - 1]
}

/** Cost of a whole branch, and of a whole race tree. */
export const BRANCH_COST = TIER_COST.reduce((a, b) => a + b, 0)

type Row = [name: string, description: string, icon: string, mods: ModifierSource]

/** Branch definitions, four rows each, ordered tier 1 → 4. */
const TREES: Record<RaceId, [string, Row[]][]> = {
  human: [
    [
      'Commander',
      [
        ['Rally', 'Every blow you land hits 6% harder', 'icon_atk', { outgoing: 1.06 }],
        ['Standard Bearer', 'Attack and defence both grow by 5%', 'icon_def', { atkScale: 1.05, defScale: 1.05 }],
        ['Press the Line', 'Every 4th attack lands at 150%', 'icon_bolt', { comboEvery: 4, combo: 1.5 }],
        ['Final Order', 'Below 20% health, the enemy takes 60% more', 'icon_hit', { execute: 1.6, executeBelow: 0.2 }],
      ],
    ],
    [
      'Adventurer',
      [
        ['Trail Rations', 'Mend 4% of health every 4th attack', 'icon_hp', { heal: 0.04, healEvery: 4 }],
        ['Second Wind', 'Start each fight behind a 12% shield', 'icon_def', { shield: 0.12 }],
        ['Pathfinder', 'Slip past every 7th blow aimed at you', 'decor_leaf', { dodgeEvery: 7 }],
        ["Veteran's Kit", 'Healing past full becomes shield instead', 'icon_star', { barrier: true, heal: 0.03, healEvery: 4 }],
      ],
    ],
    [
      'Tactician',
      [
        ['Read the Room', 'Take 5% less from every hit', 'icon_def', { incoming: 0.95 }],
        ['Feint', 'Slip past every 6th blow aimed at you', 'decor_fog', { dodgeEvery: 6 }],
        ['Riposte', 'A dodge answers back for 60% of a hit', 'icon_clash', { counter: 0.6 }],
        ['Opening Gambit', 'The first blow that lands hits 35% harder', 'icon_star', { firstStrike: 1.35 }],
      ],
    ],
  ],
  elf: [
    [
      'Archer',
      [
        ['Steady Aim', 'Every blow you land hits 7% harder', 'icon_atk', { outgoing: 1.07 }],
        ['Piercing Shot', 'Bosses take 12% more from you', 'decor_skull', { bossDamage: 1.12 }],
        ['Volley', 'Every 3rd attack lands at 140%', 'icon_bolt', { comboEvery: 3, combo: 1.4 }],
        ['Killing Shot', 'Below 15% health, the enemy takes 80% more', 'icon_hit', { execute: 1.8, executeBelow: 0.15 }],
      ],
    ],
    [
      'Spellblade',
      [
        ['Runeblade', 'Your attack stat grows by 8%', 'icon_atk', { atkScale: 1.08 }],
        ['Arcane Ward', 'Start each fight behind a 15% shield', 'decor_orb', { shield: 0.15 }],
        ['Blink Step', 'Slip past every 5th blow aimed at you', 'decor_sparkle', { dodgeEvery: 5 }],
        ['Mirror Edge', 'A dodge answers back for 75% of a hit', 'icon_clash', { counter: 0.75 }],
      ],
    ],
    [
      'Nature Mage',
      [
        ['Verdant Touch', 'Mend 5% of health every 4th attack', 'icon_hp', { heal: 0.05, healEvery: 4 }],
        ['Thornskin', 'Take 6% less from every hit', 'decor_herb', { incoming: 0.94 }],
        ['Bloom', 'Mend 4% every 3rd attack; overflow becomes shield', 'decor_flower', { barrier: true, heal: 0.04, healEvery: 3 }],
        ['Wildheart', 'Your health pool grows by 12%', 'icon_hp', { hpScale: 1.12 }],
      ],
    ],
  ],
  dwarf: [
    [
      'Guardian',
      [
        ['Shield Wall', 'Take 7% less from every hit', 'icon_def', { incoming: 0.93 }],
        ['Bulwark', 'Your defence stat grows by 15%', 'icon_def', { defScale: 1.15 }],
        ['Bastion', 'Start each fight behind a 20% shield', 'decor_castle', { shield: 0.2 }],
        ['Unbreakable', 'Mend 5% every 4th attack; overflow becomes shield', 'icon_star', { barrier: true, heal: 0.05, healEvery: 4 }],
      ],
    ],
    [
      'Berserker',
      [
        ['Fury', 'Every blow you land hits 8% harder', 'icon_atk', { outgoing: 1.08 }],
        ['Reckless Swing', 'Every 4th attack lands at 155%, but you take 5% more', 'icon_bolt', { comboEvery: 4, combo: 1.55, incoming: 1.05 }],
        ['Blood in the Beard', 'Below half health, deal 20% more', 'decor_fire', { lowHp: 1.2, lowHpBelow: 0.5 }],
        ['Last Stand', 'Below 20% enemy health, deal 70% more', 'icon_hit', { execute: 1.7, executeBelow: 0.2 }],
      ],
    ],
    [
      'Engineer',
      [
        ['Reinforced Plate', 'Your health pool grows by 10%', 'icon_hp', { hpScale: 1.1 }],
        ['Clockwork Aim', 'The first blow that lands hits 40% harder', 'decor_gear', { firstStrike: 1.4 }],
        ['Spring Trap', 'A dodge answers back for 80% of a hit', 'icon_clash', { counter: 0.8 }],
        ['Siege Engine', 'Bosses take 20% more from you', 'decor_skull', { bossDamage: 1.2 }],
      ],
    ],
  ],
  orc: [
    [
      'Warlord',
      [
        ['War Cry', 'Every blow you land hits 8% harder', 'icon_atk', { outgoing: 1.08 }],
        ['Cleave', 'Every 3rd attack lands at 145%', 'icon_bolt', { comboEvery: 3, combo: 1.45 }],
        ["Warlord's Might", 'Your attack stat grows by 10%', 'icon_atk', { atkScale: 1.1 }],
        ['Skullcrusher', 'Below 18% health, the enemy takes 90% more', 'decor_skull', { execute: 1.9, executeBelow: 0.18 }],
      ],
    ],
    [
      'Blood Knight',
      [
        ['Blood Price', 'Deal 12% more, take 6% more', 'decor_fire', { outgoing: 1.12, incoming: 1.06 }],
        ['Crimson Feast', 'Mend 5% of health every 3rd attack', 'icon_hp', { heal: 0.05, healEvery: 3 }],
        ['Wounded Beast', 'Below 55% health, deal 25% more', 'icon_hit', { lowHp: 1.25, lowHpBelow: 0.55 }],
        ['Undying Rage', 'Mend 4% every 3rd attack; overflow becomes shield', 'icon_star', { barrier: true, heal: 0.04, healEvery: 3 }],
      ],
    ],
    [
      'Shaman',
      [
        ['Spirit Ward', 'Take 6% less from every hit', 'decor_lantern', { incoming: 0.94 }],
        ['Totem', 'Start each fight behind a 16% shield', 'decor_orb', { shield: 0.16 }],
        ['Ancestral Guard', 'Your health pool grows by 12%', 'icon_hp', { hpScale: 1.12 }],
        ['Storm Totem', 'Dodge every 6th blow, answering for 70%', 'decor_bolt', { counter: 0.7, dodgeEvery: 6 }],
      ],
    ],
  ],
  fae: [
    [
      'Hunter',
      [
        ['Keen Eye', 'Every blow you land hits 6% harder', 'icon_atk', { outgoing: 1.06 }],
        ['Snare', 'Slip past every 5th blow aimed at you', 'decor_herb', { dodgeEvery: 5 }],
        ["Hunter's Mark", 'Bosses take 15% more from you', 'decor_skull', { bossDamage: 1.15 }],
        ['Ambush', 'The first blow that lands hits 50% harder', 'icon_star', { firstStrike: 1.5 }],
      ],
    ],
    [
      'Assassin',
      [
        ['Quick Blades', 'Every 3rd attack lands at 140%', 'icon_bolt', { comboEvery: 3, combo: 1.4 }],
        ['Shadowstep', 'Slip past every 4th blow aimed at you', 'decor_fog', { dodgeEvery: 4 }],
        ['Backstab', 'A dodge answers back for 90% of a hit', 'icon_clash', { counter: 0.9 }],
        ['Death Mark', 'Below 15% health, the enemy takes double', 'icon_hit', { execute: 2, executeBelow: 0.15 }],
      ],
    ],
    [
      'Spirit Walker',
      [
        ['Fae Dust', 'Mend 4% of health every 4th attack', 'decor_sparkle', { heal: 0.04, healEvery: 4 }],
        ['Gossamer', 'Start each fight behind a 14% shield', 'decor_feather', { shield: 0.14 }],
        ['Wisp Shield', 'Mend 3% every 3rd attack; overflow becomes shield', 'decor_orb', { barrier: true, heal: 0.03, healEvery: 3 }],
        ['Ethereal', 'Take 10% less from every hit', 'decor_fog', { incoming: 0.9 }],
      ],
    ],
  ],
  undead: [
    [
      'Death Knight',
      [
        ['Grave Strength', 'Your attack stat grows by 8%', 'icon_atk', { atkScale: 1.08 }],
        ['Bone Armor', 'Your defence stat grows by 15%', 'icon_def', { defScale: 1.15 }],
        ['Deathly Vigor', 'Your health pool grows by 14%', 'icon_hp', { hpScale: 1.14 }],
        ['Doom Blade', 'Below 20% health, the enemy takes 75% more', 'icon_hit', { execute: 1.75, executeBelow: 0.2 }],
      ],
    ],
    [
      'Necromancer',
      [
        ['Leech', 'Mend 4% of health every 3rd attack', 'icon_hp', { heal: 0.04, healEvery: 3 }],
        ['Bone Shield', 'Start each fight behind an 18% shield', 'decor_headstone', { shield: 0.18 }],
        ['Soul Harvest', 'Mend 5% every 3rd attack; overflow becomes shield', 'decor_candle', { barrier: true, heal: 0.05, healEvery: 3 }],
        ['Endless Dead', 'Mend 5% of health every other attack', 'icon_star', { heal: 0.05, healEvery: 2 }],
      ],
    ],
    [
      'Soul Reaper',
      [
        ['Reaping', 'Every blow you land hits 7% harder', 'icon_atk', { outgoing: 1.07 }],
        ['Scythe Sweep', 'Every 4th attack lands at 150%', 'icon_bolt', { comboEvery: 4, combo: 1.5 }],
        ['Soul Chain', 'A dodge answers back for 70% of a hit', 'icon_clash', { counter: 0.7 }],
        ['Harvest of Souls', 'Below 20% enemy health, deal 85% more', 'decor_skull', { execute: 1.85, executeBelow: 0.2 }],
      ],
    ],
  ],
}

function buildSkills(): SkillConfig[] {
  const skills: SkillConfig[] = []
  for (const raceId of RACE_IDS) {
    TREES[raceId].forEach(([branch, rows], branchIndex) => {
      rows.forEach(([name, description, icon, mods], i) => {
        skills.push({
          // Positional, so a renamed skill keeps its place in existing saves.
          id: `${raceId}-${branchIndex + 1}-${i + 1}`,
          raceId,
          branch,
          tier: i + 1,
          name,
          description,
          icon,
          mods,
        })
      })
    })
  }
  return skills
}

export const SKILLS: SkillConfig[] = buildSkills()

export const SKILL_BY_ID = new Map(SKILLS.map((skill) => [skill.id, skill]))

export const SKILLS_BY_RACE: Record<RaceId, SkillConfig[]> = Object.fromEntries(
  RACE_IDS.map((raceId) => [raceId, SKILLS.filter((s) => s.raceId === raceId)]),
) as Record<RaceId, SkillConfig[]>

export interface SkillBranch {
  raceId: RaceId
  name: string
  skills: SkillConfig[]
}

export function branchesFor(raceId: RaceId): SkillBranch[] {
  return TREES[raceId].map(([name], branchIndex) => ({
    raceId,
    name,
    skills: SKILLS.filter((s) => s.raceId === raceId && s.id.startsWith(`${raceId}-${branchIndex + 1}-`)),
  }))
}

/** The skill one tier below this one in the same branch, or null at tier 1. */
export function prerequisiteOf(skill: SkillConfig): SkillConfig | null {
  if (skill.tier === 1) return null
  const [raceId, branch] = skill.id.split('-')
  return SKILL_BY_ID.get(`${raceId}-${branch}-${skill.tier - 1}`) ?? null
}
