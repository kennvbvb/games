# Incremental RPG

A browser-based incremental/idle RPG built with Phaser 4 + TypeScript + Vite. Fight through a
run of stages, gain EXP and gold, level up, and grow strong enough to clear the next stage.
Play as a guest (progress saved on-device) or create an account to sync progress to the cloud
via Supabase.

## Getting started

```bash
npm install
npm run dev       # start the dev server
npm run test      # run the unit tests (leveling/combat math, save service)
npm run test:e2e  # run the Playwright end-to-end suite against a production build
npm run build     # type-check and produce a production build in dist/
npm run assets    # re-download the art in public/assets (already committed)
npm run typecheck # type-check without emitting
```

## Cloud saves (optional)

The game works fully in guest mode with zero configuration — progress is stored in
`localStorage`. To enable account sign-up/sign-in and cross-device cloud saves:

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL editor, run [`supabase/schema.sql`](./supabase/schema.sql) to create the `saves`
   table and its row-level-security policies.
3. Copy `.env.example` to `.env` and fill in your project's URL and anon key
   (Project Settings → API).
4. Restart `npm run dev`.

Without a `.env` file, the "Sign In"/"Sign Up" buttons are disabled and the game falls back to
guest-only mode automatically.

## Saves

Progress is namespaced so profiles can never bleed into each other:

- `incremental-rpg-save-v2:guest` — guest play on this device
- `incremental-rpg-save-v2:user:<id>` — one slot per signed-in account

A signed-in account never silently adopts guest progress; if a guest save exists
when you first sign in, the game asks whether to import it. Saves carry a
`schemaVersion` and a monotonic `revision`, so when the local and cloud copies
disagree the newer one wins and is re-synced. Anything unreadable is moved to
`incremental-rpg-save-v2:quarantine` rather than crashing the game, and every
loaded save is re-validated (bounds-checked, unknown item/stage ids dropped).

## Languages

The interface ships in English and Thai, switchable in Settings and remembered
in the save. A new player's language is guessed from the browser.

`src/i18n/en.ts` is the source of truth for message keys; `th.ts` is typed
against it, so a missing or misspelled key fails the build. Unit tests also
assert that both dictionaries agree on keys and on `{placeholder}` names.

Stage, enemy and item names are content rather than interface text and are
currently English in both languages.

## Art and typography

All visuals come from open-licensed sources (SIL Open Font License 1.1) and are
committed under `public/assets/`, so builds need no network access:

- **Fredoka** — the rounded UI typeface, loaded via `@font-face`.
- **Mitr** — carries the Thai script, which Fredoka does not cover at all.
- **Noto Color Emoji** — 128px PNGs used as real sprites for hero avatars,
  enemies, shop items, UI icons, and stage scenery.

`src/data/emojiAssets.json` is the single source of truth: it maps every texture
key to the emoji it came from, driving both the download script
(`npm run assets`) and the runtime preload. Full attribution is in
[CREDITS.md](./CREDITS.md).

## Project structure

- `src/scenes/` — Phaser scenes (Boot → Preload → Auth → MainMenu → StageSelect → Battle → Result)
- `src/systems/` — pure, unit-tested game math (combat resolution, leveling/EXP curve, rewards)
- `src/data/` — data-driven content: stage definitions and tunable balance constants
- `src/state/` — the single `PlayerState` shape and a small in-memory `GameState` store
- `src/services/` — Supabase client, auth, and save/load (local + cloud)
- `tests/` — vitest unit tests for the systems and save service
- `e2e/` — Playwright specs driving the built game in a mobile viewport

## Gameplay notes (MVP scope)

- New players name their hero and pick an animal avatar before starting.
- Single character, no party/roster.
- 12 hand-tuned stages with a difficulty curve and per-stage backdrop; each stage
  unlocks the next on victory.
- Combat is a deterministic, precomputed auto-battle (`resolveBattle`) that the `BattleScene`
  animates — no twitch input, in keeping with the incremental/idle genre.
- Idle-friendly: pick a battle speed (×1/×2/×4), skip the animation on stages you
  have already cleared, and queue auto-battles that stop the moment you lose.
- While the game is closed your hero keeps farming the last stage you won, paying
  out on return (capped at 8 hours). Offline battles take 40s each, so idling is
  slower than playing rather than secretly paying less.
- Stage select previews each fight: rewards, plus an exact difficulty read
  (Easy / Fair / Hard and the HP you would have left) simulated from the real
  deterministic combat.
- Stats grow automatically on level-up; the shop sells repeatable treats
  (Heart Cookie / Sword Candy / Shield Donut, escalating costs) plus 20 one-of-a-kind
  gear pieces — the strongest are level-gated.
- Gear goes into three slots (Weapon / Armor / Charm), one piece each, so
  upgrading means choosing rather than accumulating. Owning a piece does
  nothing until it is worn; the Equipment screen swaps pieces freely.
- A Character page shows level, EXP progress, effective stats (base + shop bonuses),
  gold, gear count, and stage completion.
- Twelve achievements track stages cleared, levels reached, gear owned, treats
  eaten, battles won and gold earned. Progress is derived from the save rather
  than counted separately wherever possible, so nothing can drift out of sync.
  Rewards are claimed by hand from the Quests screen, and the menu button shows
  how many are waiting.
- The canvas renders at 2x supersampling (`src/config/layout.ts`) so text and shapes
  stay crisp on high-DPI screens.
- A three-step intro points new players at their first fight, their first win
  and the shop, then gets out of the way for good.
- Every button is keyboard operable: Tab and arrow keys move a visible focus
  ring, Enter or Space activates. Settings covers battle speed, skip-cleared,
  auto-advance and Reduce motion, which silences all decorative animation and
  defaults from the OS `prefers-reduced-motion` setting.
- Losing a stage has no penalty — just try again after leveling up or shopping.

## License

Source code is MIT licensed — see [LICENSE](./LICENSE). The bundled art and
typeface are under the SIL Open Font License 1.1; see [CREDITS.md](./CREDITS.md).
