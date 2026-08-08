#!/usr/bin/env node
// Downloads the game's third-party art into public/assets/.
// Everything fetched here is SIL Open Font License 1.1 — see CREDITS.md.
//
// Run with: npm run assets
//
// src/data/emojiAssets.json is the single source of truth: the same manifest
// drives these downloads and the runtime preload in PreloadScene.

import { execFile } from 'node:child_process'
import { mkdir, writeFile, readFile, copyFile, access } from 'node:fs/promises'
import { promisify } from 'node:util'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const run = promisify(execFile)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const EMOJI_BASE = 'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/128'
const FONT_URL =
  'https://raw.githubusercontent.com/google/fonts/main/ofl/fredoka/Fredoka%5Bwdth,wght%5D.ttf'
const FONT_LICENSE_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/fredoka/OFL.txt'
// Fredoka is Latin-only, so Thai needs its own face. Mitr is rounded enough to
// sit beside it without the UI looking like two different games.
const THAI_FONTS = [
  ['Mitr-Regular.ttf', 'https://raw.githubusercontent.com/google/fonts/main/ofl/mitr/Mitr-Regular.ttf'],
  ['Mitr-SemiBold.ttf', 'https://raw.githubusercontent.com/google/fonts/main/ofl/mitr/Mitr-SemiBold.ttf'],
]
const THAI_FONT_LICENSE_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/mitr/OFL.txt'
const EMOJI_LICENSE_URL = 'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/LICENSE'

/** Noto's filenames omit the FE0F variation selector and lowercase every codepoint. */
function notoFileName(emoji) {
  const cps = [...emoji]
    .map((ch) => ch.codePointAt(0))
    .filter((cp) => cp !== 0xfe0f)
    .map((cp) => cp.toString(16))
  return `emoji_u${cps.join('_')}.png`
}

async function download(url, dest) {
  await run('curl', ['-sSLg', '--fail', '--max-time', '60', '-o', dest, url])
}

async function exists(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function main() {
  const emojiDir = path.join(root, 'public/assets/emoji')
  const fontDir = path.join(root, 'public/assets/fonts')
  await mkdir(emojiDir, { recursive: true })
  await mkdir(fontDir, { recursive: true })

  const manifest = JSON.parse(await readFile(path.join(root, 'src/data/emojiAssets.json'), 'utf8'))

  // Several keys intentionally share an emoji (e.g. two sword items), so fetch
  // each distinct glyph once and copy it out to every key that wants it.
  const byFile = new Map()
  for (const [key, emoji] of Object.entries(manifest)) {
    const file = notoFileName(emoji)
    if (!byFile.has(file)) byFile.set(file, [])
    byFile.get(file).push(key)
  }

  console.log(`Fetching ${byFile.size} emoji glyphs for ${Object.keys(manifest).length} asset keys…`)
  const cacheDir = path.join(root, 'node_modules/.cache/noto-emoji')
  await mkdir(cacheDir, { recursive: true })

  let failed = 0
  for (const [file, keys] of byFile) {
    const cached = path.join(cacheDir, file)
    if (!(await exists(cached))) {
      try {
        await download(`${EMOJI_BASE}/${file}`, cached)
      } catch {
        console.error(`  ✗ ${file} (${keys.join(', ')})`)
        failed++
        continue
      }
    }
    for (const key of keys) await copyFile(cached, path.join(emojiDir, `${key}.png`))
  }

  console.log('Fetching fonts…')
  await download(FONT_URL, path.join(fontDir, 'Fredoka.ttf'))
  await download(FONT_LICENSE_URL, path.join(fontDir, 'Fredoka-OFL.txt'))
  for (const [name, url] of THAI_FONTS) await download(url, path.join(fontDir, name))
  await download(THAI_FONT_LICENSE_URL, path.join(fontDir, 'Mitr-OFL.txt'))
  await download(EMOJI_LICENSE_URL, path.join(emojiDir, 'LICENSE.txt'))

  await writeFile(
    path.join(root, 'public/assets/README.txt'),
    [
      'Third-party assets, downloaded by `npm run assets` (scripts/fetch-assets.mjs).',
      '',
      'fonts/Fredoka.ttf   - Fredoka, (c) The Fredoka Project Authors.',
      '                      SIL Open Font License 1.1 (fonts/Fredoka-OFL.txt).',
      'fonts/Mitr-*.ttf    - Mitr, (c) Cadson Demak. Thai script support.',
      '                      SIL Open Font License 1.1 (fonts/Mitr-OFL.txt).',
      'emoji/*.png         - Noto Color Emoji, (c) Google LLC.',
      '                      SIL Open Font License 1.1 (emoji/LICENSE.txt).',
      '',
      'See CREDITS.md in the repository root.',
      '',
    ].join('\n'),
  )

  await writeThirdPartyManifest(manifest)

  if (failed) {
    console.error(`\nDone with ${failed} failed glyph(s).`)
    process.exit(1)
  }
  console.log('\nAssets ready in public/assets/.')
}

/**
 * Writes the per-asset licence table the handoff asks for.
 *
 * Generated rather than hand-maintained: the manifest is already the single
 * source of truth for which assets exist, so deriving the table from it means
 * adding a sprite cannot leave the attribution behind.
 */
async function writeThirdPartyManifest(manifest) {
  const rows = Object.entries(manifest).map(
    ([key, glyph]) =>
      `| \`${key}\` | \`assets/emoji/${key}.png\` | Noto Color Emoji ${glyph} | Google LLC | ${EMOJI_BASE}/ | OFL 1.1 | Rendered to 128px PNG upstream; used as-is | "Noto Color Emoji" by Google LLC, OFL 1.1 |`,
  )

  const fonts = [
    `| \`font-fredoka\` | \`assets/fonts/Fredoka.ttf\` | Fredoka | The Fredoka Project Authors | ${FONT_URL} | OFL 1.1 | No | "Fredoka", OFL 1.1 |`,
    ...THAI_FONTS.map(
      ([name, url]) =>
        `| \`font-${name.replace(/\.ttf$/, '').toLowerCase()}\` | \`assets/fonts/${name}\` | Mitr | Cadson Demak | ${url} | OFL 1.1 | No | "Mitr" by Cadson Demak, OFL 1.1 |`,
    ),
  ]

  await writeFile(
    path.join(root, 'public/assets/THIRD_PARTY_ASSETS.md'),
    [
      '# Third-party assets',
      '',
      'Generated by `npm run assets` from `src/data/emojiAssets.json` — do not edit by hand.',
      '',
      'Every asset in this repository comes from one of two sources, both under the',
      'SIL Open Font License 1.1. Nothing is hotlinked: every file listed here is',
      'committed under `public/assets/`, so a build needs no network access.',
      '',
      'Licence texts ship alongside the assets: `assets/emoji/LICENSE.txt`,',
      '`assets/fonts/Fredoka-OFL.txt`, `assets/fonts/Mitr-OFL.txt`.',
      '',
      '| Asset ID | File | Title | Creator | Source URL | License | Modified | Attribution |',
      '| --- | --- | --- | --- | --- | --- | --- | --- |',
      ...fonts,
      ...rows,
      '',
    ].join('\n'),
  )
}

await main()
