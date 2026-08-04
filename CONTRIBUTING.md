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

CI runs on every pull request: typecheck, build, a third party content gate over
both the tree and the full history, and an em dash check. It has to be green.
Everything it checks is described in this file.

Contributions are accepted under AGPL-3.0, the same licence as the rest of the
project. There is no CLA and you keep your copyright.

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

Data is the wiki's real-time prices API at `prices.runescape.wiki/api/v2/osrs`,
which is free, needs no key, and sends `Access-Control-Allow-Origin: *`. The
browser calls it directly, so this stays a static local page with no server and no
proxy. Endpoints used: `/latest`, `/mapping`, `/1h`.

The wiki asks for a descriptive User-Agent, which browsers forbid setting. Their
block list targets bare `python-requests` and `curl` rather than real browsers,
and this is one page making three cached requests a minute. If that ever becomes a
problem the fix is a fetch script like the other two, not a proxy.

**The tax is 2%, not 1%.** It changed on 29 May 2025 in the Yama CAs update. Many
third party flip sites still use 1%, which overstates every margin and overstates
it worst on expensive items. The rules, all implemented in `geTax()`:

- 2%, **rounded down**, so anything under 50 gp is untaxed by arithmetic rather
  than by rule.
- Capped at 5,000,000, which is reached at a 250m sale price.
- 48 exempt item IDs in `EXEMPT_IDS`. Mostly cheap early-game things where the tax
  would round to nothing anyway, **but Old school bond (13190) is in there and is
  worth millions**, so that one entry is the difference between right and
  confidently wrong.

**Volume and price age are filters, not decoration.** A margin on an item that
trades twice a day is fiction: it will never fill. Staleness is judged on the
*older* of the two sides, because a fresh buy price against a six hour old sell
price still describes a spread that no longer exists.

## External facts that rot silently

This app hardcodes facts that live on someone else's server. When they change,
**nothing goes red.** The build stays green and the app starts producing wrong
numbers, which is the failure mode that actually matters here. Worth re-checking
whenever a number looks off:

| Fact | Where | How to check |
|---|---|---|
| GE tax rate, cap, exemptions | `src/ge.ts` | The wiki `Grand_Exchange` page, Tax section |
| Map tile version | `scripts/fetch-tiles.mjs` `VERSION` | The curl above |
| Prices API shape | `src/ge.ts` | `curl -s https://prices.runescape.wiki/api/v2/osrs/latest` |
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
| `src/worldmap.ts` | Exact world/pixel transform, tile geometry, markers |
| `src/worldmapview.ts` | Tile viewer, pan/zoom, pins, labels, markers |
| `src/runstate.ts` | Progress through a single run |
| `src/ge.ts` | Prices API client, GE tax, flip maths. Pure, no DOM |
| `src/geview.ts` | Market tab: headline pick, table, filter panel |
| `src/fightview.ts` | Fight tab: owns the rAF loop and its teardown |
| `src/fight/engine/` | The tick sim. `sim.ts` is `step(state, inputs)`, pure |
| `src/fight/` | Renderer, input, guide and loadout panels |
| `scripts/fetch-tiles.mjs` | Pulls the tile pyramid. Resumable |
| `scripts/fetch-labels.mjs` | Builds `public/labels.json` from the wiki API |

localStorage keys: `osrs-companion:v1` (tasks), `:run:v1`, `:markers:v1`,
`:labels:v1` (label toggle), `:ge:v1` (market filters), `:tab`.

`:calib:v1` and `:map:v1` are **dead keys** from the old flat-map era. Nothing
reads them. Harmless if present in an old browser profile.

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
- **Right drag pans and can never pick.** Only button 0 picks, and only when the
  pointer did not move past a 3 px threshold. This exists so the map can be
  repositioned during add-marker mode without dropping a marker by accident.
- **Tabs that own a loop must be stopped in `draw()`.** `main.ts` calls
  `fightview.stop()` and `geview.stop()` before wiping the DOM. Skip that and the
  fight's rAF loop keeps drawing into a detached canvas forever, and the market
  keeps polling a view nobody is looking at. Any new tab that starts a loop needs
  the same treatment.
- **`InputBuffer` binds keydown to the window.** It has a `destroy()` for that
  reason. It also ignores keystrokes when a form field has focus, because otherwise
  typing "1" into a loadout box eats the digit and switches prayer.

## How to verify a change

There is no test suite. What works is importing the pure modules and asserting on
their maths, which covers the parts where being wrong actually costs something.
Run the ones touching what you changed:

```js
// the map transform is exact arithmetic, so it is directly checkable
const m = await import('/src/worldmap.ts?t=' + Date.now());
m.worldToPx(3222, 3218);        // { x: 25776, y: 9072 }  Lumbridge

// GE tax boundaries. Every one of these has bitten a paid competitor
const g = await import('/src/ge.ts?t=' + Date.now());
g.geTax(49, 99999);             // 0        rounds down
g.geTax(50, 99999);             // 1
g.geTax(250e6, 99999);          // 5000000  the cap, reached exactly here
g.geTax(1e9, 99999);            // 5000000  capped
g.geTax(8e6, 13190);            // 0        bond is exempt

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
