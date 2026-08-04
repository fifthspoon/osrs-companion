# Attribution and third party content

Short version: **this repository contains no third party content.** Everything
here is original code. The wiki data the app uses is downloaded by you, at
setup, into your own local copy.

That is deliberate, and it is why the setup has a fetch step.

## What the app uses, and where it comes from

### Map tiles

Fetched by `scripts/fetch-tiles.mjs` from `maps.runescape.wiki` into
`public/tiles/`, which is gitignored.

These are rendered by [Weird Gloop](https://weirdgloop.org) from Old School
RuneScape game data. The underlying map artwork is Jagex's. The OSRS Wiki
carries the notice:

> RuneScape and RuneScape Old School are the trademarks of Jagex Limited and are
> used with the permission of Jagex.

That permission runs from Jagex to Weird Gloop. It is not transitive, so these
tiles are **not redistributed here**. Running the fetch script makes your own
local copy for your own use, the same as opening the map in a browser.

### Location names and coordinates

Built by `scripts/fetch-labels.mjs` from the OSRS Wiki API into
`public/labels.json`, which is gitignored.

OSRS Wiki content is licensed
**[CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/)**.
Coordinates are facts rather than creative expression, but a compilation of them
is a greyer question than it is worth arguing, so this is not redistributed
either. The script rebuilds it in about thirty seconds.

If you do redistribute a built `labels.json`, CC BY-NC-SA 3.0 travels with it:
attribute the OSRS Wiki, share alike, non-commercial only.

### Map icons

Fetched by `scripts/fetch-icons.mjs` from `maps.runescape.wiki` into
`public/mapicons/` and `public/mapicons.json`, both of which are gitignored.

Only one thing is downloaded: the icon images. They are Jagex artwork rendered by
Weird Gloop, exactly like the map tiles, so **the same non-transitive permission
applies and they are not redistributed here.** Running the fetch makes your own
local copy for your own use. About 25 KB in total.

The placements are not downloaded at all. The script finds them by scanning the
tiles already on your disk for those sprites, so the coordinate list is derived
locally from your own copy rather than taken from anywhere. It is also plain
factual data: where a thing is, which is not creative expression. It stays
gitignored regardless, on the same reasoning as everything else here.

### Fight Caves simulation

`src/fight/` is an original reimplementation. Every mechanic in it came from
reading public documented facts on the OSRS Wiki (Fight_Caves,
Fight_Caves/Strategies, Inferno, and individual monster pages) and writing code
from scratch.

**No game assets, no decompiled code, and nothing from private server
repositories.** The graphics are shapes drawn on a canvas. If you extend this,
hold that line.

## Terms of service

The app never reads, hooks, injects into, or communicates with the game client
or Jagex servers. You press buttons, it owns timers and routes. There is no
automation surface, which is the actual thing that matters, and it is why this
stays clearly above board.

## Licensing summary

| Thing | Licence |
| --- | --- |
| Code in this repository | AGPL-3.0, see `LICENSE` |
| Map tiles you fetch | Jagex artwork via Weird Gloop, local use only, not redistributable |
| Map icon images you fetch | Same as the tiles: Jagex artwork via Weird Gloop, not redistributable |
| Wiki-derived data you fetch | CC BY-NC-SA 3.0 |

Note that **CC BY-NC-SA is not an open source licence**: the NonCommercial
clause is incompatible with the OSI definition. Keeping wiki-derived data out of
the repository is what lets the code here carry a real open source licence
without the two conflicting.
