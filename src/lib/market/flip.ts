import { geTax } from "./tax";
import type { Market } from "./api";

export const MIN_CYCLE_HOURS = 0.05;
export const LIMIT_WINDOW_HOURS = 4;

export type GateId =
  | "no-limit"
  | "no-margin"
  | "stale"
  | "illiquid"
  | "one-sided"
  | "fake-spread"
  | "outlier";

export const GATE_LABEL: Record<GateId, string> = {
  "no-limit": "no buy limit",
  "no-margin": "no margin after tax",
  stale: "price too old",
  illiquid: "too little trade",
  "one-sided": "flow is one sided",
  "fake-spread": "spread is abnormally wide",
  outlier: "price is an outlier against the last hour",
};

export interface Gates {
  maxAgeSec: number;
  minFlowPerSide: number;
  maxFlowSkew: number;
  maxSpreadRatio: number;
  maxOutlierBand: number;
  membersOk: boolean;
}

export const DEFAULT_GATES: Gates = {
  maxAgeSec: 1800,
  minFlowPerSide: 25,
  maxFlowSkew: 10,
  maxSpreadRatio: 2,
  maxOutlierBand: 0.05,
  membersOk: true,
};

export interface Candidate {
  id: number;
  name: string;
  members: boolean;
  limit: number;
  buy: number;
  sell: number;
  tax: number;
  net: number;
  margin: number;
  buyFlow: number;
  sellFlow: number;
  dailyVolume: number;
  ageSec: number;
  spreadRatio: number | null;
  vsDay: number | null;
  buyVsHour: number | null;
  sellVsHour: number | null;
  failed: GateId[];
}

export interface Sized {
  qty: number;
  spend: number;
  profit: number;
  cycleHours: number;
  profitPerHour: number;
  bound: "limit" | "flow" | "capital";
}

export const DEFAULT_CHECK_IN_HOURS = 1;

export function passes(c: Candidate): boolean {
  return c.failed.length === 0;
}

export function buildCandidates(m: Market, g: Gates): Candidate[] {
  const nowSec = Math.floor(Date.now() / 1000);
  const haveFlow = Object.keys(m.hour).length > 0;
  const out: Candidate[] = [];

  for (const [key, p] of Object.entries(m.latest)) {
    if (!p.high || !p.low || !p.highTime || !p.lowTime) continue;

    const id = Number(key);
    const item = m.info.get(id);
    if (!item) continue;
    if (item.members && !g.membersOk) continue;

    const buy = p.low;
    const sell = p.high;
    const tax = geTax(sell, id);
    const net = sell - tax - buy;

    const limit = item.limit ?? 0;
    const ageSec = nowSec - Math.min(p.highTime, p.lowTime);

    const h = m.hour[key];
    const buyFlow = h ? (h.lowPriceVolume ?? 0) : 0;
    const sellFlow = h ? (h.highPriceVolume ?? 0) : 0;
    const buyVsHour = h?.avgLowPrice ? (buy - h.avgLowPrice) / h.avgLowPrice : null;
    const sellVsHour = h?.avgHighPrice ? (sell - h.avgHighPrice) / h.avgHighPrice : null;

    const d = m.day[key];
    const daySpread =
      d && d.avgHighPrice && d.avgLowPrice && d.avgHighPrice > d.avgLowPrice
        ? d.avgHighPrice - d.avgLowPrice
        : null;
    const spreadRatio = daySpread ? (sell - buy) / daySpread : null;
    const vsDay = d?.avgLowPrice ? (buy - d.avgLowPrice) / d.avgLowPrice : null;

    const failed: GateId[] = [];
    if (limit <= 0) failed.push("no-limit");
    if (net <= 0) failed.push("no-margin");
    if (ageSec > g.maxAgeSec) failed.push("stale");
    if (haveFlow) {
      if (buyFlow < g.minFlowPerSide || sellFlow < g.minFlowPerSide) failed.push("illiquid");
      else {
        const skew = Math.max(buyFlow / sellFlow, sellFlow / buyFlow);
        if (skew > g.maxFlowSkew) failed.push("one-sided");
      }
    }
    if (spreadRatio !== null && spreadRatio > g.maxSpreadRatio) failed.push("fake-spread");

    const buyBelow = buyVsHour !== null && buyVsHour < -g.maxOutlierBand;
    const sellAbove = sellVsHour !== null && sellVsHour > g.maxOutlierBand;
    if (buyBelow || sellAbove) failed.push("outlier");

    out.push({
      id,
      name: item.name,
      members: item.members,
      limit,
      buy,
      sell,
      tax,
      net,
      margin: buy > 0 ? net / buy : 0,
      buyFlow,
      sellFlow,
      dailyVolume: m.dailyVolume[key] ?? 0,
      ageSec,
      spreadRatio,
      vsDay,
      buyVsHour,
      sellVsHour,
      failed,
    });
  }

  return out;
}

export function effectiveFlow(c: Candidate): number {
  if (c.buyFlow <= 0 || c.sellFlow <= 0) return 0;
  return 1 / (1 / c.buyFlow + 1 / c.sellFlow);
}

export function sizeFor(
  c: Candidate,
  capital: number,
  checkInHours: number = DEFAULT_CHECK_IN_HOURS,
): Sized | null {
  if (c.limit <= 0 || c.buy <= 0 || c.net <= 0) return null;

  const flow = effectiveFlow(c);
  if (flow <= 0) return null;

  const wanted = Math.min(c.limit, Math.max(1, Math.floor(flow * checkInHours)));
  const affordable = Math.floor(capital / c.buy);
  const qty = Math.min(wanted, affordable);
  if (qty <= 0) return null;

  const cycleHours = Math.max(MIN_CYCLE_HOURS, qty / flow);
  const rateFromWindow = (c.net * qty) / checkInHours;
  const rateFromLimit = (c.net * c.limit) / LIMIT_WINDOW_HOURS;

  const bound: Sized["bound"] =
    affordable < wanted ? "capital" : rateFromLimit < rateFromWindow ? "limit" : "flow";

  return {
    qty,
    spend: qty * c.buy,
    profit: c.net * qty,
    cycleHours,
    profitPerHour: Math.min(rateFromWindow, rateFromLimit),
    bound,
  };
}
