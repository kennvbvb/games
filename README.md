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
when you first sign in, the game asks whether to import it. Anything unreadable
is moved to `incremental-rpg-save-v2:quarantine` rather than crashing the game,
and every loaded save is re-validated (bounds-checked, unknown item/stage ids
dropped).

### When two devices disagree

A monotonic `revision` cannot tell "the cloud is simply behind" from "both
devices played on independently" — in both cases one number is larger, so
picking the winner by size silently discards whichever pile of progress happens
to be smaller. Saves therefore also carry `syncedRevision`: the revision at
which this device last confirmed it matched the cloud, advanced only when a
cloud write actually succeeds.

| local moved since sync | cloud moved since sync | outcome |
| --- | --- | --- |
| no | yes | adopt the cloud copy |
| yes | no | keep local and re-push it |
| yes | yes | **ask the player** |

The last row opens a screen showing both saves side by side — hero, level,
stages cleared, gold, when each was last played — with the further-along one
marked. There is deliberately no merge: combining two divergent saves would
invent a state neither device ever had. Whichever copy loses is kept in
`incremental-rpg-save-v2:conflict-backup` rather than deleted, and the winner is
stamped above both revisions so the other device adopts it instead of forking
again.

An unreachable cloud is not a fork, and a save upgraded from before the marker
existed defaults to "assume in sync", so neither situation can pop the dialog
spuriously.

## Analytics

Off by default, and off on every save upgraded from a version that predates the
switch — consent is not something to inherit. Settings has a **Share play data**
toggle; while it is on, and only while you are signed in, the game records four
gameplay events (stage attempts, purchases, achievement claims, offline
collections).

There is no device id, no session id, and no free-text field anywhere in the
payload — rows are attributed to the Supabase user id the player already has,
which is why guests are never uploaded rather than being given an identifier to
make it work. Each event has a field allowlist in `src/services/analytics.ts`,
so a call site that grows an extra property cannot leak it; the database
rejects unknown event names too, rather than trusting a patched client. Uploads
are append-only (no update or delete policy) and piggyback on saves, so a failed
batch can never delay or break a save.

Full detail, including exactly which fields each event carries, is in
[PRIVACY.md](PRIVACY.md).

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
- `scripts/` — one-off asset tooling: `npm run assets` fetches the fonts and
  emoji, `npm run icons` regenerates the home-screen icons from the cat avatar

## Install and offline play

The build emits a web app manifest and a service worker (both from
`vite.config.ts` — no PWA plugin, because the asset set is small and fully
known at build time). Installing puts the game on the home screen; after the
first visit the worker has precached every chunk, font and sprite, so the game
boots and plays with no network at all. Progress still saves locally, and syncs
to the cloud the next time there is a connection.

Navigations are network-first so a new deploy is picked up as soon as the
device is online; everything else is served from the cache. The cache name is
derived from the build's file list, so activating a new version drops the old
one.

The bundle is split so Phaser (the bulk of it) caches separately from game
code, and the Supabase SDK loads only when someone actually signs in — a guest
never downloads it.

## Gameplay notes (MVP scope)

- New players name their hero and choose one of six kin — Human, Elf, Dwarf,
  Orc, Fae, Undead — each with its own starting stats, per-level growth and a
  passive, plus two looks. Creation runs in two steps because name, kin and look
  will not fit one 480×720 screen without shrinking the tap targets.
- Stats are a function of **level and kin**, never read from the save, so an
  edited stat block cannot stick and rebalancing a kin applies retroactively
  with no migration. Human is defined from the pre-kin balance constants, which
  is why every older save migrates to it with every number unchanged — including
  its stage difficulty ratings, since Human's passive is the only one that never
  touches combat.
- `raceId` is a client-chosen value like `avatar`: editing a save to switch kin
  is possible and not prevented. Stats stay bounded either way, because they are
  still derived from one level and one value from a closed set.
- Saves made before kin existed keep their animal avatar; it appears on the
  Character page as the hero's buddy rather than being thrown away.
- Single character, no party/roster.
- **100 stages across 20 worlds of five.** The fifth stage of every world is its
  boss. Worlds are a fixed slice of the stage list rather than separate content,
  so adding a stage cannot leave one half-defined.
- Stage select shows one world per page, opens on the world holding your
  furthest unlocked stage, and labels the pager `World 8 / 20` rather than
  printing twenty dots.
- Backgrounds are **composed, not hand-written**: a biome supplies the palette
  and its props, and each stage adds a landmark and optional weather. All 100
  combinations are distinct, and a test asserts it — 100 hand-authored palettes
  would have been 100 chances to end up looking like nothing in particular.
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
- The shop carries gear the whole way to the last world. Within a tier each
  kind forks — raw power, or power with some padding — so no piece is simply
  better than a cheaper one, and a test asserts that no item dominates another
  on all three stats while costing less.
- Stats grow automatically on level-up; the shop sells repeatable treats
  (Heart Cookie / Sword Candy / Shield Donut, escalating costs) plus 55 one-of-a-kind
  gear pieces — the strongest are level-gated.
- Gear goes into six slots — Weapon, Head, Body, Boots and two Accessories —
  one piece each, so upgrading means choosing rather than accumulating. Owning
  a piece does nothing until it is worn; the Equipment screen swaps pieces
  freely. Saves written when there were three slots migrate with every piece
  still worn: armour becomes body, the charm becomes the first accessory.
- A Character page shows level, EXP progress, effective stats (base + shop bonuses),
  gold, gear count, and stage completion.
- **Skill trees.** Three branches of four per kin, each tier gated behind the
  one below it, and a four-slot loadout that decides which of them a fight
  actually runs under. Points come from levels and boss kills, and — like stats
  — they are *derived* rather than stored, so an edited save can claim any list
  of skills and still only keep what its level and boss count paid for.
- **Gear affixes and set bonuses.** Rarity decides how many affixes a piece
  carries; the affixes themselves are derived from the item's id, so the same
  item is the same item on every device and in every save. There is no
  reforging, because there is only ever one roll — what is bought is exactly
  what was shown. Four sets pay at two and four pieces, and each spans four
  different kinds, so wearing one costs four of the six slots.
- **Three builds, and gear that leans towards one.** Every piece carries a
  build tag — **Breaker** (strips armour, the answer to a heavily plated enemy
  that raw attack cannot touch once damage sits on the minimum-1 floor),
  **Bulwark** (blunts burst, the answer to Fierce and to boss enrage) or
  **Tempo** (combos, dodges, recovery) — or is **Flexible**, which fits any of
  them and pays nothing either way. Two worn pieces of one tag resonate: two
  pieces rather than a set's four, deliberately, because a second system asking
  for four of six slots would leave one real choice instead of two. A hero can
  resonate with more than one build at once; a mixed loadout is a plan, not a
  penalty. The tag is printed on every shop card and every equipment tile, and
  the Equipment screen names the resonances currently in force.
- **Relic gear.** Six pieces, two per build, that exist for an effect rather
  than a stat line — Void Pike strips six defence outright, Bastion Mail opens
  behind a shield, Clockwork Blades land every third blow at +35%. The effect
  and the sentence describing it live in one literal, so an effect cannot be
  retuned without its description moving with it. They are shop-gated at level
  22 for now: the long-term plan hands them out as Tower and Boss Remix
  first-clear rewards, and putting them behind content that does not exist yet
  would ship six items nobody can reach.
- **Kin mastery and relics.** A ten-rank track per kin, earned only by clearing
  stages with it. A stage is worth the number of the world it sits in and a
  world boss three times that, so the deep worlds move the bar and farming the
  opening ones cannot. Like skill points and stats, the rank is *derived from
  progress rather than stored*, which also means the track is retroactive — a
  save from before mastery existed loads already holding the rank its progress
  had earned. Each rank adds a small, uniform ramp (about +16% damage dealt and
  −10% taken once fully mastered, and the exact figures are printed on the
  screen rather than hidden). The kin-specific power lives in three relics per
  kin, opening at ranks 3, 6 and 9, of which exactly one can be carried — the
  only part of the track the player chooses, and the only progression in the
  game that gold and levels cannot shortcut.
- **Three difficulties.** Veteran opens once four worlds are fully cleared,
  Nightmare after all twenty. They scale enemy health, attack and reward but
  never defence — defence is subtracted before the minimum-1 damage floor, so
  scaling it would turn "harder" into "impossible" for a low-attack build. The
  chosen mode is re-checked against progress on every read, so a save that
  names a mode it never earned quietly falls back to Normal.
- **Status effects and boss phases.** Nine statuses — burn, poison, bleed,
  freeze, weaken, armour break, curse, regen, reflect — with a fixed resolution
  order: damage before healing (so a burn that would kill is not undone by a
  regen in the same instant), and control last (being frozen is not immunity to
  what is already running). Eight new enemy traits carry them into the back half
  of the campaign. Bosses gain phases with depth: enrage alone to World 8, one
  transformation to World 12, two from 13, three from 17 — and every transition
  is listed on the Prepare Battle screen before you commit, because a phase that
  only reveals itself at 30% health is a rewind for anyone who brought the wrong
  build.
- Losing tells you *why* — barely dented it, got over halfway and ran out of
  health, so close it survived on a sliver, or neither side could finish — and
  names a plan that would have cleared it, if one would.
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

- **The Endless Tower.** Opens once all twenty worlds are cleared, and then
  goes up forever: floors are *computed* from the floor number rather than
  authored, so floor 4,000 exists and has a stat block, a trait, a backdrop and
  a boss schedule without anyone typing it out. Unlike the campaign the curve
  compounds — health at 3.5% a floor, attack at 2.2% — which is what makes a run
  end, because player power grows from levels and gear and both of those
  flatten. The growth rates were swept, not guessed: measured against a hero who
  has just finished the campaign, x1.075/x1.045 walled at floor 20-30 and
  x1.035/x1.022 walls at 40-60, which is the one chosen. Every wall lands on a
  boss floor. Defence is capped rather than scaled, because defence is
  subtracted before the minimum-1 damage floor and a growing one would make a
  low-attack kin arithmetically unable to win rather than merely outmatched.

- **The Realm Rift.** One fight, rebuilt every week from the week number, so
  everybody sees the same rift all week. It hands the player a **boon** and the
  enemy a **bane**, walked off the week with co-prime pool sizes (7 and 6) so
  the pairing takes 42 weeks to come round rather than 7. Clearing it pays once
  a week; losing does not consume the week, because a rift you cannot beat yet
  should still be there when you come back with a better build.

  Its numbers scale to the last world boss you actually beat, rather than being
  fixed. That was measured, not assumed: a fixed stat block sized for the
  endgame was beaten in **0 of 42 weeks** by every kin at the eight-world gate,
  and a block sized for the gate would be trivial later. Scaled, the same walk
  wins 14–36 of 42 weeks at the gate and 39–42 after the full campaign. Two
  players in the same week are fighting the same boon, bane, name and backdrop;
  they are simply not fighting the same health bar.

  The rift deliberately pays **only gold and EXP**. The week comes from the
  device clock and there is no server to check it against, so a player who
  moves their clock can claim as many weeks as they have patience for — and
  every fix for that needs a server. Rather than pretend otherwise, the reward
  is something the game already gives away without limit through idle farming,
  which makes the hole not worth crawling through. That is why relics stayed on
  the mastery track, where they are earned from campaign progress a clock
  cannot fake.

- **The Codex.** A compendium of enemy traits, status effects, equipment sets
  and the kin's own relics, with locked rows shown rather than hidden — a
  reference that hides what you have not met cannot tell you how much is left,
  and that is most of why anyone opens one. Discovery is **entirely derived**
  from progress the save already keeps: a trait is known once a stage carrying
  it has been cleared (including the ones a boss only wears after a phase
  change), a status once something that inflicts it has been beaten, a set once
  a piece is owned, a relic once mastery has opened it. No new save field and
  no schema bump, which also means the book is filled in retroactively for
  every existing save rather than starting everyone at zero. A stored discovery
  list would have been a second copy of the truth: editable, driftable, and
  wrong for anyone whose save predated it.

- **Ascension.** Once every one of the hundred stages is cleared, the campaign
  can be given back for something permanent. Level, gold, gear, skills and stage
  progress reset; name, kin, look, settings, claimed quests, the tower record
  and the rift week do not — wiping a tower record would punish the player for
  using the very feature ascension exists to feed. Each ascension is worth +10%
  damage dealt and +7% health, up to ten of them; the counter keeps climbing
  past that as a record while the power stops, because an uncapped multiplier
  turns every later run into a formality.

  What one is worth was measured, not guessed. Walking the campaign and then
  climbing the tower until it walls: **0 ascensions → floor 40-60, 2 → 40-90,
  5 → 60-100, 10 → 80-100.** So an ascension buys roughly five floors, or one
  boss gate per two of them.

  Kin mastery survives the reset, because a finished campaign is banked into
  the mastery budget rather than forgotten. Losing your relics at the exact
  moment the game asks you to start over is the worst possible moment to take
  something away.

### Known balance state

`tests/campaign.test.ts` walks all hundred stages for each of the six kin,
buying gear and spending skill points the way a player would. Two things it
currently measures, recorded here rather than left in a comment nobody reads:

- **Nothing walls anybody.** Zero forced replays, for every kin, on every plan,
  on every difficulty. An earlier version of this simulation reported a
  worst-case of fourteen replays, but it assembled its own hero and left out
  gear affixes and set bonuses entirely — it was measuring a player the game
  does not produce. Routing it through `playerBattleInputs`, the one place the
  battle scene, the preview, offline farming and the lab all agree on, dropped
  the figure to zero. The campaign did not get easier; the measurement got
  honest.
- **Harder modes are currently easier overall.** Every mode pays out more than
  it scales enemy health (1.35 against 1.30 on Veteran, 1.75 against 1.65 on
  Nightmare), so the extra EXP outruns the extra difficulty. A hero who walks
  the campaign on Nightmare arrives at the last boss at level 42; on Normal, at
  level 34. Both finish it at full health.

Raising the multipliers, or flattening the defence curve that makes an endgame
hero take exactly 1 damage a swing, is a design decision rather than a bug fix,
so the numbers are left as they are and the finding is written down instead.

## Admin Test Lab

A developer tool, opened with `Ctrl+Shift+A` or the TEST LAB badge on the main
menu. It edits a **clone** of the save: player and progress editors, save
export/import, an asset inspector, and a headless battle simulator that compares
all three plans or all six kin against any stage and can prove a thousand runs
of one input give one result.

Two grants let you in. `VITE_ENABLE_DEV_ADMIN=true` works only in a development
build — the check is `import.meta.env.DEV && the flag`, and `DEV` is statically
false in production, so the door cannot travel with a leaked `.env`. In
production the grant comes from a role claim the Supabase *server* put in
`app_metadata`; `user_metadata` is never consulted, because any signed-in client
can write its own.

Hiding a button is not security, and the code says so rather than pretending
otherwise. The lab has no privileged server surface: it clones the player's own
save, runs the same pure combat functions the game runs, and can only write back
through the ordinary save path, which RLS already scopes to `auth.uid()`. What
the role check does buy is an audit log only a verified admin can append to, and
the right place for any future action that *is* server-authoritative.

Edits never reaching disk is structural rather than a promise: `AdminTestState`
imports nothing from `services/`, and a test asserts on its import list.
Applying to the real save needs a named confirmation token, a second dialog, and
a trip back through the save validator, so no sequence of lab edits can produce
a save the game would refuse to load.

## License

Source code is MIT licensed — see [LICENSE](./LICENSE). The bundled art and
typeface are under the SIL Open Font License 1.1; see [CREDITS.md](./CREDITS.md).
