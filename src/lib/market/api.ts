const API = "https://prices.runescape.wiki/api/v2/osrs";
const CACHE_PREFIX = "osrs-companion:market:cache:";

const MAPPING_TTL = 86_400_000;
const DAY_TTL = 1_800_000;
const VOLUMES_TTL = 7_200_000;
const SERIES_TTL = 300_000;

export interface ItemInfo {
  id: number;
  name: string;
  limit?: number;
  members: boolean;
  value: number;
  highalch?: number;
  lowalch?: number;
  icon?: string;
}

export interface LatestPrice {
  high: number | null;
  highTime: number | null;
  low: number | null;
  lowTime: number | null;
}

export interface AvgPrice {
  avgHighPrice: number | null;
  highPriceVolume: number;
  avgLowPrice: number | null;
  lowPriceVolume: number;
}

export interface SeriesPoint {
  timestamp: number;
  avgHighPrice: number | null;
  avgLowPrice: number | null;
  highPriceVolume: number;
  lowPriceVolume: number;
}

export interface Market {
  info: Map<number, ItemInfo>;
  latest: Record<string, LatestPrice>;
  hour: Record<string, AvgPrice>;
  day: Record<string, AvgPrice>;
  dailyVolume: Record<string, number>;
  fetchedAt: number;
}

export type Lookback = "6h" | "24h" | "7d" | "30d" | "6m" | "1y";

export const LOOKBACKS: Lookback[] = ["6h", "24h", "7d", "30d", "6m", "1y"];

const TIMESTEP: Record<Lookback, string> = {
  "6h": "5m",
  "24h": "5m",
  "7d": "1h",
  "30d": "6h",
  "6m": "24h",
  "1y": "24h",
};

async function get(path: string): Promise<any> {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(`${r.status} from ${path}`);
  return r.json();
}

async function soft(path: string): Promise<any | null> {
  try {
    return await get(path);
  } catch {
    return null;
  }
}

function cacheRead<T>(key: string, ttl: number): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const held = JSON.parse(raw) as { at: number; data: T };
    if (Date.now() - held.at > ttl) return null;
    return held.data;
  } catch {
    return null;
  }
}

function cacheWrite(key: string, data: unknown): void {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), data }));
  } catch {
  }
}

export function clearCache(): void {
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(CACHE_PREFIX)) localStorage.removeItem(k);
    }
  } catch {
  }
  series.clear();
}

async function loadMapping(): Promise<ItemInfo[]> {
  const held = cacheRead<ItemInfo[]>("mapping", MAPPING_TTL);
  if (held) return held;
  const fresh = (await get("/mapping")) as ItemInfo[];
  cacheWrite("mapping", fresh);
  return fresh;
}

async function loadDay(): Promise<Record<string, AvgPrice>> {
  const held = cacheRead<Record<string, AvgPrice>>("day", DAY_TTL);
  if (held) return held;
  const fresh = await soft("/24h");
  const data = (fresh?.data ?? {}) as Record<string, AvgPrice>;
  if (fresh) cacheWrite("day", data);
  return data;
}

async function loadVolumes(): Promise<Record<string, number>> {
  const held = cacheRead<Record<string, number>>("volumes", VOLUMES_TTL);
  if (held) return held;
  const fresh = await soft("/volumes");
  const data = (fresh?.data ?? {}) as Record<string, number>;
  if (fresh) cacheWrite("volumes", data);
  return data;
}

export async function fetchMarket(): Promise<Market> {
  const [mapping, latest, hour, day, dailyVolume] = await Promise.all([
    loadMapping(),
    get("/latest"),
    soft("/1h"),
    loadDay(),
    loadVolumes(),
  ]);

  const info = new Map<number, ItemInfo>();
  for (const i of mapping) info.set(i.id, i);

  return {
    info,
    latest: latest.data ?? {},
    hour: hour?.data ?? {},
    day,
    dailyVolume,
    fetchedAt: Date.now(),
  };
}

const series = new Map<string, { at: number; pts: SeriesPoint[] }>();

export async function fetchSeries(id: number, lookback: Lookback): Promise<SeriesPoint[]> {
  const key = `${id}:${lookback}`;
  const held = series.get(key);
  if (held && Date.now() - held.at < SERIES_TTL) return held.pts;

  const json = await soft(
    `/timeseries?id=${id}&timestep=${TIMESTEP[lookback]}&lookback=${lookback}`,
  );
  const pts = (json?.data ?? []) as SeriesPoint[];
  series.set(key, { at: Date.now(), pts });
  return pts;
}

export function iconUrl(item: ItemInfo): string | null {
  if (!item.icon) return null;
  return `https://oldschool.runescape.wiki/images/${encodeURIComponent(item.icon.replace(/ /g, "_"))}`;
}
