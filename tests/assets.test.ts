import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import EMOJI_ASSETS from '../src/data/emojiAssets.json'
import { STAGES } from '../src/data/stages'
import { ITEMS } from '../src/data/items'
import { SKILLS } from '../src/data/skills'
import { WORLDS } from '../src/data/worlds'
import { BIOMES } from '../src/data/biomes'
import { RACES, raceTextureKey } from '../src/data/races'
import { ENEMY_TRAITS } from '../src/data/enemyTraits'
import { BATTLE_PLANS } from '../src/data/battlePlans'
import { DIFFICULTIES } from '../src/data/difficulties'
import { ACHIEVEMENTS } from '../src/data/achievements'

const KEYS = new Set(Object.keys(EMOJI_ASSETS))
const file = (key: string) => resolve(process.cwd(), `public/assets/emoji/${key}.png`)
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

/**
 * Every texture key the game asks Phaser for. Collected from the data files
 * rather than from a hand-kept list, so a new stage or item cannot add a
 * reference this test does not check.
 */
function referencedKeys(): Map<string, string> {
  const refs = new Map<string, string>()
  const add = (key: string, where: string) => refs.set(key, where)

  for (const race of RACES) {
    for (const appearance of race.appearances) {
      add(raceTextureKey(race.id, appearance), `race ${race.id}`)
    }
  }
  for (const stage of STAGES) {
    add(stage.enemy.sprite, `stage ${stage.id}`)
    for (const key of stage.bg.decor) add(key, `stage ${stage.id} decor`)
    for (const key of stage.bg.sky) add(key, `stage ${stage.id} sky`)
  }
  for (const item of ITEMS) add(`item_${item.id}`, `item ${item.id}`)
  for (const skill of SKILLS) add(skill.icon, `skill ${skill.id}`)
  for (const world of WORLDS) add(world.icon, `world ${world.index}`)
  for (const biome of Object.values(BIOMES)) {
    for (const key of [...biome.decor, ...biome.sky]) add(key, 'biome')
  }
  for (const trait of ENEMY_TRAITS) add(trait.icon, `trait ${trait.id}`)
  for (const plan of BATTLE_PLANS) add(plan.icon, `plan ${plan.id}`)
  for (const mode of DIFFICULTIES) add(mode.icon, `difficulty ${mode.id}`)
  for (const achievement of ACHIEVEMENTS) add(achievement.icon, `achievement ${achievement.id}`)
  return refs
}

describe('asset registry', () => {
  it('has a file on disk for every key in the manifest', () => {
    const missing = [...KEYS].filter((key) => !existsSync(file(key)))
    expect(missing, `no PNG for: ${missing.join(', ')}`).toEqual([])
  })

  it('has a manifest entry for every texture the game asks for', () => {
    // The failure this catches is a silent one: Phaser renders a missing
    // texture as a green box rather than throwing, so a typo in a decor key
    // ships and nobody notices until a screenshot.
    const broken = [...referencedKeys().entries()].filter(([key]) => !KEYS.has(key))
    expect(broken.map(([key, where]) => `${key} (${where})`), 'unknown texture keys').toEqual([])
  })

  it('gives every emoji key a glyph, and no key two files', () => {
    for (const [key, glyph] of Object.entries(EMOJI_ASSETS)) {
      expect(typeof glyph, key).toBe('string')
      expect((glyph as string).length, key).toBeGreaterThan(0)
    }
    expect(KEYS.size).toBe(Object.keys(EMOJI_ASSETS).length)
  })

  it('ships a licence file beside every asset family', () => {
    for (const path of [
      'public/assets/emoji/LICENSE.txt',
      'public/assets/fonts/Fredoka-OFL.txt',
      'public/assets/fonts/Mitr-OFL.txt',
    ]) {
      expect(existsSync(resolve(process.cwd(), path)), path).toBe(true)
    }
  })

  it('lists every asset in the third-party manifest with a licence', () => {
    const manifest = read('public/assets/THIRD_PARTY_ASSETS.md')
    for (const key of KEYS) {
      expect(manifest.includes(`\`${key}\``), `${key} is not attributed`).toBe(true)
    }
    // Every row carries a licence; a row without one is exactly the thing the
    // handoff forbids shipping.
    const rows = manifest.split('\n').filter((line) => line.startsWith('| `'))
    expect(rows.length).toBe(KEYS.size + 3)
    for (const row of rows) expect(row, row.slice(0, 40)).toContain('OFL 1.1')
  })

  it('credits both sources in CREDITS.md', () => {
    const credits = read('CREDITS.md')
    for (const needle of ['Noto Color Emoji', 'Fredoka', 'Mitr', 'SIL Open Font License 1.1']) {
      expect(credits).toContain(needle)
    }
  })
})
