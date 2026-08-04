
import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "tiles");

const VERSION = "2026-07-29_a";
const HOST = `https://maps.runescape.wiki/osrs/versions/${VERSION}/tiles/rendered`;
const MAP_ID = 0;                    // surface
const PLANE = 0;                     // ground level

const BOUNDS = { minX: 960, minY: 2048, maxX: 4032, maxY: 4224 };

const ZOOMS = [0, 1, 2, 3];

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
