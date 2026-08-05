import { passes, sizeFor, DEFAULT_CHECK_IN_HOURS } from "./flip";
import type { Candidate, Sized } from "./flip";

export const SLOTS_MEMBERS = 8;
export const SLOTS_F2P = 3;
export const DEFAULT_MIN_SLOT_PROFIT = 50_000;

export type UnusedReason =
  | "none"
  | "no-candidates"
  | "all-taken"
  | "capital-exhausted"
  | "below-floor";

export type StrategyId = "rate" | "shared" | "per-gp";

export interface Slot {
  candidate: Candidate;
  sized: Sized;
}

export interface Options {
  capital: number;
  slotCount: number;
  minProfit: number;
  checkInHours: number;
}

export interface Allocation {
  slots: Slot[];
  slotCount: number;
  capital: number;
  committed: number;
  remaining: number;
  profit: number;
  profitPerHour: number;
  poolSize: number;
  minProfit: number;
  checkInHours: number;
  strategy: StrategyId;
  unused: UnusedReason;
}

export function defaultOptions(capital: number, slotCount: number): Options {
  return {
    capital,
    slotCount,
    minProfit: DEFAULT_MIN_SLOT_PROFIT,
    checkInHours: DEFAULT_CHECK_IN_HOURS,
  };
}

export function allocate(candidates: Candidate[], o: Options): Allocation {
  const pool = candidates.filter(passes);

  const runs: Allocation[] = [
    fill(pool, o, "rate"),
    fill(pool, o, "shared"),
    fill(pool, o, "per-gp"),
  ];

  return runs.reduce((a, b) => (b.profitPerHour > a.profitPerHour ? b : a));
}

function fill(pool: Candidate[], o: Options, strategy: StrategyId): Allocation {
  const taken = new Set<number>();
  const slots: Slot[] = [];
  let remaining = o.capital;
  let affordableExists = false;

  while (slots.length < o.slotCount) {
    const slotsLeft = o.slotCount - slots.length;
    const budget = strategy === "shared" ? remaining / slotsLeft : remaining;

    let best: Candidate | null = null;
    let bestSized: Sized | null = null;
    let bestScore = -Infinity;
    affordableExists = false;

    for (const c of pool) {
      if (taken.has(c.id)) continue;
      const s = sizeFor(c, budget, o.checkInHours);
      if (!s) continue;
      affordableExists = true;
      if (s.profit < o.minProfit) continue;

      const score = strategy === "per-gp" ? s.profitPerHour / s.spend : s.profitPerHour;
      if (score > bestScore) {
        bestScore = score;
        best = c;
        bestSized = s;
      }
    }

    if (!best || !bestSized) break;

    slots.push({ candidate: best, sized: bestSized });
    taken.add(best.id);
    remaining -= bestSized.spend;
  }

  slots.sort((a, b) => b.sized.profitPerHour - a.sized.profitPerHour);

  return {
    slots,
    slotCount: o.slotCount,
    capital: o.capital,
    committed: o.capital - remaining,
    remaining,
    profit: slots.reduce((a, s) => a + s.sized.profit, 0),
    profitPerHour: slots.reduce((a, s) => a + s.sized.profitPerHour, 0),
    poolSize: pool.length,
    minProfit: o.minProfit,
    checkInHours: o.checkInHours,
    strategy,
    unused: unusedReason(slots.length, o.slotCount, pool, taken, affordableExists),
  };
}

function unusedReason(
  filled: number,
  slotCount: number,
  pool: Candidate[],
  taken: Set<number>,
  affordableExists: boolean,
): UnusedReason {
  if (filled >= slotCount) return "none";
  if (!pool.length) return "no-candidates";
  if (pool.every((c) => taken.has(c.id))) return "all-taken";
  return affordableExists ? "below-floor" : "capital-exhausted";
}
