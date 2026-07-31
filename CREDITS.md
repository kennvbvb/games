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

## Engine

- [Phaser](https://phaser.io/) — MIT License
- [Supabase JS client](https://github.com/supabase/supabase-js) — MIT License
