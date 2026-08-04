# OSRS Companion

A second-monitor task tracker for OSRS. You tell it when you did something, it
owns the timers and pings you when things come back up.

It never reads the game client. It has no idea what you're doing in game and
doesn't try to. You press Done, it starts a timer. That's the whole contract,
and it's why there's nothing here that could trip a ToS line.

> ## This is free, and always will be.
>
> **If anyone charged you for this, you were scammed.** There is no paid tier, no
> premium version, no "pro" unlock, no subscription, and there never will be. The
> only official source is this repository. Nobody is authorised to sell you access
> to it, and any site or person charging for it is not connected to this project.
>
> That is not a marketing line, it is the entire reason this exists. A lot of OSRS
> tools charge a subscription for a thin wrapper over a free public API plus
> arithmetic, and a fair number of them are quietly wrong on top of it. This is
> the free thing that makes those pointless.
>
> It is AGPL-3.0, so you can also read every line, fork it, and check that this
> paragraph is true rather than taking my word for it.

## Run

Needs Node 18 or newer.

```bash
npm install
node scripts/fetch-tiles.mjs     # one time, ~34 MB of map tiles
node scripts/fetch-labels.mjs    # one time, place names
node scripts/fetch-icons.mjs     # one time, scans the tiles for map icons, ~90s
node scripts/clean-tiles.mjs     # one time, erases the wiki's baked-in icons
npm run dev                      # http://localhost:5273
```

Neither fetch is in the repo, and the map tab is blank without the tiles. That
is deliberate rather than a size optimisation: this repository contains no third
party content, so what you download is your own local copy. See
[ATTRIBUTION.md](ATTRIBUTION.md).

The tile fetch is resumable, so a killed run picks up where it stopped.

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

Map icons (banks, altars, farming patches, fishing spots and 100 more types) are
drawn as their own layer rather than read off the tile pixels. The wiki bakes its
icons into the tiles at a fixed size per tile, so they shrink every time you zoom
in and there is nothing you can do about that from the outside. Setup erases them
from your local copy and the app draws its own instead.

**Nothing on the map resizes when you zoom.** Icons, labels and pins each have a
slider, and the size you pick is the size you get at every zoom level, so you are
never rescaling things just because you zoomed. There is a reset next to them.

The controls sit on the map itself, as a small rail down the top left: search,
display, icon types, markers. One panel opens at a time, so it never grows into a
wall of buttons. Search sits above it and highlights matching places and icons while
dimming everything else, and it finds a place even when you are zoomed out past the
point where its label would normally show. If you would rather have the map clear,
unpin search and it tucks into the rail with the rest.

Icons can be filtered by type. 119 of them have real names (Bank, Fishing spot,
Altar) and cover about 88% of the icons on the map; the rest are sprites the wiki
never catalogued, so they collapse into one row you can turn off wholesale. Hover
tooltips name the icon under your cursor, since an icon is the one thing on the map
that does not say what it is.

The placements are found by scanning your own downloaded tiles for the icons,
which is why they are current. The only placement list the wiki publishes is from
2019 and has nothing in Varlamore at all. Scanning finds 3114 icons where that
list has 1792, including whole icon types no catalogue contains at all, lifted
straight off the map. Checked against the list where it is still valid: 96% found,
and what it found beyond that was real rather than invented.

## Map

The same map on its own tab with no route on it. It is there because a map is worth
having open on a second monitor whether or not you are doing a run. Everything the
herb run map does it does: zoom, labels, icons, your own markers, the size sliders.

Markers are shared, so one you drop here shows up on the route maps too. Each map
remembers its own position, so opening this one does not move your herb run view.

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
- `src/map/` the reusable map component: pan, zoom, pins, labels, markers.
- `src/mapview.ts` the standalone Map tab.
- `src/market/` the Market tab: prices API, tax, gates, sizing, slot allocator.
- `scripts/fetch-tiles.mjs` pulls the map tiles.
- `scripts/fetch-labels.mjs` rebuilds `public/labels.json` from the wiki.
- `scripts/fetch-icons.mjs` scans the tiles to build the map icon overlay.
- `scripts/clean-tiles.mjs` erases the baked icons so the overlay is the only one.

## Fight Caves trainer

A practice sim for the fight that actually kills people. Faithful 600ms tick
engine, real OSRS ranged damage model, Jad with the un-telegraphed melee hit
when you drift adjacent, and healers that aggro and chase so you have to kite
them properly.

It never touches the game client or Jagex servers. It is a standalone game that
reimplements documented mechanics, so it is somewhere safe to drill the thing
that costs you the cape.

Click to move, click Jad to attack. `1` mage, `2` range, `3` melee, `0` none.
`Space` toggles run, `R` restarts, `H` toggles the coaching hints.

## Market

Live Grand Exchange trading off the wiki's free real-time prices API, with the
maths done properly. Two views behind one toggle.

**Basic** is the point of the tab. Tell it what is in your bank and it fills your
eight Grand Exchange slots with a plan: which item, how many, what to spend, what
it comes back as. Nothing else on screen. Every empty slot says why it is empty
rather than leaving you to guess.

**Advanced** is the whole market as a table, twenty sortable columns with a column
picker, so nobody has to leave for a bigger site.

Four things most flip tools get wrong, and this does not:

- **The tax is 2%, not 1%.** It changed on 29 May 2025. A tool still using the old
  rate overstates every margin, and overstates it worst on the expensive items you
  were most likely to act on. Tax here rounds down, caps at 5m at a 250m sale
  price, and knows all 48 exempt items, which include bonds and every teleport
  tablet.
- **The bid and the ask are two different trades at two different moments.** On a
  volatile item the price just drifts between them, and drift in the convenient
  direction invents a margin that was never there. Checked against what actually
  traded in the last hour, which is what catches it. This one rejects around 580
  items that otherwise look tradeable, and the first version of this tab wanted to
  put 1.1b into a bond margin that did not exist.
- **Your profit rate is capped by the buy limit.** You cannot buy more than the
  limit per four hours no matter how good the margin is, so profit times limit is
  not a rate until you divide it by four hours. Tools that skip that step rank a
  slow item above a fast one you could run twice.
- **Buying more of something does not make you more per hour.** Twice the quantity
  is twice the profit and twice the wait. All the extra does is tie up gp another
  slot could have used, so positions are sized to when you will next look at the
  Grand Exchange, not to the size of your bank.

A margin on something that trades twice a day is also fiction, so liquidity, price
age, spread sanity and one-sidedness are all gates rather than decoration. Each one
is adjustable and each one tells you by name what it removed.

Full write-up in [docs/market.md](docs/market.md).

## Licence and attribution

Code here is original and licensed **AGPL-3.0** (see [LICENSE](LICENSE)).

AGPL rather than MIT on purpose. If you fork this, add to it, and host it
somewhere, you have to publish your source to the people using it. Take it,
improve it, run it. You just cannot close it and charge people for access to
something they can't see.

To be exact about the free promise above, since the licence and the promise are
two different things: **this project will never charge you anything.** The licence
does technically let a third party redistribute their own fork commercially, on
the condition that they publish their source too. If that ever happens it is not
this project, it is not endorsed, and you did not need to pay them, because the
original is right here for free.

The wiki data the app uses is fetched at setup and is not redistributed here.
The full picture is in [ATTRIBUTION.md](ATTRIBUTION.md), including why the fetch
step exists.

No game assets, no decompiled code, nothing from private server repos. If you
contribute, hold that line. [CONTRIBUTING.md](CONTRIBUTING.md) has the rest: the
map coordinate model, the tile traps, the GE tax rules, and the gotchas that look
like bugs and are not.

## Roadmap

The wider idea is one place for the whole optimisation problem. What comes next:

1. **Market watchlist.** Pin items, set buy-below and sell-above thresholds, get a
   desktop notification when a price crosses one. Fires on the crossing, not
   every poll while it sits there, same as the dailies.
2. **Goal tracker** for long grinds, with progress pulled from your hiscores so
   it updates itself. Herblore 59 to 90 as a bar that moved this week rather
   than 5.1M xp as a wall of text.
3. **"What do I do now?"** reading goals plus stats to answer the single
   question that costs the most activation energy.
4. **Prep checklists** per activity, gear and requirement checks for capes,
   quests, raids.
5. **More routes**, and the full 63 wave Fight Caves spawner, then Inferno.
