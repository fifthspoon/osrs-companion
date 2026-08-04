import { TASKS } from "./tasks";
import type { TaskDef } from "./tasks";

export interface TaskState {
  lastDone: number | null;
  enabled: boolean;
}

export type Store = Record<string, TaskState>;

const KEY = "osrs-companion:v1";

export function load(): Store {
  let saved: Store = {};
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) saved = JSON.parse(raw) as Store;
  } catch {
    saved = {};
  }
  const store: Store = {};
  for (const t of TASKS) {
    store[t.id] = saved[t.id] ?? { lastDone: null, enabled: t.defaultOn };
  }
  return store;
}

export function save(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
  }
}

export const MINUTE = 60_000;

export function lastDailyReset(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function nextDailyReset(now: number): number {
  return lastDailyReset(now) + 24 * 60 * MINUTE;
}

export function msUntilReady(def: TaskDef, st: TaskState, now: number): number {
  if (st.lastDone === null) return 0;
  if (def.kind === "daily") {
    return Math.max(0, nextDailyReset(st.lastDone) - now);
  }
  const cd = (def.minutes ?? 0) * MINUTE;
  return Math.max(0, st.lastDone + cd - now);
}

export function isReady(def: TaskDef, st: TaskState, now: number): boolean {
  return msUntilReady(def, st, now) <= 0;
}
