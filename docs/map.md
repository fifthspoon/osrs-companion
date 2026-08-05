# The map component

The source files under `src/map/` carry no comments. Everything that explains them is here.

`src/lib/worldmap.ts` is unchanged and stays where it is. It owns the exact world-to-pixel transform and
the tile geometry, it is pure, and it has no DOM in it. Read the map section of `CONTRIBUTING.md`
before touching that file. This document is only about the view layer that sits on top of it.

## What changed and why

The map used to be `src/worldmapview.ts`, a single `render(route, ctx, rerender)` that took a
`RouteDef`. Two things made it impossible to reuse:

1. **It only knew how to draw a route.** Pins came from `route.stops`, the dashed line came from
   `route.stops`, and the status text counted `route.stops`. Anything that was not a herb run had no
   way in.
2. **Every piece of view state was a module global.** `zoom`, `offX`, `offY`, `inited`, `minZoom` and
   the add-marker mode all lived at module scope. That was invisible while exactly one map existed in
   the app. The moment a second one exists, both instances write the same three variables and each
   one's `apply()` renders the other's pan position.

So the file is now `src/map/`, split four ways, and the route is just one caller.

| File | Owns |
| --- | --- |
| `src/components/map/map.ts` | `createMap(opts)`, the stage, tiles, pins, the icon canvas, labels, pan and zoom |
| `src/components/map/overlay.ts` | All chrome: the rail, the panes, search, zoom, the hint, the picking banner |
| `src/components/map/search.ts` | Matching a query against place names and icon type names. Pure |
| `src/data/mapData.ts` | Fetching and caching `labels.json` and `mapicons.json`, label ranking, icon type counts |
| `src/components/map/prefs.ts` | Every persisted preference |

## The component contract

```ts
createMap({
  id: "route:herb",
  onChange: rerender,
  pins,
  paths: [{ points: route.stops.map((s) => s.world) }],
  status: "Scroll to zoom, drag to pan.",
}): HTMLElement
```

It returns an element. It does not return a handle, on purpose: every view in this app rebuilds its
DOM on change rather than mutating it, so an imperative API would have no caller. Add one when
something actually needs to move the viewport from outside.

| Option | Meaning |
| --- | --- |
| `id` | **Required.** The key its pan and zoom are stored under. See below |
| `onChange` | The host's rerender. The map calls it when something it does not own has changed |
| `pins` | World-coordinate pins. Each carries a badge, a label, an optional class and an optional click |
| `paths` | Polylines in world coordinates. Default class is `wmroute`, the dashed green route line |
| `status` | The hint text on the left of the toolbar |
| `markers` | Show and manage the user's own saved markers. Default true |
| `addMarker` | Offer the add-marker button. Default true |

Anything positional is in **world coordinates**, never pixels. The component calls `worldToPx` itself.
A caller that does its own pixel maths is a caller that will be wrong the next time the transform is
touched, and the whole point of the tile scheme is that the transform is exact arithmetic nobody
should be reimplementing.

## Why `id` exists

Pan and zoom are keyed by `id` in a module-level map, not held in the closure:

```ts
const views = new Map<string, ViewState>();
```

This is deliberate and it is doing two jobs at once.

**It survives a rerender.** Clicking a stop calls the host's `rerender()`, which throws away the
whole section and builds a new map element. If view state lived in the closure, every click would
reset the map to the fitted world view, which is unusable. The old code got this right by accident,
because module globals happen to survive a rerender too.

**It isolates instances.** Two maps with different ids keep separate viewports. The route map is
`route:<routeId>`, so each route remembers where you left it, and the standalone Map tab is
`standalone`, so opening it does not drag the herb run map along with it.

Data and prefs are the opposite case and are deliberately still global. Labels and icons are fetched
once and shared by every instance, and the toggles and size sliders are user preferences, so turning
labels off should turn them off everywhere rather than per map.

## The loader fix that came with the split

`ensureLabels` and `ensureIcons` used to take an `onReady` callback and drop it on the floor if a
fetch was already in flight:

```ts
if (labelData.length || labelsLoading) return;
```

With one map ever created that was harmless, because there was never a second caller. With reusable
instances it is a real bug: a map created while the fetch is still running never gets its callback,
so it renders with no labels until some unrelated event triggers `apply()`. The loaders now queue
every waiter and drain the queue when the fetch settles, and call back immediately once loaded.

## The overlay

The controls used to be a `.wmbar` strip under the stage: eight buttons, three sliders and a status
line all on one row, wrapping onto two rows on a narrow window. It grew that way one control at a
time. Everything now lives on the map itself, in `src/components/map/overlay.ts`.

The shape is a four-button rail down the top left, and **one pane at a time** beside it. Opening a
pane closes whatever was open. That is the point of the design rather than an implementation detail:
it is a structural cap on clutter, so the next settings group is one more rail button and never a
taller panel. The panes are Search, Display, Icon types and Markers.

Zoom sits bottom right, the status hint bottom left, and both are out of the way of the rail.

`.wmoverlay` is `pointer-events: none` with `pointer-events: auto` on its children, so the map still
pans and zooms everywhere the chrome is not. Two handlers need to know about it explicitly, and both
are easy to lose in a later edit:

- **`wheel` returns early** when the event came from inside the overlay, without calling
  `preventDefault`. Otherwise scrolling the 119-row icon list zooms the map instead.
- **`pointerdown` returns early** the same way, or dragging a slider pans the map under it.

### Search, and why it is pinnable

Search is the one control you use mid-run, so **it is visible by default**, as a permanent field
above the pane, and the rail carries no search button while it is. Unpinning tucks it into the rail
with everything else, for anyone who wants the map as clear as possible.

That direction matters and it was wrong once. The default is visible and the pin takes it away, not
the other way round. Everything else on this map defaults to on, and search is the control most worth
reaching for, so making it the one thing you have to go and find was backwards.

Pinned is a persisted preference in `osrs-companion:mapsearchpin:v1`, and like every other map
preference it is global rather than per instance.

A query does three things at once: matching places highlight and are **forced visible regardless of
their zoom tier**, so searching Rellekka from the world view actually shows it; matching icons keep
full alpha and get a ring; everything else drops to low alpha. Clearing the box restores normal
drawing.

Typing does **not** call the host's rerender. It updates the query in the view state, recomputes the
result and repaints the canvas and labels in place. If it rerendered, the input would lose focus on
every keystroke.

### The icon filter, and the category field that does not work

`mapicons.json` has a `category` per type and it is useless for grouping: 279 types across exactly
two values, `others` (119) and `unlisted` (160). There is nothing to group on, so the pane is a
searchable flat list instead.

It shows the **119 named types sorted by placement count**, which covers 2727 of 3114 icons, 87.6%.
The 160 unlisted types are one collapsed row worth 387 icons between them, roughly 2.4 each, and they
have no name to search by. Hidden types are stored as a key list in
`osrs-companion:mapiconfilter:v1` and skipped in both `drawIcons` and the tooltip hit test, so a
hidden type cannot be hovered either.

If you want real grouping, that is a change to `scripts/fetch-icons.mjs` to write a better category
per type. It is not a UI change and no amount of work in this file will produce it.

### Tooltips cover icons only

Hover tooltips name the icon under the cursor. They deliberately do not cover labels or pins: a label
is already its own name on screen and a pin already shows one, so a tooltip there would be repeating
what you can read.

Icons are canvas, not DOM, so there is nothing to hover. The hit test walks the same visible-icon list
`drawIcons` builds and takes the **last** match, which is the one drawn on top. It respects the filter
and the icons toggle, so anything you cannot see cannot be hovered.

## Never give the stage a height of its own

`.wmstage` carries `aspect-ratio: 24576 / 17408`. That is not a taste decision and it is not a round
number someone liked. It is `WORLD_BOUNDS` exactly: 3072 by 2176 game squares at 8 pixels each. The
frame is built to be the same shape as the map so that the fitted view fills it edge to edge.

**So any frame with a different ratio letterboxes.** `fit()` picks
`min(width / mapWidth, height / mapHeight)`, so the axis that does not match leaves bare background
down one pair of sides, and it is uneven because the map is not centred in a frame it was never
sized for. This was fixed once already in `ee160c8` and then reintroduced by a `fill` mode that set
`aspect-ratio: auto` and a viewport-derived height in order to make the standalone tab taller.

Every context gets the same framing. If a map needs to be bigger, give its **container** more width
and let the aspect ratio derive the height. Do not set a height on the stage, and do not add a mode
that does.

## The standalone Map tab

`src/components/map/mapTab.ts` is the whole thing: `createMap` with an id and a status line and nothing else, which
is the proof that the component API is actually general. A second context cost fifteen lines and no
new options.

## What this refactor deliberately did not change

The rendering internals were moved, not rewritten. The tile pyramid handling, `purgeStale`, the
`ResizeObserver` plus `setTimeout` fit, the constant-size overlay maths, the icon canvas and the
label tiering are the same code in a new file. Every one of those has a paragraph in `CONTRIBUTING.md`
explaining what breaks if you simplify it. Read that before changing any of them.
