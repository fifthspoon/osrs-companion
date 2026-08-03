import type { RouteDef } from "./routes";

// Progress through a single run. You tap the stop you're at, it works out
// what's next. Resets when you finish or when you hit reset.

const KEY = "osrs-companion:run:v1";

type Visited = Record<string, string[]>; // routeId -> visited stop ids

function load(): Visited {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Visited;
  } catch {
    // default below
  }
  return {};
}

let visited: Visited = load();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(visited));
  } catch {
    // not worth breaking over
  }
}

export function isVisited(routeId: string, stopId: string): boolean {
  return (visited[routeId] ?? []).includes(stopId);
}

export function toggle(routeId: string, stopId: string): void {
  const list = visited[routeId] ?? [];
  visited[routeId] = list.includes(stopId)
    ? list.filter((x) => x !== stopId)
    : [...list, stopId];
  persist();
}

export function reset(routeId: string): void {
  visited[routeId] = [];
  persist();
}

export function visitedCount(route: RouteDef): number {
  return route.stops.filter((s) => isVisited(route.id, s.id)).length;
}

// Next unvisited stop in route order, or null when the run is done.
export function nextStop(route: RouteDef) {
  return route.stops.find((s) => !isVisited(route.id, s.id)) ?? null;
}
