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
npm run build     # type-check and produce a production build in dist/
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

## Project structure

- `src/scenes/` — Phaser scenes (Boot → Preload → Auth → MainMenu → StageSelect → Battle → Result)
- `src/systems/` — pure, unit-tested game math (combat resolution, leveling/EXP curve, rewards)
- `src/data/` — data-driven content: stage definitions and tunable balance constants
- `src/state/` — the single `PlayerState` shape and a small in-memory `GameState` store
- `src/services/` — Supabase client, auth, and save/load (local + cloud)
- `tests/` — vitest unit tests for the systems and save service

## Gameplay notes (MVP scope)

- Single character, no party/roster.
- 12 hand-tuned stages with a difficulty curve; each stage unlocks the next on victory.
- Combat is a deterministic, precomputed auto-battle (`resolveBattle`) that the `BattleScene`
  animates — no twitch input, in keeping with the incremental/idle genre.
- Stats grow automatically on level-up; the Treat Shop sells permanent stat upgrades
  (Heart Cookie / Sword Candy / Shield Donut) with escalating gold costs.
- A Character page shows level, EXP progress, effective stats (base + shop bonuses),
  gold, and stage completion.
- Losing a stage has no penalty — just try again after leveling up or buying treats.
