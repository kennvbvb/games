# Credits

The game's own source code is MIT licensed (see [LICENSE](./LICENSE)). That is
separate from the third-party art below, which keeps its own terms.

The game's art and typography come from open-licensed projects. Everything here
is redistributable, including in a commercial or hosted build, provided the
notices below travel with it — which they do: the full license texts ship inside
`public/assets/` and are served with the game.

Assets are fetched by `npm run assets` (see `scripts/fetch-assets.mjs`) and are
committed to the repository so builds and deploys need no network access.

## Fredoka (UI typeface)

- Copyright © The Fredoka Project Authors
- Source: https://github.com/google/fonts/tree/main/ofl/fredoka
- License: SIL Open Font License 1.1
- Shipped license text: `public/assets/fonts/Fredoka-OFL.txt`

Used for all in-game text, loaded via `@font-face` in `index.html`.

## Mitr (Thai typeface)

- Copyright © Cadson Demak
- Source: https://github.com/google/fonts/tree/main/ofl/mitr
- License: SIL Open Font License 1.1
- Shipped license text: `public/assets/fonts/Mitr-OFL.txt`

Fredoka covers no Thai glyphs, so Mitr carries the Thai script. Both are listed
in the font stack and the browser resolves each character from whichever face
has it.

## Noto Color Emoji (character, enemy, item and scenery art)

- Copyright © Google LLC
- Source: https://github.com/googlefonts/noto-emoji
- License: SIL Open Font License 1.1
- Shipped license text: `public/assets/emoji/LICENSE.txt`

The 128px PNG emoji are used as sprites for hero avatars, enemies, shop items,
UI icons, and stage scenery. `src/data/emojiAssets.json` maps each texture key
to the emoji it was rendered from.

The six playable kin are Noto's *people* emoji rather than its animal ones —
elf, zombie, vampire, troll, fairy and so on — so the hero reads as humanoid
while every sprite still comes from one source with one art style. Noto's
framing is not uniform across them: some glyphs are head-and-shoulders and
others full-body, and Orc's second look is a mask rather than a figure. That is
the cost of holding to a single licensed source instead of mixing packs.

Per-asset attribution — every texture key, its file, source URL and licence —
is generated into [`public/assets/THIRD_PARTY_ASSETS.md`](./public/assets/THIRD_PARTY_ASSETS.md)
by `npm run assets`, so adding a sprite cannot leave its attribution behind. A
test walks every texture the data files reference and checks it against both
that manifest and the files on disk.

The home-screen icons in `public/assets/icons/` are derived from the same
source — `avatar_cat.png` scaled onto the game's background colour by
`scripts/make-icons.mjs` — and are covered by the same license.

## Engine

- [Phaser](https://phaser.io/) — MIT License
- [Supabase JS client](https://github.com/supabase/supabase-js) — MIT License
