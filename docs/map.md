# The map component

The source files under `src/map/` carry no comments. Everything that explains them is here.

`src/worldmap.ts` is unchanged and stays where it is. It owns the exact world-to-pixel transform and
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
| `src/map/component.ts` | `createMap(opts)`, the stage, tiles, pins, the icon canvas, labels, pan and zoom |
| `src/map/controls.ts` | The toolbar under the stage |
| `src/map/data.ts` | Fetching and caching `labels.json` and `mapicons.json`, label ranking and tiering |
| `src/map/prefs.ts` | The persisted toggles and size sliders |

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

`src/mapview.ts` is the whole thing: `createMap` with an id and a status line and nothing else, which
is the proof that the component API is actually general. A second context cost fifteen lines and no
new options.

## What this refactor deliberately did not change

The rendering internals were moved, not rewritten. The tile pyramid handling, `purgeStale`, the
`ResizeObserver` plus `setTimeout` fit, the constant-size overlay maths, the icon canvas and the
label tiering are the same code in a new file. Every one of those has a paragraph in `CONTRIBUTING.md`
explaining what breaks if you simplify it. Read that before changing any of them.
