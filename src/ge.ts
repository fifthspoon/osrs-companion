// Grand Exchange flip finder.
//
// Data comes from the wiki's real-time prices API, which is free, public, and
// sends Access-Control-Allow-Origin: *, so the browser calls it directly and
// this stays a static local page with no server.
//
// The whole value here is being CORRECT about two things that paid flip sites
// routinely get wrong:
//
// 1. The tax is 2%, not 1%. It changed on 29 May 2025. A tool still using 1%
//    overstates every margin, and overstates it most on exactly the expensive
//    items people act on.
// 2. A margin on an item that trades twice a day is fiction. Volume and price
//    age are filters, not decoration. An item showing a 2M margin that last
//    traded six hours ago will not fill.

const API = "https://prices.runescape.wiki/api/v2/osrs";

export interface ItemInfo {
  id: number;
  name: string;
  limit?: number;
  members: boolean;
  value: number;
}

export interface LatestPrice {
  high: number | null;
  highTime: number | null;
  low: number | null;
  lowTime: number | null;
}

export interface HourAvg {
  avgHighPrice: number | null;
  highPriceVolume: number;
  avgLowPrice: number | null;
  lowPriceVolume: number;
}

export interface Market {
  latest: Record<string, LatestPrice>;
  info: Map<number, ItemInfo>;
  hourly: Record<string, HourAvg>;
  fetchedAt: number;
}

export interface Flip {
  id: number;
  name: string;
  buy: number;          // what you pay, the instant-sell price
  sell: number;         // what you receive before tax, the instant-buy price
  tax: number;          // per item
  net: number;          // per item, after tax
  roi: number;          // net / buy
  limit: number;        // 4 hour buy limit
  qty: number;          // how many you can actually afford and are allowed
  profit: number;       // net * qty, the number that matters
  volume: number;       // units traded in the last hour, both directions
  ageSec: number;       // how stale the older of the two prices is
}

// Items the Grand Exchange does not tax. Sourced from the wiki's Grand Exchange
// article. Mostly cheap early-game things where the tax would round to nothing
// anyway, but Old school bond (13190) is in here and is worth millions, so
// getting this wrong on that one line is a real error.
const EXEMPT_IDS = new Set([
  13190, 882, 806, 884, 807, 558, 886, 808, 365, 2309, 1891, 2140, 2142, 347,
  379, 355, 2327, 351, 329, 315, 361, 28824, 3853, 2552, 1755, 5325, 1785,
  2347, 1733, 233, 5341, 8794, 5329, 5343, 1735, 952, 5331,
  8011, 8010, 8009, 28790, 8008, 8013, 8007,       // teleport tablets
  3014, 3012, 3010, 3008,                          // energy potions
]);

export const TAX_RATE = 0.02;
export const TAX_CAP = 5_000_000;

// 2% rounded DOWN, so anything under 50 gp is untaxed by arithmetic rather than
// by rule. Capped at 5M, which is reached at a 250M sale price.
export function geTax(sellPrice: number, id: number): number {
  if (EXEMPT_IDS.has(id)) return 0;
  return Math.min(TAX_CAP, Math.floor(sellPrice * TAX_RATE));
}

export async function fetchMarket(): Promise<Market> {
  // The wiki asks for a descriptive User-Agent, but browsers forbid setting it.
  // A real browser UA is not what their block list targets (it targets things
  // like bare python-requests and curl), and this is one page making three
  // cached requests a minute, well under anything they ask people to avoid.
  const get = async (path: string) => {
    const r = await fetch(`${API}${path}`);
    if (!r.ok) throw new Error(`${r.status} from ${path}`);
    return r.json();
  };

  const [latest, mapping, hourly] = await Promise.all([
    get("/latest"),
    get("/mapping"),
    get("/1h"),
  ]);

  const info = new Map<number, ItemInfo>();
  for (const i of mapping as ItemInfo[]) info.set(i.id, i);

  return { latest: latest.data, info, hourly: hourly.data ?? {}, fetchedAt: Date.now() };
}

export interface FlipOpts {
  capital: number;
  minVolume: number;   // units per hour, both directions
  maxAgeSec: number;   // reject prices older than this
  membersOk: boolean;
}

export function computeFlips(m: Market, o: FlipOpts): Flip[] {
  const nowSec = Math.floor(Date.now() / 1000);
  const out: Flip[] = [];

  for (const [key, p] of Object.entries(m.latest)) {
    if (!p.high || !p.low || !p.highTime || !p.lowTime) continue;

    const id = Number(key);
    const item = m.info.get(id);
    if (!item) continue;
    if (item.members && !o.membersOk) continue;

    // Stale prices are the main source of imaginary margins. Judge on the OLDER
    // of the two sides: a fresh buy price against a six hour old sell price
    // still describes a spread that no longer exists.
    const ageSec = nowSec - Math.min(p.highTime, p.lowTime);
    if (ageSec > o.maxAgeSec) continue;

    const h = m.hourly[key];
    const volume = h ? (h.highPriceVolume ?? 0) + (h.lowPriceVolume ?? 0) : 0;
    if (volume < o.minVolume) continue;

    const buy = p.low;
    const sell = p.high;
    const tax = geTax(sell, id);
    const net = sell - tax - buy;
    if (net <= 0) continue;

    // The 4 hour buy limit is the real ceiling on a flip, not your wallet.
    const limit = item.limit ?? 0;
    if (limit <= 0) continue;

    const affordable = Math.floor(o.capital / buy);
    const qty = Math.min(limit, affordable);
    if (qty <= 0) continue;

    out.push({
      id, name: item.name, buy, sell, tax, net,
      roi: net / buy,
      limit, qty,
      profit: net * qty,
      volume, ageSec,
    });
  }

  return out.sort((a, b) => b.profit - a.profit);
}

export function gp(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}b`;
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}m`;
  if (a >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

export function age(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h`;
}
