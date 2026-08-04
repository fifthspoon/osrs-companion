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

### Cleaned tiles

`scripts/clean-tiles.mjs` writes `public/tiles-clean/`, a copy of your downloaded
tiles with the wiki's baked-in map icons painted out so the app can draw its own
at any size. It is gitignored like everything else here.

It is derived from tiles that were already yours, by a script in this repository,
and `public/tiles/` is never modified. Nothing new is downloaded and nothing extra
is redistributed. The originals stay on disk so a report of a missing icon can be
checked against what the wiki actually rendered.

### Live item prices

Requested by `src/market/api.ts` from `prices.runescape.wiki/api/v2/osrs`,
directly from your browser, at the moment you open the Market tab.

Nothing is written to disk and nothing is committed. The responses are cached in
your own browser's localStorage for a minute at a time so the tab does not
re-request on every render. Prices are facts about a live market, and the wiki
publishes this endpoint openly with `Access-Control-Allow-Origin: *` precisely so
that third party tools can call it.

### Your character's levels

Requested by `src/player.ts` from `api.wiseoldman.net/v2`, directly from your
browser, only when you press **Sync character** and only for the name you typed.

[WiseOldMan](https://wiseoldman.net) is a free, open source OSRS tracker that
reads the official Jagex hiscores and exposes them over a public API. The app
uses it because the official hiscores endpoint sends no CORS header at all and so
cannot be called from a browser without a server in the middle, which this
project deliberately does not have.

Two things about this are worth stating plainly:

- **It is your own public hiscores data.** Levels, experience and rank are
  already public for every account, and nothing is sent anywhere except the name
  you typed, to WiseOldMan, to look it up.
- **It is stored only in your browser**, under the localStorage key
  `osrs-companion:players:v1`. Nothing about your account enters this repository,
  and no name is hardcoded anywhere in it.

Characters entered by hand never touch the network at all.

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
| Prices and hiscores you request | Live facts, requested by your browser, never stored in the repository |

Note that **CC BY-NC-SA is not an open source licence**: the NonCommercial
clause is incompatible with the OSI definition. Keeping wiki-derived data out of
the repository is what lets the code here carry a real open source licence
without the two conflicting.
