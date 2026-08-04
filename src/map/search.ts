import { labels, namedIconTypes } from "./data";

export interface PlaceHit {
  name: string;
  wx: number;
  wy: number;
}

export interface TypeHit {
  key: string;
  name: string;
  count: number;
}

export interface SearchResult {
  query: string;
  places: PlaceHit[];
  types: TypeHit[];
  matchedTypes: Set<string>;
  total: number;
}

const MAX_PLACES = 8;

export function search(raw: string): SearchResult | null {
  const query = raw.trim().toLowerCase();
  if (!query) return null;

  const places: PlaceHit[] = [];
  for (const l of labels()) {
    if (!l.name.toLowerCase().includes(query)) continue;
    places.push({ name: l.name, wx: l.wx, wy: l.wy });
  }
  places.sort((a, b) => {
    const ap = a.name.toLowerCase().startsWith(query) ? 0 : 1;
    const bp = b.name.toLowerCase().startsWith(query) ? 0 : 1;
    return ap - bp || a.name.length - b.name.length || a.name.localeCompare(b.name);
  });

  const types: TypeHit[] = [];
  const matchedTypes = new Set<string>();
  for (const t of namedIconTypes()) {
    if (!t.name.toLowerCase().includes(query)) continue;
    matchedTypes.add(t.key);
    types.push({ key: t.key, name: t.name, count: t.count });
  }

  const iconTotal = types.reduce((n, t) => n + t.count, 0);
  return {
    query,
    places: places.slice(0, MAX_PLACES),
    types,
    matchedTypes,
    total: places.length + iconTotal,
  };
}
