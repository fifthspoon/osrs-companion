// Builds the map label set.
//
// The wiki's map tiles carry no text at any zoom, so place names have to come
// from somewhere else. They come from the location articles: every one carries
// an infobox with {{Map|...|x=NNNN|y=NNNN}}, which is the coordinate the wiki
// centres that location's map on. Good enough to anchor a label, and it is real
// data rather than someone eyeballing a picture.
//
// Rendering these as live text instead of baked pixels is strictly better than
// what the old flat map had: crisp at every zoom, and they can be thinned out
// as you zoom away so the map does not turn into a wall of names.
//
// `type` and `len` are carried through so the app can decide what to show at
// what zoom without this ever needing to be re-fetched.

import { writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://oldschool.runescape.wiki/api.php";
const UA = "osrs-companion/0.1 (personal local tool)";

// Matches the tiles pulled by fetch-tiles.mjs. Anything outside is a dungeon or
// an instanced area sitting off in far coordinate space, with no surface tile.
const BOUNDS = { minX: 1024, minY: 2048, maxX: 4096, maxY: 4224 };

async function api(params) {
  const u = new URL(API);
  for (const [k, v] of Object.entries({ format: "json", ...params })) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`${r.status} on ${u}`);
  return r.json();
}

// Every page in Category:Locations, main namespace only.
const titles = [];
let cont = null;
do {
  const j = await api({
    action: "query",
    list: "categorymembers",
    cmtitle: "Category:Locations",
    cmlimit: "500",
    cmnamespace: "0",
    ...(cont ? { cmcontinue: cont } : {}),
  });
  titles.push(...j.query.categorymembers.map((m) => m.title));
  cont = j.continue?.cmcontinue ?? null;
} while (cont);

console.log(`${titles.length} location pages`);

const out = [];
let noMap = 0;
let offMap = 0;

for (let i = 0; i < titles.length; i += 50) {
  const batch = titles.slice(i, i + 50);
  const j = await api({
    action: "query",
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    titles: batch.join("|"),
  });

  for (const p of Object.values(j.query.pages)) {
    const text = p.revisions?.[0]?.slots?.main?.["*"];
    if (!text) continue;

    // First {{Map ...}} in the article. Pull x and y out of its parameters
    // rather than the whole page, so a stray "x=" elsewhere cannot match.
    const m = text.match(/\{\{Map\b([^}]*)\}\}/i);
    if (!m) {
      noMap++;
      continue;
    }
    const wx = Number(m[1].match(/\bx\s*=\s*(\d+)/i)?.[1]);
    const wy = Number(m[1].match(/\by\s*=\s*(\d+)/i)?.[1]);
    if (!Number.isFinite(wx) || !Number.isFinite(wy)) {
      noMap++;
      continue;
    }
    if (wx < BOUNDS.minX || wx > BOUNDS.maxX || wy < BOUNDS.minY || wy > BOUNDS.maxY) {
      offMap++;
      continue;
    }

    out.push({
      name: p.title,
      wx,
      wy,
      type: (text.match(/\|\s*type\s*=\s*([^\n|}]+)/i)?.[1] ?? "").trim().toLowerCase(),
      len: text.length,
    });
  }
  process.stdout.write(`\r  ${Math.min(i + 50, titles.length)}/${titles.length}`);
}

// Biggest articles first, so the app can just take the first N for a zoom level.
out.sort((a, b) => b.len - a.len);

await writeFile(join(ROOT, "public", "labels.json"), JSON.stringify(out));

const types = {};
for (const o of out) types[o.type || "(none)"] = (types[o.type || "(none)"] ?? 0) + 1;

console.log(`\n${out.length} labels written to public/labels.json`);
console.log(`skipped: ${noMap} with no usable {{Map}}, ${offMap} outside surface bounds`);
console.log("types:", Object.entries(types).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k}=${v}`).join(" "));
console.log("largest:", out.slice(0, 10).map((o) => o.name).join(", "));
