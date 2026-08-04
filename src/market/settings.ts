import { DEFAULT_GATES, DEFAULT_CHECK_IN_HOURS } from "./flip";
import type { Gates } from "./flip";
import { SLOTS_MEMBERS, DEFAULT_MIN_SLOT_PROFIT } from "./allocate";

const KEY = "osrs-companion:market:v1";
const OLD_KEY = "osrs-companion:ge:v1";

export type Mode = "basic" | "advanced";

export interface Settings {
  mode: Mode;
  capital: number;
  slots: number;
  minSlotProfit: number;
  checkInHours: number;
  gates: Gates;
  gatesOff: boolean;
  rows: number;
  sortCol: string;
  sortDir: "asc" | "desc";
  cols: string[] | null;
}

export const DEFAULTS: Settings = {
  mode: "basic",
  capital: 5_000_000,
  slots: SLOTS_MEMBERS,
  minSlotProfit: DEFAULT_MIN_SLOT_PROFIT,
  checkInHours: DEFAULT_CHECK_IN_HOURS,
  gates: { ...DEFAULT_GATES },
  gatesOff: false,
  rows: 50,
  sortCol: "rate",
  sortDir: "desc",
  cols: null,
};

function migrate(): Partial<Settings> {
  try {
    const raw = localStorage.getItem(OLD_KEY);
    if (!raw) return {};
    const old = JSON.parse(raw);
    const out: Partial<Settings> = {};
    if (typeof old.capital === "number" && old.capital > 0) out.capital = old.capital;
    out.gates = {
      ...DEFAULT_GATES,
      maxAgeSec: typeof old.maxAgeSec === "number" ? old.maxAgeSec : DEFAULT_GATES.maxAgeSec,
      membersOk: typeof old.membersOk === "boolean" ? old.membersOk : DEFAULT_GATES.membersOk,
    };
    return out;
  } catch {
    return {};
  }
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const held = JSON.parse(raw);
      return { ...DEFAULTS, ...held, gates: { ...DEFAULT_GATES, ...(held.gates ?? {}) } };
    }
  } catch {
  }
  return { ...DEFAULTS, ...migrate() } as Settings;
}

export const s: Settings = load();

export function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
  }
}

export function resetTuning(): void {
  s.gates = { ...DEFAULT_GATES };
  s.minSlotProfit = DEFAULT_MIN_SLOT_PROFIT;
  s.checkInHours = DEFAULT_CHECK_IN_HOURS;
  save();
}
