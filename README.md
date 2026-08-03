# OSRS Companion

A second-monitor task tracker for OSRS. You tell it when you did something, it
owns the timers and pings you when things come back up.

It never reads the game client. It has no idea what you're doing in game and
doesn't try to. You press Done, it starts a timer. That's the whole contract,
and it's why there's nothing here that could trip a ToS line.

## Run

```bash
npm install
node scripts/fetch-tiles.mjs    # one time, pulls ~34 MB of map tiles
npm run dev                     # http://localhost:5273
```

The tiles are not in the repo (8530 files) and the map tab is blank without
them. The fetch is resumable, so a killed run just picks up where it stopped.

Leave it open on your second monitor. State lives in `localStorage`, so it
survives refreshes and reboots.

## Herb run

A second tab with the world map on it, at 8 pixels per game square. Every stop
is placed from its real in-game coordinates rather than by hand, so the pins are
where the places actually are.

Click a pin or a list row to mark it visited. The card at the top always names
the next stop and the teleport to get there, so the question "where now" never
needs asking. "Add marker" drops your own named pin.

Place names are drawn as live text, so they stay sharp at every zoom level and
thin out as you zoom away instead of burying the map. Toggle them off if you
prefer it clean.

## Design rules

This is built as an executive-function aid, not a dashboard. The rules it
follows, in priority order:

1. **Ready tasks are the only loud thing on screen.** Everything else is grey.
   You should be able to glance over and get one answer without reading.
2. **You never plan in it.** No creating tasks, no scheduling, no grooming a
   backlog. The moment it becomes another list to maintain, it gets abandoned.
3. **No streaks, no guilt, no red "overdue" badges.** Miss a week and it just
   tells you what's ready now. Punitive tracking makes people quit the tool
   rather than catch up.
4. **Notifications are rare on purpose.** Only the short-loop runs (birdhouse,
   herb, seaweed) ping you. Being told your hardwood trees are ready after
   three days is noise, and noise is how this gets muted and then ignored.
5. **Turn off what you don't do.** The task picker at the bottom is the most
   important setting. A list full of things you ignore stops being a signal.

## Timers

Two kinds of task:

- **Cooldown** starts when *you* mark it done. Farming and birdhouse timers work
  this way in game. they run from when you plant or set, not off a global clock.
- **Daily** resets at **00:00 UTC** for everyone regardless of when you did it.

Defaults:

| Task | Timer | Notifies |
| --- | --- | --- |
| Birdhouse run | 50 min | yes |
| Herb run | 80 min | yes |
| Giant seaweed | 40 min | yes |
| Tree run | ~10.7 h | no |
| Fruit tree run | ~15 h | no |
| Hespori | ~26 h | no |
| Hardwood trees | ~3 days | no |
| Zaff / Naff battlestaves | daily | no |
| Bert's sand | daily | no |
| Kingdom of Miscellania | daily | no |
| NMZ herb boxes | daily | no |
| Farming contract | daily | no |

Values marked APPROX in `src/tasks.ts` are wiki or community recommended
figures that vary a little in game (tree types differ, Hespori is 22 to 32 hours
depending on plant time). **Edit them in `src/tasks.ts` if yours feel off.** A
number you trust beats a number I guessed at.

## Notifications

Click "Enable desktop notifications" in the header on first run. The browser
prompts once. If you block it, timers still work, the app just stays passive.

The tab has to stay open for notifications to fire. That's the tradeoff for it
being a local page with no install and no background service.

## Layout

- `src/tasks.ts` task definitions. Edit here to change timers or add tasks.
- `src/store.ts` persistence and readiness logic (daily reset boundary,
  cooldown maths).
- `src/notify.ts` desktop notifications, including the fire-once-per-cycle
  logic so it doesn't nag.
- `src/ui.ts` rendering.
- `src/main.ts` the 1 second tick loop and ready-transition detection.
- `src/routes.ts` run routes. Each stop carries its real world coordinates.
- `src/worldmap.ts` the world-to-pixel transform and tile geometry.
- `src/worldmapview.ts` the tile viewer: pan, zoom, pins, labels, markers.
- `scripts/fetch-tiles.mjs` pulls the map tiles.
- `scripts/fetch-labels.mjs` rebuilds `public/labels.json` from the wiki.

## Roadmap

This is slice one. The wider idea is one place for the whole optimisation
problem, so the pieces that would come next:

1. **Goal tracker** for long grinds, with progress pulled from your hiscores so
   it updates itself. Herblore 59 to 90 as a bar that moved this week rather
   than 5.1M xp as a wall of text.
2. **"What do I do now?"** reading goals plus stats to answer the single
   question that costs the most activation energy.
3. **Prep checklists** per activity, gear and requirement checks for capes,
   quests, raids.
4. **The Jad/Inferno sim** (already built, separate repo at
   `../osrs-tick-trainer`) folded in as one view among several.
