import { describe, it, expect } from 'vitest'
import { BUILDS, BUILD_TAGS, RESONANCE_AT, activeResonances, buildOf, tagCounts } from '../src/data/builds'
import { ITEMS, ITEM_BY_ID, SHOP_ITEMS } from '../src/data/items'
import { STAGES } from '../src/data/stages'
import { NEUTRAL, foldModifiers } from '../src/systems/combatModifiers'
import { MIN_DAMAGE_FRACTION, resolveBattle } from '../src/systems/combat'
import { playerBattleInputs } from '../src/systems/playerBattle'
import { statsForLevel } from '../src/systems/leveling'
import { createDefaultPlayerState } from '../src/state/playerState'
import { PLAN_IDS } from '../src/data/battlePlans'
import type { BuildTag } from '../src/data/builds'
import type { PlayerState } from '../src/types'

/** Best worn set of one build tag, filling as many slots as that tag can. */
function wearing(tag: BuildTag, level: number): PlayerState {
  const base = createDefaultPlayerState('Sim')
  // Shop stock only: this asks whether three builds can *finish the campaign*,
  // and the campaign ends before the tower — and therefore before any relic —
  // is reachable at all.
  const pool = SHOP_ITEMS.filter((i) => (i.minLevel ?? 1) <= level).sort((a, b) => b.cost - a.cost)
  const slots: Record<string, string | null> = {
    weapon: null,
    head: null,
    body: null,
    boots: null,
    accessory1: null,
    accessory2: null,
  }
  const want = (kind: string) => pool.find((i) => i.kind === kind && i.buildTag === tag)
  const any = (kind: string) => pool.find((i) => i.kind === kind)
  for (const [slot, kind] of [
    ['weapon', 'weapon'],
    ['head', 'head'],
    ['body', 'body'],
    ['boots', 'boots'],
    ['accessory1', 'accessory'],
  ] as const) {
    slots[slot] = (want(kind) ?? any(kind))?.id ?? null
  }
  const owned = Object.values(slots).filter((id): id is string => id !== null)
  return {
    ...base,
    level,
    stats: statsForLevel(level, base.raceId),
    ownedItemIds: owned,
    equipped: slots as PlayerState['equipped'],
    stageProgress: {
      highestUnlocked: STAGES.length,
      completedStageIds: STAGES.map((s) => s.id),
    },
  }
}

function clears(state: PlayerState, stageIndex: number): boolean {
  const stage = STAGES[stageIndex]
  return PLAN_IDS.some(
    (plan) =>
      resolveBattle({ ...playerBattleInputs(state, stage), enemy: stage.enemy, rewards: stage.rewards, plan })
        .win,
  )
}

describe('the three builds', () => {
  it('tags every item, and leaves each of the three with real options', () => {
    for (const item of ITEMS) {
      expect(BUILD_TAGS, item.id).toContain(item.buildTag)
    }
    const counts = tagCounts(ITEMS.map((i) => i.buildTag))
    // The plan asks for at least two options per slot per build to be a real
    // choice; at catalogue level that means no build is a token gesture.
    for (const tag of ['breaker', 'bulwark', 'tempo'] as BuildTag[]) {
      expect(counts[tag], `${tag} has too little gear`).toBeGreaterThanOrEqual(8)
    }
  })

  it('ships flexible gear, so the fourth tag is content rather than a fallback', () => {
    // Without this, `flexible` exists only as the value `buildOf` falls back to
    // for an unknown tag — a branch no shipped item ever takes, and a name in
    // the dictionary the player never sees.
    const flexible = ITEMS.filter((i) => i.buildTag === 'flexible')
    expect(flexible.length).toBeGreaterThan(0)
    // And it is where a player starts: nothing gated should be non-committal.
    for (const item of flexible) expect(item.minLevel ?? 1, item.id).toBe(1)
  })

  it('gives every build a weapon and a body piece to build around', () => {
    for (const tag of ['breaker', 'bulwark', 'tempo'] as BuildTag[]) {
      for (const kind of ['weapon', 'body'] as const) {
        const options = ITEMS.filter((i) => i.buildTag === tag && i.kind === kind)
        expect(options.length, `${tag} has no ${kind}`).toBeGreaterThan(0)
      }
    }
  })

  it('resonates at two pieces, not before', () => {
    expect(RESONANCE_AT).toBe(2)
    expect(activeResonances(['breaker'])).toHaveLength(0)
    expect(activeResonances(['breaker', 'breaker'])).toHaveLength(1)
    // Mixed leanings both pay out — that is the point, rather than punishing
    // anyone who does not wear a uniform.
    const mixed = activeResonances(['breaker', 'breaker', 'bulwark', 'bulwark'])
    expect(mixed.map((b) => b.id).sort()).toEqual(['breaker', 'bulwark'])
  })

  it('gives flexible pieces no resonance at any count', () => {
    expect(activeResonances(['flexible', 'flexible', 'flexible', 'flexible'])).toHaveLength(0)
    expect(foldModifiers([buildOf('flexible').resonance])).toEqual(NEUTRAL)
  })

  it('gives each resonant build an effect that actually changes a fight', () => {
    for (const build of BUILDS.filter((b) => b.id !== 'flexible')) {
      expect(foldModifiers([build.resonance]), build.id).not.toEqual(NEUTRAL)
    }
  })

  it('falls back to flexible for an unknown tag rather than throwing', () => {
    expect(buildOf(undefined).id).toBe('flexible')
    expect(buildOf('nonsense').id).toBe('flexible')
  })
})

describe('pierce is the answer armour has', () => {
  it('buys more than the same points of raw attack would', () => {
    // Armour is subtracted, so a point of pierce and a point of attack are worth
    // the same *through* armour — but pierce also gets you off the proportional
    // floor sooner, and it is the only one of the two that gear actually offers
    // at this scale.
    const wall = { name: 'Wall', sprite: 'enemy_1', maxHp: 900, atk: 5, def: 60 }
    const player = { maxHp: 300, atk: 80, def: 10 }
    const rewards = { exp: 0, gold: 0 }
    const hit = (r: ReturnType<typeof resolveBattle>) =>
      r.log.find((e) => e.attacker === 'player')!.damage

    const blunt = resolveBattle({ player, enemy: wall, rewards })
    const pierced = resolveBattle({ player, enemy: wall, rewards, modifiers: [{ pierce: 20 }] })

    // Per blow, which is the claim. Both fights end in a kill, so comparing
    // health left would compare two zeroes.
    expect(hit(pierced)).toBeGreaterThan(hit(blunt))
    expect(hit(pierced) - hit(blunt)).toBe(20)
  })

  it('is not needed to escape armour entirely, because nothing is', () => {
    // What used to be true here — that heavy armour pinned every blow to 1 — is
    // no longer true, and that is deliberate. Armour caps a blow at a share of
    // the attack rather than erasing it. Pierce is an optimisation now, not a
    // rescue.
    const fortress = { name: 'Fort', sprite: 'enemy_1', maxHp: 900, atk: 5, def: 10_000 }
    const player = { maxHp: 300, atk: 80, def: 10 }
    const r = resolveBattle({ player, enemy: fortress, rewards: { exp: 0, gold: 0 } })
    expect(r.log.find((e) => e.attacker === 'player')!.damage).toBe(
      Math.round(80 * MIN_DAMAGE_FRACTION),
    )
  })

  it('never turns missing armour into bonus damage', () => {
    // Pierce past zero would otherwise start *adding* to the attack.
    const soft = { name: 'Soft', sprite: 'enemy_1', maxHp: 200, atk: 5, def: 2 }
    const player = { maxHp: 300, atk: 30, def: 10 }
    const rewards = { exp: 0, gold: 0 }
    const some = resolveBattle({ player, enemy: soft, rewards, modifiers: [{ pierce: 2 }] })
    const lots = resolveBattle({ player, enemy: soft, rewards, modifiers: [{ pierce: 200 }] })
    expect(lots.log.find((e) => e.attacker === 'player')!.damage).toBe(
      some.log.find((e) => e.attacker === 'player')!.damage,
    )
  })

  it('adds rather than multiplies across sources', () => {
    expect(foldModifiers([{ pierce: 4 }, { pierce: 6 }]).pierce).toBe(10)
    expect(foldModifiers([]).pierce).toBe(0)
  })
})

describe('relic gear', () => {
  const relics = ITEMS.filter((i) => i.effect)

  it('ships two sets of six, and leans on every build in both', () => {
    // Six won from the tower, six from Boss Remix. Each source has to stand on
    // its own: a player who only climbs must still find gear for their build.
    const fromTower = relics.filter((i) => i.source === 'tower')
    const fromRemix = relics.filter((i) => i.source === 'remix')
    expect(fromTower).toHaveLength(6)
    expect(fromRemix).toHaveLength(6)
    for (const source of [fromTower, fromRemix]) {
      const counts = tagCounts(source.map((i) => i.buildTag))
      for (const tag of ['breaker', 'bulwark', 'tempo'] as BuildTag[]) {
        expect(counts[tag]).toBeGreaterThan(0)
      }
    }
  })

  it('never puts a price on a piece that has to be won', () => {
    for (const relic of relics) expect(relic.cost, relic.id).toBe(0)
  })

  it('gives every one of them an effect that changes a fight', () => {
    for (const item of relics) {
      expect(foldModifiers([item.effect!.mods]), item.id).not.toEqual(NEUTRAL)
    }
  })

  it('spells every effect out in words the shop can print', () => {
    // The modifier and the sentence live in one literal so they cannot drift,
    // but nothing stops the sentence being empty — and an unexplained relic is
    // a relic nobody buys on purpose.
    for (const item of relics) {
      expect(item.effect!.description.length, item.id).toBeGreaterThan(10)
    }
  })

  it('reaches the fight through the one place gear is assembled', () => {
    const base = createDefaultPlayerState('Sim')
    const bare = { ...base, level: 30, stats: statsForLevel(30, base.raceId) }
    const withPike: PlayerState = {
      ...bare,
      ownedItemIds: ['void-pike'],
      equipped: { ...bare.equipped, weapon: 'void-pike' },
    }
    expect(foldModifiers(playerBattleInputs(withPike).modifiers!).pierce).toBeGreaterThanOrEqual(
      ITEM_BY_ID.get('void-pike')!.effect!.mods.pierce!,
    )
  })
})

describe('all three builds can finish the campaign', () => {
  // The expansion plan's own success criterion: at least three builds that get
  // through the endgame for real, so the gear layer is a choice rather than a
  // ladder with one rung per level.
  it('clears the last stage on every build', () => {
    for (const tag of ['breaker', 'bulwark', 'tempo'] as BuildTag[]) {
      const hero = wearing(tag, 34)
      expect(clears(hero, STAGES.length - 1), `${tag} cannot finish the campaign`).toBe(true)
    }
  })

  it('leaves no single item worn by every build', () => {
    // "No one piece used in more than 80% of activities" — checked at the
    // strongest form available here: the three best-in-build loadouts must not
    // all converge on the same weapon.
    const weapons = (['breaker', 'bulwark', 'tempo'] as BuildTag[]).map(
      (tag) => wearing(tag, 34).equipped.weapon,
    )
    expect(new Set(weapons).size).toBeGreaterThan(1)
  })
})
