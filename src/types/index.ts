import type { TraitId } from '../data/enemyTraits'
import type { StatusApplication } from '../systems/status'
import type { PlanId } from '../data/battlePlans'
import type { RaceId } from '../data/races'
import type { StageVisual } from '../data/biomes'
import type { DifficultyId } from '../data/difficulties'
import type { Rarity } from '../data/affixes'
import type { BuildTag } from '../data/builds'
import type { ModifierSource } from '../systems/combatModifiers'

export interface PlayerStats {
  maxHp: number
  atk: number
  def: number
}

export interface StageProgress {
  highestUnlocked: number
  completedStageIds: string[]
}

export type UpgradeType = 'hp' | 'atk' | 'def'

export type UpgradeCounts = Record<UpgradeType, number>

export interface StatBonus {
  hp?: number
  atk?: number
  def?: number
}

/**
 * Six worn slots. Two accessory slots rather than one because a set needs four
 * pieces to be assemblable at all, and three armour slots plus one trinket left
 * no room for a second half of any set.
 */
export type EquipSlot = 'weapon' | 'head' | 'body' | 'boots' | 'accessory1' | 'accessory2'

/**
 * What an item *is*, as opposed to where it goes. One accessory kind fits
 * either accessory slot, so a player can wear two charms without the catalogue
 * having to duplicate every trinket.
 */
export type ItemKind = 'weapon' | 'head' | 'body' | 'boots' | 'accessory'

/** One item may be equipped per slot; the rest stay in the bag. */
export type Equipment = Record<EquipSlot, string | null>

export interface ShopItem {
  id: string
  kind: ItemKind
  name: string
  emoji: string
  bonus: StatBonus
  cost: number
  minLevel?: number
  /** Which of the three answers this piece leans towards; see data/builds. */
  buildTag: BuildTag
  /**
   * A named effect the piece carries, on top of its derived affixes.
   *
   * Relic-tier gear has one; ordinary gear does not. The distinction matters:
   * affixes are rolled from the item's id and are the same kind of small
   * numeric nudge on every piece, while this is the *reason* a piece exists —
   * the thing a player picks it up for and builds around.
   *
   * Shaped like a set bonus, and for the same reason: the sentence the player
   * reads and the modifier the fight runs under sit in one literal, so an
   * effect cannot be retuned without its description moving with it.
   */
  effect?: { description: string; mods: ModifierSource }
  /** Drives affix count and how the card reads; see data/affixes. */
  rarity: Rarity
  /** Members of the same set count towards its 2- and 4-piece bonuses. */
  setId?: string
}

export const SAVE_SCHEMA_VERSION = 18

export type BattleSpeed = 1 | 2 | 4

export interface GameSettings {
  /** Playback multiplier for battle animation; combat maths are unaffected. */
  battleSpeed: BattleSpeed
  /** Jump straight to the result once a stage has been cleared before. */
  skipCleared: boolean
  /** Keep fighting the current stage automatically after a win. */
  autoRepeat: boolean
  /** When auto-repeating, move on to the next stage once this one is cleared. */
  autoAdvance: boolean
  /**
   * Suppresses decorative motion. Defaults from the OS `prefers-reduced-motion`
   * setting on a new save, and can then be overridden in Settings.
   */
  reducedMotion: boolean
  /** UI language; defaults from the browser on a new save. */
  locale: 'en' | 'th'
  /**
   * The plan committed to most recently. This is what offline farming fights
   * under and what the stage cards forecast, so it has to be the player's own
   * last choice rather than whichever plan happens to be best.
   */
  battlePlan: PlanId
  /**
   * Campaign difficulty. Lives in settings rather than on the stage so a mode
   * change re-rates every stage at once, including the previews and the
   * offline payout, instead of only the fight about to be fought.
   */
  difficulty: DifficultyId
  /**
   * Opt-in gameplay analytics. Always starts false, including on upgraded
   * saves — consent cannot be inherited from a version that never asked.
   */
  analytics: boolean
}

export interface TowerProgress {
  /** Deepest floor beaten; 0 before the first climb. */
  bestFloor: number
}

export interface RiftProgress {
  /** Week index of the last rift beaten; -1 before the first one. */
  clearedWeek: number
}

export interface AscensionProgress {
  /** Completed campaigns given back for permanent power; 0 before the first. */
  count: number
}

/** Running totals that cannot be derived from the current state alone. */
export interface LifetimeStats {
  battlesWon: number
  goldEarned: number
}

export interface IdleState {
  /** Stage id the hero keeps farming while away; null disables offline gains. */
  farmingStageId: string | null
  /** Epoch ms of the last time offline rewards were settled. */
  lastSeenAt: number
}

export interface PlayerState {
  /** Bump SAVE_SCHEMA_VERSION and add a migration step when this shape changes. */
  schemaVersion: number
  /** Monotonic save counter, bumped on every persist. */
  revision: number
  /**
   * The revision at which this copy last matched the cloud. A counter alone
   * cannot tell "the cloud is behind" from "both copies moved independently";
   * comparing each side against this shared ancestor can. See detectConflict.
   */
  syncedRevision: number
  /** ISO timestamp of the last persist, informational only. */
  updatedAt: string
  name: string
  /**
   * The animal buddy picked before races existed. Kept so nobody's original
   * choice is thrown away, but the hero itself renders from `raceId`.
   */
  avatar: string
  /** Decides base stats, per-level growth and the passive. */
  raceId: RaceId
  /** Which of the race's looks; always one the race actually offers. */
  appearanceId: string
  level: number
  exp: number
  gold: number
  stats: PlayerStats
  upgrades: UpgradeCounts
  ownedItemIds: string[]
  equipped: Equipment
  /**
   * Skills bought from the tree. The *points* that paid for them are derived
   * from level and bosses cleared rather than stored, so an edited save can
   * claim any list it likes and still only keep what the budget covers — see
   * systems/skills.
   */
  unlockedSkillIds: string[]
  /** Up to LOADOUT_SIZE unlocked skills, the ones a fight actually runs under. */
  loadout: string[]
  /**
   * The one relic carried into fights, or null. Mastery rank itself is derived
   * from progress rather than stored; this is the only part of the track the
   * player chooses, so it is the only part written down — see systems/mastery.
   */
  equippedRelicId: string | null
  /**
   * Endless Tower record. Stored rather than derived, because there is no list
   * of cleared floors to count and keeping one would grow the save without
   * bound — see systems/tower for the bounds that stand in for derivation.
   */
  tower: TowerProgress
  /**
   * Which week's Realm Rift has been beaten. Stored for the same reason the
   * tower record is — there is nothing in the save to derive it from — and
   * deliberately worth only gold and EXP, because the week comes from the
   * device clock. See data/rifts.
   */
  rift: RiftProgress
  /**
   * Wins earned by each owned piece while it was worn, keyed by item id.
   *
   * The fourth and last stored-not-derived exception in this save: nothing
   * records which pieces were worn for a fight already fought, so there is
   * nothing to derive it from — see systems/equipmentMastery for the bounds
   * that stand in for derivation.
   */
  equipmentMastery: Record<string, number>
  /**
   * How many finished campaigns have been given back. A reset campaign is
   * indistinguishable from one never played, so this counter is the only
   * evidence an ascension happened — see systems/ascension.
   */
  ascension: AscensionProgress
  stageProgress: StageProgress
  settings: GameSettings
  idle: IdleState
  /** How far through the 3-step intro the player is; TUTORIAL_DONE when finished. */
  tutorialStep: number
  lifetime: LifetimeStats
  /** Achievements whose reward has already been taken. */
  claimedAchievementIds: string[]
}

export const TUTORIAL_DONE = 3

/**
 * Extra rules a boss fights under, layered on the normal turn loop. Kept
 * deterministic so the stage preview stays an exact simulation rather than an
 * estimate — see systems/difficulty.
 */
export interface BossConfig {
  /** Turns of grace before the boss starts hitting harder every turn. */
  enrageAfterTurn: number
  /** Fraction of base ATK the boss gains per enraged turn. */
  enrageAtkPerTurn: number
  /**
   * Ordered by threshold, highest first. A phase is entered the moment the
   * boss's health crosses `atHpBelow`, and entering is one-way — a boss healed
   * back above the line does not un-transform, because a fight that could
   * re-trigger a phase could re-trigger it forever.
   */
  phases?: BossPhase[]
}

export interface BossPhase {
  /** Fraction of Max HP at or below which this phase begins. */
  atHpBelow: number
  /** Message key naming what changes, for the pre-fight intel panel. */
  labelKey: string
  /** Multipliers applied to the boss from this phase onward. */
  atkScale?: number
  defScale?: number
  /** Shield granted on entering, as a fraction of the boss's Max HP. */
  shield?: number
  /** Clears every harmful status the boss is carrying. */
  cleanse?: true
  /** Replaces the boss's trait from this phase onward. */
  trait?: TraitId
  /** A status the boss puts on the player on entering. */
  inflict?: StatusApplication
}

export interface EnemyConfig {
  name: string
  /** Preloaded emoji texture key for this enemy's sprite. */
  sprite: string
  maxHp: number
  atk: number
  def: number
  /** Present only on chapter bosses. */
  boss?: BossConfig
  /**
   * Absent means 'straightforward'. Lives here rather than on StageConfig so
   * the difficulty preview and offline farming pick it up for free, the same
   * way `boss` already does.
   */
  trait?: TraitId
}

export interface StageRewards {
  exp: number
  gold: number
}

export interface StageBackground {
  skyTop: number
  skyBottom: number
  hillFar: number
  hillNear: number
  ground: number
  /** Emoji texture keys scattered across the ground band. */
  decor: string[]
  /** Emoji texture keys floating in the sky band. */
  sky: string[]
}

export interface StageConfig {
  id: string
  name: string
  order: number
  enemy: EnemyConfig
  rewards: StageRewards
  /** Flattened for the scenery painter; composed from `visual`. */
  bg: StageBackground
  /** The composition it was built from, so tests can assert all 60 differ. */
  visual: StageVisual
}

/**
 * Effects worth interrupting the battle log for. Each announces at most once
 * per fight — recurring things like dodges and heals get sprite-level feedback
 * instead, or the log would be unreadable.
 */
export type AnnounceKind =
  | 'enraged'
  | 'fierce'
  | 'bloodrage'
  | 'precision'
  | 'attrition'
  | 'execute'
  | 'phase'

export interface TurnEvent {
  turn: number
  attacker: 'player' | 'enemy'
  /** 0 when dodged; otherwise at least 1. */
  damage: number
  /** HP of the side that was struck, after the blow. */
  targetHpAfter: number

  /** The blow missed entirely — the only way to take 0 damage. */
  dodged?: true
  /** Went through a combo or first-strike multiplier; drives a bigger hit flash. */
  crit?: true
  /** How much the attacker restored to itself. Omitted when nothing was healed. */
  healed?: number
  /** Healing past Max HP banked as shield instead of being discarded. */
  barriered?: number
  /** The attacker's own HP after healing or barriering. */
  selfHpAfter?: number
  /** Part of this blow that shield ate rather than health. */
  absorbed?: number
  /** Damage the player dealt back on a dodge, on the enemy's own event. */
  counter?: number
  /** Enemy HP after the counter landed. Present exactly when `counter` is. */
  counterHpAfter?: number

  /** Statuses this blow put on the side that was struck. */
  applied?: string[]
  /** Damage the struck side took from statuses at the start of its turn. */
  statusDamage?: number
  /** The struck side could not act at all this turn. */
  frozen?: true

  /** Latched: the one blow where this effect announces itself. */
  announce?: AnnounceKind
}

export type BattleOutcome = 'win' | 'loss' | 'timeout'

export interface BattleResult {
  outcome: BattleOutcome
  /** Always `outcome === 'win'`; kept so reward and result code needs no change. */
  win: boolean
  log: TurnEvent[]
  /**
   * Final HP, returned rather than re-derived from the log. Once healing can
   * change a side's HP on its *own* attack event, walking the log for the last
   * blow against that side silently reads a stale value.
   */
  playerHpLeft: number
  /**
   * The Max HP the fight was actually resolved with. Skills and gear can scale
   * the player's health pool, so dividing `playerHpLeft` by the *unscaled*
   * stat block reports more than 100% left — which is what the stage preview
   * did until this was returned alongside it.
   */
  playerMaxHp: number
  enemyHpLeft: number
  /** Shield still standing at the end; 0 unless a shield effect was running. */
  shieldLeft: number
  /** How many boss phases the fight actually reached. */
  phasesEntered: number
  rewards: StageRewards
}
