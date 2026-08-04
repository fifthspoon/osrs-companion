# Contributing

Everything here was learned the expensive way. Read the section covering whatever
you are about to touch, because several of these look like bugs and are not.

## How this project is run

Feedback and proposals are open. **Merge decisions are not.** This is a single
maintainer project and it stays that way: fork it, open a pull request, and it
gets reviewed and merged or declined by the maintainer. That is not a comment on
anyone's code, it is just how the project is governed, and saying so up front
seems fairer than letting people find out at review time.

Where to put things:

- **Issues** for a specific defect. A number that looks wrong, a crash, a broken
  step. There is a dedicated template for wrong numbers and it is the single most
  useful thing you can file here, for the reason in the next paragraph.
- **Discussions** for anything open ended. Questions, ideas you have not thought
  all the way through, how it went for you, whether an approach is the right one.
- **Pull requests** for a change you have already written.

**Correctness is the point of this project**, not feature count. Plenty of paid
OSRS tools are a thin wrapper over a free public API plus arithmetic, and a fair
number of them are quietly wrong. So a PR that fixes a number, or an issue proving
one is wrong, is worth more here than a new tab. That is also why the app is most
dangerous when it is working: it hardcodes facts that live on someone else's
server, and when one of those changes the build stays green and the numbers
silently go wrong.

A pull request will be looked at more quickly if it does these things:

- **Says what you actually verified**, and what you did not. "I typechecked it but
  never opened it in a browser" is a genuinely useful sentence and costs you
  nothing. A confident claim that turns out to be arithmetic only is the one thing
  that will slow a review down.
- **Keeps to one thing.** A fix plus a refactor plus a rename is three reviews
  wearing a trenchcoat.
- **Moves the docs with the code** when it changes a feature, a setup step or an
  invariant.
- **Contains nothing personal.** See the second hard rule below. This applies to the
  commit message too, which is the one thing nobody re-reads before pushing.

CI runs on every pull request: typecheck, build, a third party content gate over
both the tree and the full history, a personal data gate over the tree and every
commit message, and an em dash check. It has to be green. Everything it checks is
described in this file.

Contributions are accepted under AGPL-3.0, the same licence as the rest of the
project. There is no CLA and you keep your copyright.

[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) is short and worth thirty seconds. The
summary is that blunt technical disagreement is welcome and being a dick to people
is not, which are easier to tell apart than the length of most such documents
suggests.

## The one hard rule

**No third party content may enter this repository.** Not map tiles, not wiki
text, not game assets, not in a repo and not bundled into a future installer.

It is currently 100% original code, which is what lets it carry a real open
source licence. `public/tiles/` and `public/labels.json` are gitignored and
fetched by script at setup, and they must stay that way. The full reasoning is in
[ATTRIBUTION.md](ATTRIBUTION.md), which is worth reading before you add any data
source. A new source means a new section in that file, in the same commit.

`src/fight/` is an original reimplementation from publicly documented mechanics.
No decompiled code, no game assets, nothing from private server repositories.
Hold that line if you extend it.

## The other hard rule: nothing personal

This repository is public, and **history is what a clone gets**, so a delete commit
does not undo a leak. Keep out of tracked files and out of commit messages:

- Absolute local paths. `C:Users...` and the like carry a real name and a
  directory layout, and they arrive through error messages, script defaults and
  pasted terminal output more often than through anything deliberate.
- Personal email addresses, webhook URLs, tokens and keys. There are no accounts in
  this project, so anything of that shape is a mistake.
- Names of unrelated private repositories. Mentioning one tells a reader it exists.
- Game account identity. Character name, stat tables, bank value, hiscores links.

CI checks the shapes of these on every push, with a positive control, over the tree
and over every commit message. Identity-specific patterns are deliberately **not**
in the workflow, because a denylist of real names in a public file publishes the
exact strings it exists to keep out. Those live in local gitignored tooling.

**If you are an AI agent, this rule is aimed at you.** You have read files the
reader has not, and you cannot tell from inside a sentence which half a fact came
from. Fluency is the failure mode: the more natural the prose, the easier it is for
a private detail to ride in on it. Default to leaving personal detail out, and ask
rather than deciding.

### If you are packaging this as a desktop build

**Do not bundle `public/tiles/` or `public/labels.json` into the installer.**
Putting them in app resources is redistribution, which is the exact thing the
gitignore exists to prevent. It does not become acceptable because it is a binary
instead of a repo.

The compliant shape is the one that works today: ship code, fetch on first run.
Move `scripts/fetch-tiles.mjs` behind a first-launch progress screen so the user's
own machine pulls the user's own copy. That is a UX change, not a licensing one.

Two other obligations a distributed build carries: ship the `LICENSE` text
somewhere reachable (an About box is fine) along with a way to get the
corresponding source, and make `ATTRIBUTION.md` reachable from the UI. Someone who
installs a binary never sees the readme.

## Setup

```bash
npm install
node scripts/fetch-tiles.mjs     # ~34 MB of map tiles, resumable
node scripts/fetch-labels.mjs    # place names into public/labels.json
node scripts/fetch-icons.mjs     # scans the tiles for icons, run AFTER fetch-tiles
node scripts/clean-tiles.mjs     # erases the baked icons, run AFTER fetch-icons
npm run dev                      # http://localhost:5273
npm run build                    # tsc --noEmit then vite build
```

Node 18 or newer.

**A fresh clone has no map.** The tiles are 8530 files of regenerable data and are
not committed. Until you run the fetch, the map tab renders blank. That is
expected, not a bug to debug.

The port is pinned in `vite.config.ts` with `strictPort: true`. 5173 is Vite's
default and collided with another project's staging server. Do not move it back
and do not remove `strictPort`: without it Vite silently picks another port and
you end up staring at a stale build wondering why your change did nothing.

The dev server sometimes leaves a zombie process holding the port. Kill by port
before restarting. With `strictPort` it fails loudly rather than drifting.

## Design intent

This is an executive-function aid, not a dashboard. Its job is to **remove
decisions**, not to present information. Most OSRS optimisation questions already
have a known answer somewhere, and the cost is retrieving it and deciding rather
than the answer itself. So the app should have already decided and should say the
one next thing.

**It never reads the game client.** The user presses buttons, the app owns timers
and routes. That is the whole contract, and it is why there is no automation
surface here.

There is a second motive worth knowing because it shapes priorities. Plenty of
paid OSRS tools are a thin wrapper over a free public API plus arithmetic, and a
fair number of them are quietly wrong. **That makes correctness the feature.**
Being free is not the differentiator, since anyone can be free. Being right when
the paid tools are wrong is. The 2% tax below is the clearest example. Chase that
kind of thing rather than feature count.

## The map: how it works now

**There is no calibration any more. Do not add it back.**

Earlier versions used one flat 9216x6528 PNG and a two-click landmark wizard to
solve a linear transform, because nobody knew exactly how the image mapped to
world coordinates. The horizontal axis never converged and pins sat visibly off.

That problem is gone. The map is a tile pyramid where **tiles are indexed directly
by in-game coordinates**, so the transform is exact arithmetic:

```
span   = 256 / 2^z          game squares covered by one 256 px tile
tileX  = floor(worldX / span)
tileY  = floor(worldY / span)

px = worldX * 8
py = (4352 - worldY) * 8    y flipped, north is up in game
```

Verified end to end: Lumbridge at (3222, 3218) lands at base pixel (25776, 9072),
inside z3 tile (100, 100), which is the tile the server actually returns for it.

**Consequence: if a pin looks wrong, the pin's world coordinates are wrong, not
the map.** Check that stop against the wiki. Do not touch the transform.

`ORIGIN_Y` is 4352 rather than the more obvious 4224 because it has to be a
multiple of the largest tile span (256 at z0) or tile rows stop lining up at low
zoom.

## Where the tiles come from

- Tile URL:
  `https://maps.runescape.wiki/osrs/versions/{VERSION}/tiles/rendered/{mapID}/{z}/{p}_{x}_{y}.png`
- `mapID` 0 is the surface, `p` 0 is ground level. `maxNativeZoom` is 3, which is
  8 px per game square. z4 and z5 are 404, so there is no more detail to be had
  and anything beyond that is upscaling.

**Two traps, both of which cost real time:**

1. The wiki documents the format as `{p}_{x}_{-y}.png`. The `{-y}` is a Leaflet
   placeholder name, **not a literal minus sign**. Indices are plain positives.
   Building the filename with a real `-` returns 404 for every single tile.
2. `maps.runescape.wiki/osrs/` still serves an old app whose `data/config.json`
   points at `cacheVersion 2019-10-31_1`. Those tiles are **bare terrain with no
   icons and predate Varlamore entirely.** They are not the ones you want. The
   live wiki uses the versioned path above.

If tiles start returning 404, the version string has rolled. Find the current one
by grepping a wiki page for it:

```bash
curl -s https://oldschool.runescape.wiki/w/Civitas_illa_Fortis | grep -o 'versions/[0-9-]*_[a-z]'
```

Then update `VERSION` in `scripts/fetch-tiles.mjs`.

The two tile sets are different architectures, not just different vintages. The
2019 set has bare terrain with icons as a separate toggleable GeoJSON overlay. The
current set **bakes the icons into the pixels**, so they cannot be turned off.
Current-and-baked was chosen deliberately, because an accurate map with Varlamore
on it beats being able to hide icons. There is no bare variant on the current
version: `base`, `terrain`, `plain`, `raw` and `noicons` all 404.

## Map overlay sizing

**Everything drawn over the map is a constant size on screen and does not change
with zoom.** Icons, labels and pins all work this way. Do not reintroduce a
zoom-dependent size curve.

Earlier versions grew each overlay with zoom through a clamped cube root called
`growth()`. It was removed because it is both non-standard and bad to use.
Leaflet, Mapbox and Google all render markers at a fixed screen size by default;
scaling with zoom is the opt-in exception, not the norm. And in use it means any
size you choose is only correct at the zoom you chose it at, so you end up
rescaling every time you zoom. That is the complaint that killed it.

So the three sliders are absolute sizes, not multipliers on a curve:

- Icons are `ICON_BASE_PX` (22) times the icon slider, in screen pixels.
- Labels and pins are their CSS size times their slider, applied as
  `sizePrefs.x / zoom` so the layer scale cancels out exactly.

`sizePrefs` persists under `osrs-companion:mapsize:v1`, clamped 0.5x to 3x on
both read and write so a hand-edited value cannot break the map. The sliders call
`apply()` directly instead of triggering a rerender, so dragging one is
continuous rather than rebuilding the DOM per input event.

## Panning limits

**The pan clamp lives in `apply()` on purpose.** That is the single funnel writing
the layer transform, so it covers drag, wheel zoom and fit alike without each
having to remember. When the world is larger than the viewport the viewport is
kept inside it; when smaller, the world is centred. Without it you can drag the
world entirely off screen and be left staring at empty background with no cue
which way back, which reads as the map being broken.

Zoom out is clamped to the fit zoom, recomputed in `fit()` on every resize. Below
that the map is smaller than its own frame, which puts black bars back around it.


## Map extent and the stage shape

`WORLD_BOUNDS` is `minX 960, minY 2048, maxX 4032, maxY 4224`, and those are the
real edges, verified against the server rather than guessed. Tile column 30 exists
and 29 returns 404; column 125 exists and 126 returns 404; row 64 exists and 63
returns 404; row 131 exists and 132 returns 404.

It was previously `minX 1024, maxX 4096`, which was wrong at both ends at once. It
clipped two real tile columns off the west, so the map had no ocean margin on that
side, and it padded 64 empty squares onto the east. Centring that rect therefore
pushed the whole map visibly left. If the map ever looks off centre, suspect these
numbers before you suspect the transform.

The same numbers appear in `scripts/fetch-tiles.mjs` and `scripts/fetch-labels.mjs`.
Change all of them together. `fetch-icons.mjs` derives its extent from the tiles on
disk instead, so it needs no update.

**`.wmstage` carries `aspect-ratio: 24576 / 17408`, which is those bounds in base
pixels.** That is what makes a fitted map fill the stage exactly, so the border
sits flush instead of leaving a black bar on whichever axis `fit()` did not bind.
It replaced a `height: min(72vh, 760px)` that had no relationship to the map's
shape and so could never line up. **If the bounds change, change this ratio too**,
or the black bars come back.

Matching the aspect is necessary but not sufficient, because zooming out below the
fit still shrinks the map inside its frame and brings the borders back. So
`minZoom` is the fit zoom, recomputed in `fit()` on every resize, and both the
wheel handler and `clampView()` clamp to it. There is no reason to zoom further
out than the whole map anyway.

## The icon overlay

The wiki bakes its map icons into the tile pixels at a **fixed size per tile**,
regardless of zoom level. Since each level up halves the game-world area a tile
covers, the icons halve in world terms every time you zoom in:

| Tile level | Tile covers | Baked icon spans |
|---|---|---|
| z0 | 256 squares | ~15 game squares |
| z1 | 128 squares | ~7.5 |
| z2 | 64 squares | ~3.75 |
| z3 | 32 squares | ~1.9 |

So they visibly pop smaller each time `pickTileZoom()` crosses a boundary. You
cannot fix that by scaling tiles, because the icons are pixels in the same
raster as the terrain.

**Do not "fix" this by biasing `pickTileZoom()` down.** It works, and it is the
wrong trade: it blurs all the terrain to enlarge the annotation drawn on top of
it, reversing the deliberate round-up-for-sharpness choice in that function.

The fix is the same one labels already use: stop using baked pixels. The viewer
draws icons as counter-scaled elements obeying `iconScale()` and the user's size
slider, so they never shrink.

### Where the placements come from

**`fetch-icons.mjs` finds them by scanning your downloaded tiles for the wiki's
own icon sprites.** It does not download a placement list, and this is deliberate.

The wiki does publish one, at `data/overlayMaps/MainMapIconLoc.json`, and it is
useless on its own: it is vintage `2019-10-31_1`, so it has **zero** icons in
Varlamore, Ferox Enclave or Darkmeyer. There is no current one. The versioned
`2026-07-29_a` paths and `chisel.weirdgloop.org` all 404, and rebuilding
placements from the wiki API is not viable either, since Category:Altars and
Category:Fishing spots are empty and `Herb patch` has no `{{Map}}` template.
**Do not go looking for a fresher source. That lead is dead.**

Scanning works because the sprites are composited into the tiles **pixel exact**.
The first test done was a straight template match of the bank sprite against the
z3 tile covering Varrock west bank: 177 of 177 opaque pixels, a 100% match.

The scan finds 3114 icons where the published list has 1792, Varlamore included,
in about 90 seconds over 6392 tiles.

### It matches the frame, not the glyph

This is the part that matters, and it took a wrong turn to find.

Glyph matching can only ever find icons it already has a picture of, and the
sprite catalogue is from 2019 too. Sailing content has icons that exist on the map
and in no published catalogue at all, so they were invisible: detected as nothing,
drawn as nothing, and left sitting on the map at baked size while everything
around them scaled. That is what an unscaled anchor on Brittle Isle turned out to
be.

Two probes for a newer sprite catalogue both dead ended. Ids 1752-1764, 1802,
1908-1915, 1980-1994 and 2074-2084 do exist beyond `MainIcons.json`, but every one
is 40x40 with five or six colours, which makes them the separate map icon orbs
family that is never composited into a tile. **There is no published 15x15 sprite
for the newer icons.**

What saves it: **every map icon sits in the same circular frame, and 38 of those
frame pixels are byte identical across all 119 known sprites.** So the scan finds
icons by frame and only then asks what is inside:

1. Match the 38 pixel frame. Its colour is `0,0,1`, which occurs about 47 times
   per tile, so it indexes cheaply and precisely.
2. Classify the interior against known sprites.
3. If nothing scores over `THRESHOLD`, it is an unlisted type: **lift the glyph
   straight off the map**, masked to the shared disc so no terrain comes with it,
   write it out as a sprite and treat it as a known type from then on.

That last step is why unlisted icons render properly rather than as placeholders.
It currently recovers 160 types across 387 placements that no catalogue contains.
Those types are keyed by content hash and can fragment slightly, since a glyph
sampled over different terrain may hash differently. Harmless: each fragment
carries its own correct artwork.

### The four numbers that make it work

Calibrated against the published 2019 list, scoring only the pre-2019 core
(Varrock, Falador, Lumbridge, Barbarian Village) where that list is trustworthy.
`CALIBRATE=1 node scripts/fetch-icons.mjs` reruns this.

- **`FRAME_MATCH = 0.80`.** How much of the 38 pixel frame must match. This is the
  recall lever now. At 0.95 and 0.85 recall sits at 95.1%; at 0.80 it is **96.1%**.
  Partially occluded frames are why.
- **`THRESHOLD = 0.75`.** Classification only, not detection. Below it an icon is
  treated as an unlisted type and extracted rather than discarded, so getting this
  slightly wrong costs a name, not a placement.
- **`TOL = 16`.** Per channel. 6 is too tight for sprites blended over terrain,
  and past 32 it starts inventing.
- **`PAD = 8`.** Neighbouring tiles are composited into a padded canvas so an icon
  straddling a tile seam is still matched whole. The bug that motivated this was
  real: chasing one icon led to the wrong tile entirely because it sat on a seam.

At those values: **96.1% recall**, and the 9.8% of detections the 2019 list does
not know about all score 80% or better on pixel match, so they are seven years of
real map changes rather than noise.

### The baked icons are erased, not covered

An overlay drawn on top of the wiki's baked icons can never be smaller than them,
or the baked one pokes out around it. Two ways of hiding that were tried and both
failed:

- **Flooring the overlay scale at the baked size** silently undoes the feature.
  Wherever the floor binds, the icon is pinned to exactly the baked size and so
  scales exactly like the unscaled icons did. It binds at full zoom, which is
  where anyone actually looks.
- **Making the overlay always bigger** works until someone picks a small size,
  which they will, and then the baked icon reappears around it.

So `scripts/clean-tiles.mjs` removes them instead. It reads the placements, finds
each baked icon in the tiles **at all four zoom levels**, and paints it out by
pulling terrain radially inward from just outside the icon's disc. Output goes to
`public/tiles-clean/`, which is what `tileUrl()` serves. **`public/tiles/` is
never modified**, so the originals stay available to cross-reference against if
someone reports a missing icon.

Run order matters: `fetch-tiles` then `fetch-icons` then `clean-tiles`, because
each needs the previous one's output.

**Measured: 9673 of 12456 erased**, that being 3114 icons across 4 levels. The
2783 misses are expected to be concentrated at z0 to z2, where the world is
squeezed into far fewer pixels so icons overlap each other and the frame is
occluded. That is a hypothesis, not a measurement, and it means some baked icons
survive at low zoom.

**Trap that cost real time:** derive the shared frame from the **catalogued
sprites only**. The extracted `unlisted-*.png` sprites are lifted off the map and
have real terrain in them, so including them means no pixel is common to all
sprites, the frame comes out empty, nothing matches, and the script cheerfully
reports success having erased zero icons.

### Other constraints

- **Every icon is drawn at every zoom.** There is no visibility gating and there
  should not be. Two attempts at thinning were both rejected in use:
  - *Screen-space collision*, where an icon was dropped if a cell was already
    taken. The winner of a cell depended on iteration order, so which icon won
    changed as you panned. Icons popped in and out and fought over z-order.
  - *Precomputed importance tiers*, shown by zoom. Stable, and still wrong to use:
    icons appearing as you zoom in reads as inconsistency, not as decluttering,
    because you cannot tell whether an icon is absent or merely not yet earned.

  `fetch-icons.mjs` still writes a tier per icon from its `TIER` table, and the
  viewer ignores it. It is left in the data because it costs nothing and is the
  obvious raw material if thinning is ever wanted, but **anything that hides an
  icon at some zooms and not others needs a real reason.**
- Icons render to a **canvas**, not DOM. Leaflet's own guidance is that marker
  counts into the thousands cause slow rendering and panning, and there are 3114
  here. The canvas sits between the tile layer and the overlay layer, which is why
  there are two `.wmlayer` elements getting the same transform: labels and pins
  stay as DOM above it so they remain clickable.
- Icons on upper floors are not a problem here the way they were with the
  published list, because the scan only ever sees the ground level tiles.
- `pngjs` is a devDependency for the scripts alone. It never reaches the browser.

## Labels

The wiki tiles contain **no text at any zoom.** Checked on a full z0 tile covering
256 game squares: not one word. The wiki map identifies places by icon and hover,
never by label. Any older flat map with names baked in was an in-game world map
export, a different artifact entirely.

So `scripts/fetch-labels.mjs` builds them from the wiki's location articles. Every
one carries `{{Map|...|x=NNNN|y=NNNN}}` in its infobox, which is the coordinate
the wiki centres that location's map on. There are 1178 pages in
`Category:Locations`, 507 of which have usable surface coordinates.

Labels are **live text rather than baked pixels**, so they stay crisp at every
zoom and thin out as you zoom away. Four tiers by rank: 20 names at world view,
then 80, then 220, then all 507 zoomed in.

**Ranking is by type first, article length only as a tiebreaker. Do not
"simplify" this to sort by length.** The longest article in the set is Castle
Wars, a minigame, at 51k characters, more than double Varrock's. Sorting by length
puts a minigame above every capital city. 148 locations also have no `type` at all
and Brimhaven is filed as `maplink`, so type alone is not enough either. Both
signals are needed.

## The Market tab

**Full write-up in [docs/market.md](docs/market.md).** Read that before touching
`src/market/`. What follows is the short version.

Two views behind a persisted toggle. **Basic** fills your Grand Exchange offer
slots with a spend plan for the gp you actually have, and is the only thing on
screen. **Advanced** is the full table with every column and filter.

Data is the wiki's real-time prices API at `prices.runescape.wiki/api/v2/osrs`,
which is free, needs no key, and sends `Access-Control-Allow-Origin: *`. The
browser calls it directly, so this stays a static local page with no server and no
proxy. Endpoints used: `/mapping`, `/latest`, `/1h`, `/24h`, `/volumes`,
`/timeseries`.

**v2 `/timeseries` is not shaped like v1.** It takes `?id=&timestep=&lookback=`,
and `lookback` accepts only `6h`, `24h`, `7d`, `30d`, `6m` and `1y`. Every other
value 400s, including `1d`, `1w`, `1m`, `3m` and `max`. It also rejects requests
with no descriptive User-Agent, so a bare `curl` check of that one endpoint needs
a browser User-Agent set explicitly. The other five do not enforce it.

**The tax is 2%, not 1%.** It changed on 29 May 2025 in the Yama CAs update. Many
third party flip sites still use 1%, which overstates every margin and overstates
it worst on expensive items. The rules, all implemented in `geTax()`:

- 2%, **rounded down**, so anything under 50 gp is untaxed by arithmetic rather
  than by rule.
- Capped at 5,000,000, which is reached at a 250m sale price.
- 48 exempt item IDs in `EXEMPT_IDS`. Mostly cheap early-game things where the tax
  would round to nothing anyway, **but Old school bond (13190) is in there and is
  worth millions**, so that one entry is the difference between right and
  confidently wrong. Every teleport tablet is on the list too.

**Volume and price age are gates, not decoration.** A margin on an item that
trades twice a day is fiction: it will never fill. Staleness is judged on the
*older* of the two sides, because a fresh buy price against a six hour old sell
price still describes a spread that no longer exists.

**`high` and `low` are two separate trades at two separate moments.** On a
volatile item the price drifts between them and manufactures a margin that was
never there. This is why the `outlier` gate exists, checking both prints against
what actually traded in the last hour. It was added after the allocator
recommended 1.1b into a phantom 9.8% bond margin that neither the staleness gate
nor the spread gate caught. Do not remove it. The reasoning is in
[docs/market.md](docs/market.md).

**Buying more of a flow-bound item does not raise your hourly rate.** Doubling the
quantity doubles both the profit and the time, so the rate is unchanged and the
only effect is tying up gp another slot could have used. Quantity is therefore
sized to the user's check-in interval, not to their bank.

## External facts that rot silently

This app hardcodes facts that live on someone else's server. When they change,
**nothing goes red.** The build stays green and the app starts producing wrong
numbers, which is the failure mode that actually matters here. Worth re-checking
whenever a number looks off:

| Fact | Where | How to check |
|---|---|---|
| GE tax rate, cap, exemptions | `src/market/tax.ts` | The wiki `Grand_Exchange` page, Tax section |
| Map tile version | `scripts/fetch-tiles.mjs` `VERSION` | The curl above |
| Prices API shape | `src/market/api.ts` | `curl -s https://prices.runescape.wiki/api/v2/osrs/latest` |
| Tile max native zoom | `src/worldmap.ts` `NATIVE_Z` | z4 should still 404 |

## Architecture

| File | Role |
| --- | --- |
| `src/main.ts` | Tabs, the 1 second tick, ready-transition detection |
| `src/tasks.ts` | Task definitions. Edit here to change timers or add tasks |
| `src/store.ts` | Persistence plus readiness maths (daily boundary, cooldowns) |
| `src/notify.ts` | Desktop notifications, fire-once-per-cycle logic |
| `src/ui.ts` | Dailies rendering |
| `src/routes.ts` | Route definitions. Each stop carries real world coordinates |
| `src/routeview.ts` | Route tab: next-stop card, map, stop list |
| `src/mapview.ts` | Map tab: the standalone map, no route on it |
| `src/worldmap.ts` | Exact world/pixel transform, tile geometry, markers |
| `src/map/` | The reusable map component. See `docs/map.md` |
| `src/runstate.ts` | Progress through a single run |
| `src/market/tax.ts` | GE tax rate, cap and the 48 exempt IDs. Pure |
| `src/market/api.ts` | Prices API client, six endpoints, TTL caching. Pure |
| `src/market/flip.ts` | Candidates, gates, position sizing, the rate model. Pure |
| `src/market/allocate.ts` | GE slot allocator, three strategies, best wins. Pure |
| `src/market/fmt.ts` | gp, count, age and duration formatting. Pure |
| `src/market/settings.ts` | Market settings, defaults, persistence, the `:ge:v1` migration |
| `src/market/view.ts` | Market tab shell: mode toggle, gates panel, refresh timer |
| `src/market/basic.ts` | Basic view: the slot plan |
| `src/market/advanced.ts` | Advanced view: table, column picker, row expand |
| `src/fightview.ts` | Fight tab: owns the rAF loop and its teardown |
| `src/fight/engine/` | The tick sim. `sim.ts` is `step(state, inputs)`, pure |
| `src/fight/` | Renderer, input, guide and loadout panels |
| `scripts/fetch-tiles.mjs` | Pulls the tile pyramid. Resumable |
| `scripts/fetch-labels.mjs` | Builds `public/labels.json` from the wiki API |
| `scripts/fetch-icons.mjs` | Scans the tiles for icon sprites, builds `public/mapicons.json` |
| `scripts/clean-tiles.mjs` | Erases the baked icons into `public/tiles-clean/`, leaves originals |

localStorage keys: `osrs-companion:v1` (tasks), `:run:v1`, `:markers:v1`,
`:labels:v1` (label toggle), `:mapicons:v1` (icon toggle), `:mapsize:v1` (the
three size sliders), `:maptips:v1` (hover tooltips), `:mapsearchpin:v1` (search
pinned out of the rail), `:mapiconfilter:v1` (hidden icon type keys),
`:market:v1` (market settings), `:market:cache:*` (endpoint caches, safe to
delete), `:tab`.

Every map preference is global rather than per map instance, deliberately. Turning
labels off should turn them off everywhere. Only pan, zoom, the open pane and the
search query are per instance, and those live in memory rather than localStorage.

`:calib:v1` and `:map:v1` are **dead keys** from the old flat-map era. Nothing
reads them. Harmless if present in an old browser profile. `:ge:v1` is read once
to carry a pre-existing bank and freshness setting into `:market:v1`, then ignored.

The `:tab` value `"flips"` is migrated to `"market"` on load.

## Gotchas that will bite you

- **`tsconfig.json` must keep `"noEmit": true`.** The build is `tsc && vite build`.
  Without it, tsc emits `.js` next to the `.ts` sources and Vite resolves imports
  to the stale copies. The symptom is a baffling "does not provide an export named
  X" for an export you can plainly see. If it happens: delete stray `.js` under
  `src/`, clear `node_modules/.vite`, restart.
- **Never gate per-render work on module-level state.** A bug existed where the
  fit flag was module-wide but `apply()` was a per-render closure, so the first pin
  click left the map with no transform at all. Every freshly built layer must get
  `apply()` called on it.
- **`requestAnimationFrame` does not fire when the page is not compositing**
  (hidden window, background tab). The viewer uses `ResizeObserver` plus a
  `setTimeout` retry instead. `ResizeObserver` delivery is also part of the
  rendering lifecycle, so the timer fallback is the one that always works. Do not
  "simplify" this back to rAF.
- **Do not put `will-change: transform` on `.wmlayer`.** It promotes the layer to
  its own compositing layer, so the map is rasterised once and then GPU-stretched
  on zoom, which looks blurry. This was the original "why does the map look bad"
  bug.
- **Keep the outgoing tile level alive until the incoming one has loaded.**
  `purgeStale()` exists so a zoom step does not flash through empty background.
- **`image-rendering` is set per tile level, not globally.** Nearest neighbour is
  only right past native resolution. Below it you want the averaging, or
  downscaled tiles crawl with aliasing as you pan.
- **Wiki titles carry disambiguators that mean nothing on a map**, so
  `cleanName()` strips the trailing `(location)`, `(island)`, `(area)`,
  `(region)` and `(surface)` before a name is drawn.
- **A missing `labels.json` is survivable and must stay that way.** The fetch
  failing leaves the array empty and the map still works, just without names. Do
  not make it throw.
- **Right drag pans and can never pick.** Only button 0 picks, and only when the
  pointer did not move past a 3 px threshold. This exists so the map can be
  repositioned during add-marker mode without dropping a marker by accident.
- **Tabs that own a loop must be stopped in `draw()`.** `main.ts` calls
  `fightview.stop()` and `market.stop()` before wiping the DOM. Skip that and the
  fight's rAF loop keeps drawing into a detached canvas forever, and the market
  keeps polling a view nobody is looking at. Any new tab that starts a loop needs
  the same treatment.
- **`InputBuffer` binds keydown to the window.** It has a `destroy()` for that
  reason. It also ignores keystrokes when a form field has focus, because otherwise
  typing "1" into a loadout box eats the digit and switches prayer.

## How to verify a change

### Visual work can be looked at, so look at it

The pure-module checks below cover the maths. They cover nothing about whether the
thing renders, and this project has repeatedly shipped UI that typechecked, built,
and had never once been seen. It is worth being blunt about why: the assumption was
that no browser was available. That assumption was wrong.

Playwright drives the dev server against your installed Chrome, with no browser
download, and it takes about a minute to set up:

```bash
mkdir shots && cd shots && npm init -y
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright
```

```js
const { chromium } = require("playwright");
const browser = await chromium.launch({ channel: "chrome" });   // no download
const page = await (await browser.newContext({
  viewport: { width: 1440, height: 1100 },
})).newPage();

await page.goto("http://localhost:5273/", { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.setItem("osrs-companion:tab", "map"));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);                 // tiles and labels are fetched

await page.locator(".wmstage").screenshot({ path: "map.png" });
```

`channel: "chrome"` is the whole trick. Without it Playwright wants its own browser
bundle. Screenshot the `.wmstage` element rather than the page, since the map is
usually taller than the viewport.

It drives as well as it looks. Clicking real controls and reading back the DOM is
how the map overlay was checked:

```js
await page.locator(".wmrail .wmbtn").first().click();
await page.evaluate(() => [...document.querySelectorAll(".wmpanebody")]
  .map((p) => ({ title: p.querySelector("h3").textContent, hidden: p.hidden })));

await page.locator(".wmsearchdock input").fill("varrock");
await page.evaluate(() => document.querySelectorAll(".wmlabel.hit").length);   // 8

await page.mouse.move(x, y);
await page.evaluate(() => document.querySelector(".wmtip").textContent);
```

**Read the numbers back, do not just look at the picture.** The bug that made every
overlay pane render stacked on top of each other was visible in a screenshot, but
what proved it was `p.hidden === true` on an element whose height was not zero:
`.wmpanebody` sets `display: flex`, and an author `display` rule beats the `hidden`
attribute's `display: none` from the UA stylesheet. Any element you hide with
`.hidden = true` needs `[hidden] { display: none !important; }` if its class sets a
display.

### The pure-module checks

There is no test suite. What works is importing the pure modules and asserting on
their maths, which covers the parts where being wrong actually costs something.
Run the ones touching what you changed:

**The `?t=` cache-buster below is a trap for anything that reads module state.**
`import('/src/map/data.ts?t=1')` is a *different module instance* from
`/src/map/data.ts`, with its own empty caches. Worse, Vite's HMR appends its own
timestamp to internal imports after an edit, so a module you imported by plain path
may not be the one your other imports are talking to. Priming one and reading the
other reports zero results over data that loaded perfectly.

It is harmless for pure functions like `worldToPx` and `geTax`, which is why it went
unnoticed. For `src/map/data.ts` and anything else with a module-level cache, ask the
dev server which URL is really in the graph:

```js
const src = await (await fetch('/src/map/search.ts')).text();
const dataUrl = src.match(/from\s+"([^"]*\/data\.ts[^"]*)"/)[1];
const d = await import(dataUrl);        // "/src/map/data.ts?t=1785863280286"
await new Promise((r) => d.ensureLabels(r));
```

```js
// the map transform is exact arithmetic, so it is directly checkable
const m = await import('/src/worldmap.ts?t=' + Date.now());
m.worldToPx(3222, 3218);        // { x: 25776, y: 9072 }  Lumbridge

// GE tax boundaries. Every one of these has bitten a paid competitor
const g = await import('/src/market/tax.ts?t=' + Date.now());
g.geTax(49, 99999);             // 0        rounds down
g.geTax(50, 99999);             // 1
g.geTax(250e6, 99999);          // 5000000  the cap, reached exactly here
g.geTax(1e9, 99999);            // 5000000  capped
g.geTax(8e6, 13190);            // 0        bond is exempt
g.geTax(3e6, 8007);             // 0        Varrock teleport tab is exempt

// readiness maths
const s = await import('/src/store.ts?t=' + Date.now());
s.isReady(def, { lastDone: now - 49*60000, enabled: true }, now);  // false
s.isReady(def, { lastDone: now - 51*60000, enabled: true }, now);  // true

// the fight sim is pure and seeded, so it drives headlessly
const { createJadScenario } = await import('/src/fight/scenarios/jad.ts');
const { step } = await import('/src/fight/engine/sim.ts');
let st = createJadScenario(undefined, 2);
st = step(st, [{ click: { x: 2, y: 16 } }]);   // then assert on st.player.pos
```

One trap when testing the sim: a tile "inside" Jad's 5x5 footprint counts as
clicking Jad, not the ground. An early movement test failed for that reason when
the code was fine.

The market filters were each verified against live data to move the result set the
expected direction: 482 items pass at defaults, 913 with no volume floor, 229 at
2000 volume, 253 at a 5 minute freshness limit, 93 at 20% ROI, 123 free-to-play
only.

For UI, click real elements and read the result back:

```js
document.querySelector('.wmpin').click();
document.querySelector('.body h2').textContent;   // "Herb run · 1/10"
```

**Built is not seen.** `tsc --noEmit` passing and the thing rendering correctly are
different claims. Say which one you actually checked, especially in a PR
description. Anything visual that was not looked at should be described as
unverified rather than working.
