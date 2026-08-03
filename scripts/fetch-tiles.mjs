// Pulls the wiki's map tiles into public/tiles so the viewer can serve them
// locally instead of scaling one giant PNG.
//
// Scheme, confirmed empirically against the live server rather than from docs:
//   https://maps.runescape.wiki/osrs/versions/{VERSION}/tiles/rendered/{mapID}/{z}/{p}_{x}_{y}.png
//   tile x = floor(gameX / span), tile y = floor(gameY / span), span = 256 / 2^z
//
// Two traps worth knowing about, both cost time to find:
//
// 1. The wiki's own documentation publishes the format as "{p}_{x}_{-y}.png".
//    The {-y} is a Leaflet placeholder name, not a literal minus sign. Indices
//    are plain positives. Building the filename with a real "-" 404s every
//    single tile.
//
// 2. maps.runescape.wiki still serves an old app whose config points at
//    cacheVersion 2019-10-31_1. Those tiles are bare terrain and predate
//    Varlamore entirely. The live wiki uses the versioned path below instead,
//    which is current and has the map icons baked in. Check a page like
//    Civitas_illa_Fortis for the current VERSION string if tiles start 404ing.

import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "tiles");

const VERSION = "2026-07-29_a";
const HOST = `https://maps.runescape.wiki/osrs/versions/${VERSION}/tiles/rendered`;
const MAP_ID = 0;                    // surface
const PLANE = 0;                     // ground level

// Deliberately a little wider than the wiki's stated surface bounds so new
// areas are not clipped. Out of range just 404s, which costs 162 bytes.
const BOUNDS = { minX: 1024, minY: 2048, maxX: 4096, maxY: 4224 };

// z3 is maxNativeZoom: z4 and z5 404. Anything past it would be upscaled blur.
const ZOOMS = [0, 1, 2, 3];

// A plain fetch UA gets a 403 from this host.
const UA = "osrs-companion/0.1 (personal local tool; one-time tile pull)";
const CONCURRENCY = 6;

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function tilesFor(z) {
  const span = 256 / Math.pow(2, z);
  const out = [];
  for (let x = Math.floor(BOUNDS.minX / span); x <= Math.floor(BOUNDS.maxX / span); x++) {
    for (let y = Math.floor(BOUNDS.minY / span); y <= Math.floor(BOUNDS.maxY / span); y++) {
      out.push({ z, x, y });
    }
  }
  return out;
}

async function pull(t) {
  const dest = join(OUT, String(t.z), `${t.x}_${t.y}.png`);
  if (await exists(dest)) return "skip";

  const url = `${HOST}/${MAP_ID}/${t.z}/${PLANE}_${t.x}_${t.y}.png`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (res.status === 404) return "empty";
  if (!res.ok) throw new Error(`${res.status} on ${url}`);

  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  return "got";
}

const jobs = ZOOMS.flatMap(tilesFor);
console.log(`version ${VERSION}`);
console.log(`${jobs.length} candidate tiles across z${ZOOMS.join(",")}`);

const tally = { got: 0, empty: 0, skip: 0, fail: 0 };
let cursor = 0;

await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < jobs.length) {
      const t = jobs[cursor++];
      try {
        tally[await pull(t)]++;
      } catch (e) {
        tally.fail++;
        if (tally.fail < 6) console.warn(`  ${e.message}`);
      }
      const done = tally.got + tally.empty + tally.skip + tally.fail;
      if (done % 1000 === 0) {
        console.log(`  ${done}/${jobs.length}  got=${tally.got} empty=${tally.empty} fail=${tally.fail}`);
      }
    }
  }),
);

console.log(`\ndone: got=${tally.got} empty=${tally.empty} skip=${tally.skip} fail=${tally.fail}`);
console.log("tiles written under public/tiles/{z}/{x}_{y}.png");
