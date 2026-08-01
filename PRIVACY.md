# Privacy

This is a small game. It collects as little as it can get away with, and the
one optional thing it collects is off until you turn it on.

## What is stored, always

Your save: hero name, avatar, level, gold, gear, which stages you have cleared,
and your settings. It lives in your browser's `localStorage` under
`incremental-rpg-save-v2:guest`, or `incremental-rpg-save-v2:user:<your id>` if
you have an account.

If you sign in, that same save is also stored in Supabase so you can pick it up
on another device. Signing in means Supabase holds your email address, because
that is what an account is.

There are no third-party scripts on the page. No ad network, no tag manager, no
CDN. The page loads nothing from any host but its own — the service worker's
strict origin check is not just a caching detail.

## What is stored only if you ask for it

Settings has a **Share play data** switch. It is **off by default**, on a new
save and on every save upgraded from an older version — consent is never
inherited from a version that never asked for it.

While it is on, and only while you are signed in, the game records these four
events and nothing else:

| Event | Fields |
| --- | --- |
| `stage_attempt` | stage number, whether it was a boss, win or loss, how many turns |
| `purchase` | gear or treat, your level, the furthest stage you have unlocked |
| `achievement_claimed` | which achievement, your level |
| `offline_collected` | how many battles, how many hours away |

That table is enforced in code, not just documented: each event has an
allowlist of fields in `src/services/analytics.ts`, and anything outside it is
dropped before the event is even queued. Timestamps are rounded to the minute.

### What is deliberately not collected

- **Your hero name**, or any other free text. There is no field that can carry
  one.
- **A device or session id.** Rows are attributed to the Supabase user id you
  already have. Guests are never uploaded at all, because attributing their
  events would mean inventing an identifier, and that is the thing this is
  trying to avoid.
- **Anything about your device**: no screen size, no user agent, no locale, no
  timezone, no IP address column.

### Turning it off

Switching it off in Settings stops collection immediately and discards whatever
was waiting to be sent. An opt-out is not a request to send one last batch.

### Seeing or deleting it

The database policy lets you read every row recorded about you, and there is no
policy allowing anyone to rewrite them. Deleting your Supabase account removes
them (`on delete cascade`).

## Contact

This is a hobby project; open an issue on the repository.
